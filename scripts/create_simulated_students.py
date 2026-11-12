"""Prepare 100 synthetic students; local writes require --apply-local explicitly."""
import argparse
import csv
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--existing-packs', type=Path)
    parser.add_argument('--apply-local', action='store_true')
    args = parser.parse_args()
    if args.existing_packs:
        args.existing_packs = args.existing_packs.resolve()
    # Match the existing backend's relative .env and SQLite URL resolution.
    os.chdir(ROOT / 'backend')
    from app.simulation.cohort import generate_cohort, insert_local, postgres_statements
    from app.subjects.base_pack import SubjectPack
    packs = None
    if args.existing_packs:
        packs = [SubjectPack.model_validate(row['snapshot']) for row in json.loads(args.existing_packs.read_text('utf-8'))]
    dataset = generate_cohort(packs)
    out = ROOT / '.cache' / 'simulated-students'
    out.mkdir(parents=True, exist_ok=True)
    (out / 'dataset.json').write_text(json.dumps(dataset, ensure_ascii=False), encoding='utf-8')
    (out / 'postgres-statements.json').write_text(json.dumps(postgres_statements(dataset), ensure_ascii=False), encoding='utf-8')
    with (out / 'students.csv').open('w', newline='', encoding='utf-8-sig') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(dataset['manifest'][0]))
        writer.writeheader()
        writer.writerows(dataset['manifest'])
    if args.apply_local:
        from app.core.config import get_settings
        from app.core.database import SessionLocal
        settings = get_settings()
        if settings.environment != 'development' or not settings.database_url.startswith('sqlite:'):
            raise SystemExit('Local application is restricted to development SQLite')
        with SessionLocal.begin() as db:
            insert_local(db, dataset)
    print(json.dumps({'students': len(dataset['manifest']), 'counts': {k: len(v) for k, v in dataset['rows'].items()},
                      'local_applied': args.apply_local, 'output': str(out)}))


if __name__ == '__main__':
    main()
