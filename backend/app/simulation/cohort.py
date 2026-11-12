"""Synthetic students, never participant observations or live login identities.

This only generates data. Persistence is an explicit operator action. All accounts
are is_demo=True with an unusable password, and no human consent, AI review,
intervention, or diagnostic completion is manufactured.
"""
import json
from datetime import datetime, timedelta, timezone
from random import Random
from uuid import NAMESPACE_URL, uuid5

from app.models.entities import User, Student, SubjectVersion, Assessment, Response
from app.subjects.registry import PACKS
from app.diagnostics.evidence_analyzer import grade

COHORT = 'lba-simulated-students-v1'
ANCHOR = datetime(2026, 11, 11, 10, tzinfo=timezone.utc)
TABLES = {'subject_versions': SubjectVersion, 'users': User, 'students': Student,
          'assessments': Assessment, 'responses': Response}
PROFILES = ('steady', 'foundation_practice', 'reasoning_practice',
            'high_confidence_errors', 'variable')


def identity(key):
    return str(uuid5(NAMESPACE_URL, COHORT + '/' + key))


def generate_cohort(packs=None):
    # Existing deployed packs are supplied when preparing the online dataset.
    packs = list(packs if packs is not None else PACKS.values())
    rng = Random(20261112)
    rows = {table: [] for table in TABLES}
    rows['subject_versions'] = [{'id': f'{p.id}:{p.version}', 'snapshot': p.model_dump()} for p in packs]
    manifest = []
    for number in range(1, 101):
        uid, sid = identity(f'user/{number}'), identity(f'student/{number}')
        school_grade = 7 + (number - 1) % 3
        pattern = PROFILES[(number - 1) % len(PROFILES)]
        joined = ANCHOR - timedelta(days=35 + number % 20)
        rows['users'].append({'id': uid, 'handle': f'sim_lba_{number:03}',
                              'password_hash': 'synthetic-disabled:!',
                              'role': 'student', 'is_demo': True, 'created_at': joined.isoformat()})
        rows['students'].append({'id': sid, 'user_id': uid,
                                 'anonymous_id': f'SIM-M{school_grade - 6}-{number:03}', 'grade': school_grade})
        entry = {'handle': f'sim_lba_{number:03}', 'anonymous_id': rows['students'][-1]['anonymous_id'],
                 'grade': school_grade, 'pattern': pattern, 'data_status': 'synthetic software testing only',
                 'login_enabled': False, 'assessments_completed': 0, 'responses': 0}
        # Ten not started, fifteen in progress, seventy-five completed learners.
        active_packs = [] if number <= 10 else packs[:1] if number <= 25 else packs
        for subject_index, pack in enumerate(active_packs):
            items = [item for item in pack.items if item.stage == 'pre']
            aid = identity(f'assessment/{number}/{pack.id}')
            start = ANCHOR - timedelta(days=1 + number % 28, hours=subject_index * 2)
            complete = number > 25
            answered = len(items) if complete else (number - 11) % len(items)
            rows['assessments'].append({'id': aid, 'student_id': sid,
                'subject_version': f'{pack.id}:{pack.version}', 'stage': 'pre',
                'status': 'completed' if complete else 'open', 'item_ids': [i.id for i in items],
                'intervention_id': None, 'created_at': start.isoformat()})
            ability = {'steady': .88, 'foundation_practice': .3, 'reasoning_practice': .7,
                       'high_confidence_errors': .4, 'variable': .55}[pattern]
            for index, item in enumerate(items[:answered]):
                # Subject and concept variation; these are scenario parameters,
                # not inferred labels or calibrated learner ability scores.
                probability = max(.1, min(.95, ability + rng.uniform(-.18, .18)))
                correct = rng.random() < probability
                wrong = [option for option in item.options if option not in item.answers]
                answer = rng.choice(item.answers) if correct else rng.choice(wrong) if wrong else '-999'
                if pattern == 'reasoning_practice' or rng.random() < .2:
                    explanation = 'I am unsure how to explain this step.'
                elif not correct and item.rubric.misconception_terms and rng.random() < .6:
                    explanation = rng.choice(item.rubric.misconception_terms)
                else:
                    explanation = ' '.join(group[0] for group in item.rubric.required_groups)
                reasoning = '[SIMULATED SOFTWARE TEST] ' + explanation
                actual_correct, rubric = grade(item, answer, reasoning)
                confidence = 5 if pattern == 'high_confidence_errors' else rng.randint(1, 5)
                rows['responses'].append({'id': identity(f'response/{number}/{pack.id}/{item.id}'),
                    'assessment_id': aid, 'item_id': item.id, 'item_version': item.version,
                    'answer': answer, 'reasoning': reasoning, 'confidence': confidence,
                    'correct': actual_correct, 'rubric': rubric,
                    'created_at': (start + timedelta(seconds=(index + 1) * rng.randint(40, 120))).isoformat()})
            entry['responses'] += answered
            entry['assessments_completed'] += int(complete)
        manifest.append(entry)
    return {'cohort': COHORT, 'data_status': 'synthetic software testing only',
            'rows': rows, 'manifest': manifest}


def insert_local(db, dataset):
    """Append only. Refuse conflicting identities or different subject snapshots."""
    for table, records in dataset['rows'].items():
        model = TABLES[table]
        for record in records:
            existing = db.get(model, record['id'])
            if existing:
                if table == 'subject_versions':
                    if existing.snapshot != record['snapshot']:
                        raise ValueError('Existing subject version differs; no records changed')
                elif table == 'users' and (not existing.is_demo or existing.handle != record['handle']):
                    raise ValueError('Synthetic identity collision; no records changed')
                continue
            values = dict(record)
            if 'created_at' in values:
                values['created_at'] = datetime.fromisoformat(values['created_at'])
            db.add(model(**values))
        db.flush()


def postgres_statements(dataset):
    """Export append-only SQL; keys and JSON values are escaped as data."""
    statements = ["SELECT pg_advisory_xact_lock(20261112)"]
    # Refuse pre-existing handles/ids from another cohort rather than adopt them.
    ids = ','.join("'" + row['id'] + "'" for row in dataset['rows']['users'])
    statements.append("DO $$ BEGIN IF EXISTS (SELECT 1 FROM users WHERE "
        f"(id IN ({ids}) AND (NOT is_demo OR password_hash != 'synthetic-disabled:!')) "
        "OR (handle ~ '^sim_lba_[0-9]{3}$' AND id NOT IN (" + ids + "))) THEN "
        "RAISE EXCEPTION 'Synthetic identity collision'; END IF; END $$")
    for table, records in dataset['rows'].items():
        if not records:
            continue
        columns = ','.join(records[0])
        data = json.dumps(records, ensure_ascii=False).replace("'", "''")
        if table == 'subject_versions':
            statements.append("DO $$ BEGIN IF EXISTS (SELECT 1 FROM subject_versions s JOIN "
                f"json_populate_recordset(NULL::subject_versions, '{data}') n ON s.id=n.id "
                "WHERE s.snapshot::jsonb != n.snapshot::jsonb) THEN "
                "RAISE EXCEPTION 'Subject snapshot mismatch'; END IF; END $$")
        statements.append(f"INSERT INTO {table} ({columns}) SELECT {columns} FROM "
                          f"json_populate_recordset(NULL::{table}, '{data}') ON CONFLICT DO NOTHING")
    statements.append("INSERT INTO audit_logs(id,actor_id,action,created_at) VALUES "
                      f"('{identity('audit')}',NULL,'simulation.cohort_v1_created',CURRENT_TIMESTAMP) "
                      "ON CONFLICT DO NOTHING")
    return statements
