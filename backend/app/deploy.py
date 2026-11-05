"""Run migrations, provision an optional operator-specified teacher, and serve."""
import os
import sys
from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.entities import User
from app.schemas.contracts import Credentials


def bootstrap_teacher(session_factory=SessionLocal):
    handle = os.environ.get('LBA_TEACHER_HANDLE', '')
    password = os.environ.get('LBA_TEACHER_PASSWORD', '')
    if not handle and not password:
        return
    if not handle or not password:
        raise RuntimeError('Both teacher provisioning variables must be configured')
    # Never let validation errors print the password in deployment logs.
    try:
        Credentials(handle=handle, password=password)
    except ValueError:
        raise RuntimeError('Teacher handle or password does not meet account requirements') from None
    with session_factory.begin() as db:
        existing = db.scalar(select(User).where(User.handle == handle))
        if existing:
            if existing.role != 'teacher' or existing.is_demo:
                raise RuntimeError('Teacher provisioning conflicts with an existing account')
            return
        db.add(User(handle=handle, role='teacher', password_hash=hash_password(password)))


def main():
    from alembic import command
    from alembic.config import Config

    command.upgrade(Config('alembic.ini'), 'head')
    bootstrap_teacher()
    os.environ.pop('LBA_TEACHER_PASSWORD', None)
    os.execv(sys.executable, [
        sys.executable, '-m', 'uvicorn', 'app.main:app',
        '--host', '0.0.0.0', '--port', os.environ.get('PORT', '8000'),
        '--no-access-log',
    ])


if __name__ == '__main__':
    main()
