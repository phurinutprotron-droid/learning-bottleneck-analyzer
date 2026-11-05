from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Response as HTTPResponse
from sqlalchemy import select, delete
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import get_settings
from app.core.security import current_user, bearer, issue_session, hash_password, verify_password, token_hash
from app.models.entities import User, Student, SessionToken
from app.schemas.contracts import Credentials, Registration
from app.repositories.records import audit

router = APIRouter(prefix='/auth', tags=['Authentication'])


def identity(db, user):
    student = db.scalar(select(Student).where(Student.user_id == user.id))
    return {'id': user.id, 'handle': user.handle, 'role': user.role, 'is_demo': user.is_demo, 'student_id': student.id if student else None,
            'anonymous_id': student.anonymous_id if student else None}


@router.post('/register', status_code=201)
def register(body: Registration, db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.handle == body.handle)):
        raise HTTPException(409, 'Handle unavailable')
    user = User(handle=body.handle, password_hash=hash_password(body.password), role='student')
    db.add(user)
    db.flush()
    db.add(Student(user_id=user.id, grade=body.grade))
    db.flush()
    audit(db, user, 'account.registered')
    token = issue_session(db, user, get_settings().session_hours)
    return {'access_token': token, 'token_type': 'bearer', 'user': identity(db, user)}


@router.post('/login')
def login(body: Credentials, db: Session = Depends(get_db)):
    return authenticate(body, db)


@router.post('/login/{portal}')
def portal_login(portal: Literal['student', 'teacher', 'researcher'], body: Credentials, db: Session = Depends(get_db)):
    return authenticate(body, db, portal)


def authenticate(body: Credentials, db: Session, portal: str | None = None):
    user = db.scalar(select(User).where(User.handle == body.handle))
    # Equal-cost hash on an unknown user to reduce handle enumeration by timing.
    valid = verify_password(body.password, user.password_hash) if user else verify_password(body.password, hash_password('unavailable-account'))
    if not user or not valid or (user.is_demo and get_settings().environment.casefold() == 'production'):
        raise HTTPException(401, 'Invalid handle or password')
    if portal and user.role != portal:
        raise HTTPException(403, f'Use the {user.role} sign-in for this account')
    audit(db, user, 'session.created')
    return {'access_token': issue_session(db, user, get_settings().session_hours), 'token_type': 'bearer', 'user': identity(db, user)}


@router.get('/me')
def me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return identity(db, user)


@router.post('/logout', status_code=204)
def logout(user: User = Depends(current_user), credentials=Depends(bearer), db: Session = Depends(get_db)):
    db.execute(delete(SessionToken).where(SessionToken.token_hash == token_hash(credentials.credentials)))
    audit(db, user, 'session.revoked')
    return HTTPResponse(status_code=204)
