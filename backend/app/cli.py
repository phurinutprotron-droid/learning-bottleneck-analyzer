"""Local provisioning only; staff roles can never be requested through registration."""
import argparse
import getpass
from sqlalchemy import select
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.entities import User


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['create-staff'])
    parser.add_argument('--handle', required=True)
    parser.add_argument('--role', choices=['teacher', 'researcher'], required=True)
    args = parser.parse_args()
    password = getpass.getpass('Password (10+ characters): ')
    from app.schemas.contracts import Credentials
    Credentials(handle=args.handle, password=password)
    with SessionLocal() as db:
        if db.scalar(select(User).where(User.handle == args.handle)):
            raise SystemExit('Handle already exists')
        db.add(User(handle=args.handle, role=args.role, password_hash=hash_password(password)))
        db.commit()
    print(f'Created {args.role} account: {args.handle}')


if __name__ == '__main__':
    main()
