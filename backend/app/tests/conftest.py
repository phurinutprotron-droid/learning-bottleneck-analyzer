import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from app.core.database import Base, make_engine, get_db
from app.core.security import hash_password
from app.models.entities import User, SubjectVersion
from app.subjects.registry import PACKS
import app.main as main


@pytest.fixture
def db_factory(tmp_path):
    engine = make_engine('sqlite:///' + str(tmp_path / 'test.db'))
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        for role in ['teacher', 'researcher']:
            db.add(User(handle=role, password_hash=hash_password('test-password-123'), role=role))
        db.commit()
    yield factory
    engine.dispose()


@pytest.fixture
def client(db_factory, monkeypatch):
    def override_db():
        with db_factory() as db:
            try:
                yield db
                db.commit()
            except Exception:
                db.rollback()
                raise
    main.app.dependency_overrides[get_db] = override_db
    monkeypatch.setattr(main, 'SessionLocal', db_factory)
    monkeypatch.setattr(main.settings, "ai_provider", "deterministic")
    main.requests_by_ip.clear()
    with TestClient(main.app) as c:
        yield c
    main.app.dependency_overrides.clear()


def register(client, handle='learner_one'):
    result = client.post('/api/auth/register', json={'handle': handle, 'password': 'test-password-123'})
    assert result.status_code == 201, result.text
    payload = result.json()
    return {'Authorization': 'Bearer ' + payload['access_token']}, payload['user']['student_id']


def staff_headers(client, role='teacher'):
    result = client.post('/api/auth/login', json={'handle': role, 'password': 'test-password-123'})
    assert result.status_code == 200
    return {'Authorization': 'Bearer ' + result.json()['access_token']}


def baseline(client, headers, sid, subject='mathematics'):
    assert client.post(f'/api/students/{sid}/consent', headers=headers, json={'granted': True}).status_code == 200
    result = client.post(f'/api/students/{sid}/assessments', headers=headers, json={'subject_id': subject})
    assert result.status_code == 201, result.text
    a = result.json()
    for item in a['items']:
        answer = item['options'][-1] if item['options'] else '-999'
        r = client.post(f'/api/assessments/{a["id"]}/responses', headers=headers, json={'item_id': item['id'], 'answer': answer, 'reasoning': 'add to both and only one side', 'confidence': 5})
        assert r.status_code == 201, r.text
    assert client.post(f'/api/assessments/{a["id"]}/complete', headers=headers).status_code == 200
    return a
