"""Database-backed password work for constrained runtimes; never fast-hash passwords alone."""
import base64
import hashlib
import hmac
import re
from contextlib import nullcontext

from sqlalchemy import text

from app.core.config import get_settings

PREFIX = 'pg-bcrypt-hmac-sha384-v1:'
_BCRYPT = re.compile(r'^\$2[aby]\$12\$[./A-Za-z0-9]{53}$')


def _prehash(password: str) -> str:
    pepper = get_settings().password_pepper
    if len(pepper) < 32:
        raise RuntimeError('Password pepper is not configured')
    # Printable 64-byte input avoids bcrypt's null-byte and 72-byte limits.
    return base64.b64encode(hmac.digest(pepper.encode(), password.encode(), hashlib.sha384)).decode('ascii')


def _session(db):
    if db is not None:
        return nullcontext(db)
    from app.core.database import SessionLocal
    return SessionLocal()


def database_password_hash(password: str, db=None) -> str:
    prepared = _prehash(password)
    with _session(db) as session:
        if session.bind.dialect.name != 'postgresql':
            raise RuntimeError('Database password hashing requires PostgreSQL')
        digest = session.scalar(text("SELECT crypt(:prepared, gen_salt('bf', 12))"), {'prepared': prepared})
    if not isinstance(digest, str) or not _BCRYPT.fullmatch(digest):
        raise RuntimeError('Password hashing returned an invalid result')
    return PREFIX + digest


def verify_database_password(password: str, stored: str, db=None) -> bool:
    if not stored.startswith(PREFIX):
        return False
    digest = stored[len(PREFIX):]
    if not _BCRYPT.fullmatch(digest):
        return False
    prepared = _prehash(password)
    with _session(db) as session:
        if session.bind.dialect.name != 'postgresql':
            raise RuntimeError('Database password hashing requires PostgreSQL')
        actual = session.scalar(text('SELECT crypt(:prepared, :digest)'), {'prepared': prepared, 'digest': digest})
    return isinstance(actual, str) and hmac.compare_digest(actual, digest)

