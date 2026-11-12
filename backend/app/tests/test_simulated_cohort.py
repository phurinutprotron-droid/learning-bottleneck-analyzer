from collections import Counter
from datetime import datetime
from sqlalchemy import func, select

from app.simulation.cohort import generate_cohort, insert_local, postgres_statements
from app.models.entities import User, Student, Assessment, Response
from app.subjects.registry import PACKS
from app.diagnostics.evidence_analyzer import grade
from app.api.research_routes import dataset_summary


def test_cohort_has_exactly_100_disabled_synthetic_students_and_three_grades():
    dataset = generate_cohort()
    assert dataset == generate_cohort()
    assert len(dataset['rows']['users']) == len(dataset['rows']['students']) == 100
    assert len({u['handle'] for u in dataset['rows']['users']}) == 100
    assert all(u['role'] == 'student' and u['is_demo'] and u['password_hash'] == 'synthetic-disabled:!'
               for u in dataset['rows']['users'])
    assert Counter(s['grade'] for s in dataset['rows']['students']) == {7: 34, 8: 33, 9: 33}
    assert Counter(m['assessments_completed'] for m in dataset['manifest']) == {0: 25, 3: 75}
    assert len({m['pattern'] for m in dataset['manifest']}) == 5


def test_responses_are_grading_consistent_and_history_is_not_falsely_completed():
    dataset = generate_cohort()
    assessments = {a['id']: a for a in dataset['rows']['assessments']}
    responses = dataset['rows']['responses']
    assert {r['correct'] for r in responses} == {True, False}
    assert {r['confidence'] for r in responses} == {1, 2, 3, 4, 5}
    assert any(r['confidence'] == 5 and not r['correct'] for r in responses)
    for a in assessments.values():
        submitted = [r for r in responses if r['assessment_id'] == a['id']]
        assert len(submitted) == len(a['item_ids']) if a['status'] == 'completed' else len(submitted) < len(a['item_ids'])
    for r in responses:
        a = assessments[r['assessment_id']]
        item = PACKS[a['subject_version'].split(':')[0]].item(r['item_id'])
        assert (r['correct'], r['rubric']) == grade(item, r['answer'], r['reasoning'])
        assert datetime.fromisoformat(r['created_at']) > datetime.fromisoformat(a['created_at'])
        assert r['reasoning'].startswith('[SIMULATED SOFTWARE TEST]')
    assert not {'consents', 'diagnostic_runs', 'ai_reviews', 'interventions'} & dataset['rows'].keys()


def test_local_import_is_idempotent_and_excluded_from_ordinary_research(db_factory):
    dataset = generate_cohort()
    with db_factory.begin() as db:
        insert_local(db, dataset)
    with db_factory.begin() as db:
        insert_local(db, dataset)
    with db_factory() as db:
        assert db.scalar(select(func.count()).select_from(Student)) == 100
        assert db.scalar(select(func.count()).select_from(Assessment)) == len(dataset['rows']['assessments'])
        assert db.scalar(select(func.count()).select_from(Response)) == len(dataset['rows']['responses'])
        assert db.scalar(select(func.count()).select_from(User).where(User.is_demo.is_(False))) == 2
        ordinary = dataset_summary(db)
        demonstration = dataset_summary(db, True)
        assert ordinary['students'] == ordinary['responses'] == 0
        assert demonstration['students'] == 100
        assert demonstration['responses'] == len(dataset['rows']['responses'])
        assert demonstration['diagnostic_runs'] == 0


def test_export_is_append_only_and_disables_accounts():
    statements = postgres_statements(generate_cohort())
    assert statements[0].startswith('SELECT pg_advisory_xact_lock')
    assert all('DELETE FROM' not in s and 'UPDATE users' not in s for s in statements)
    assert any('Synthetic identity collision' in s for s in statements)
    assert any('Subject snapshot mismatch' in s for s in statements)
    assert any('synthetic-disabled:!' in s for s in statements)


def test_synthetic_identity_cannot_sign_in(client, db_factory):
    with db_factory.begin() as db:
        insert_local(db, generate_cohort())
    response = client.post('/api/auth/login/student', json={'handle': 'sim_lba_001', 'password': 'any-valid-length-password'})
    assert response.status_code == 401
