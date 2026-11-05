import os

import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core import passwords
from app.core.security import hash_password, verify_password


@pytest.mark.parametrize('kwargs', [
    {'database_url': 'sqlite://', 'password_pepper': 'test-only-pepper-' * 3},
    {'database_url': 'postgresql+psycopg://user:pass@localhost/db', 'password_pepper': ''},
])
def test_database_password_configuration_fails_closed(kwargs):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, password_hash_backend='postgres_bcrypt', **kwargs)


def test_invalid_database_hash_never_queries_database():
    class NoQueries:
        def scalar(self, *args, **kwargs):
            pytest.fail('Invalid hashes must be rejected before SQL')
    assert not passwords.verify_database_password('test-password', passwords.PREFIX + '$2a$04$invalid', NoQueries())
    assert not passwords.verify_database_password('test-password', 'unknown-format', NoQueries())


def test_legacy_scrypt_still_verifies(monkeypatch):
    monkeypatch.setattr('app.core.security.get_settings', lambda: Settings(_env_file=None))
    stored = hash_password('test-only-password')
    assert verify_password('test-only-password', stored)
    assert not verify_password('incorrect-password', stored)
    assert not verify_password('test-only-password', 'malformed')


def test_postgres_passwords_are_salted_and_do_not_truncate_unicode(monkeypatch):
    url = os.environ.get('DATABASE_URL', '')
    if not url.startswith(('postgresql', 'postgres://')):
        pytest.skip('A real PostgreSQL instance is required')
    settings = Settings(_env_file=None, database_url=url, password_hash_backend='postgres_bcrypt',
                        password_pepper='synthetic-test-only-pepper-32-characters')
    monkeypatch.setattr(passwords, 'get_settings', lambda: settings)
    monkeypatch.setattr('app.core.security.get_settings', lambda: settings)
    engine = create_engine(settings.database_url)
    try:
        with Session(engine) as db:
            db.execute(text('CREATE EXTENSION IF NOT EXISTS pgcrypto'))
            password = 'รหัสผ่านทดสอบ' * 10
            first = hash_password(password, db)
            second = hash_password(password, db)
            assert first != second
            assert verify_password(password, first, db)
            assert not verify_password(password + 'different', first, db)
            assert not verify_password('incorrect-password', first, db)
            monkeypatch.setattr(passwords, 'get_settings', lambda: Settings(_env_file=None,
                database_url=url, password_hash_backend='postgres_bcrypt',
                password_pepper='another-synthetic-private-pepper-value'))
            assert not verify_password(password, first, db)
            db.rollback()
    finally:
        engine.dispose()

