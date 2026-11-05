from sqlalchemy import select
from app.models.entities import User
from app.tests.conftest import register, staff_headers, baseline


def test_demonstration_records_are_excluded_from_research_by_default(client, db_factory):
    headers, sid = register(client, 'synthetic_demo')
    with db_factory() as db:
        account = db.scalar(select(User).where(User.handle == 'synthetic_demo'))
        account.is_demo = True
        db.commit()
    baseline(client, headers, sid)
    researcher = staff_headers(client, 'researcher')
    ordinary = client.get('/api/research/summary', headers=researcher).json()
    assert ordinary['students'] == ordinary['responses'] == ordinary['completed_baselines'] == 0
    demonstration = client.get('/api/research/summary?include_demo=true', headers=researcher).json()
    assert demonstration['students'] == 1 and demonstration['responses'] == 6
    assert 'demonstration' in demonstration['data_status']
    assert client.get('/api/auth/me', headers=headers).json()['is_demo'] is True
    export = client.get('/api/research/export?include_demo=true', headers=researcher)
    assert 'demonstration' in export.text and sid not in export.text


def test_student_cannot_self_assign_demo_or_staff_flags(client):
    response = client.post('/api/auth/register', json={'handle': 'not_allowed', 'password': 'a-long-password', 'is_demo': True})
    assert response.status_code == 422
