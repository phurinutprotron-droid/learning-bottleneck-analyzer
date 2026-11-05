"""Opt-in local demonstration accounts. Never run against a production database."""
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'backend'))

from sqlalchemy import select
from app.core.config import get_settings
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.entities import User, Student


def main():
    settings = get_settings()
    if settings.environment != 'development' or not settings.database_url.startswith('sqlite:'):
        raise SystemExit('Demonstration accounts are restricted to local development SQLite.')
    password = 'LbaDemo!2026'
    with SessionLocal() as db:
        for role in ('student', 'teacher', 'researcher'):
            handle = f'demo_{role}'
            existing = db.scalar(select(User).where(User.handle == handle))
            if existing:
                if existing.role != role:
                    raise SystemExit('Existing account has a different role; refusing to modify: ' + handle)
                existing.is_demo = True
                print(f'{handle}: already exists; existing credentials preserved')
                continue
            user = User(handle=handle, password_hash=hash_password(password), role=role, is_demo=True)
            db.add(user)
            db.flush()
            if role == 'student':
                db.add(Student(user_id=user.id, anonymous_id='DEMO-LEARNER', grade=7))
            print(f'{handle}: created ({role}, demonstration only)')
        db.commit()
    print('New demonstration accounts use password: LbaDemo!2026')
    print('No assessment responses or performance results were seeded.')


if __name__ == '__main__':
    main()
