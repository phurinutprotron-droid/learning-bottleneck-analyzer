from alembic import command
from alembic.config import Config
from sqlalchemy import inspect
from app.core.config import get_settings
from app.core.database import make_engine, Base


def test_migration_roundtrip_and_model_parity(tmp_path, monkeypatch):
    url = 'sqlite:///' + str(tmp_path / 'migrated.db')
    monkeypatch.setattr(get_settings(), 'database_url', url)
    cfg = Config('alembic.ini')
    command.upgrade(cfg, 'head')
    engine = make_engine(url)
    inspector = inspect(engine)
    assert set(Base.metadata.tables) <= set(inspector.get_table_names())
    for name, table in Base.metadata.tables.items():
        assert {c.name for c in table.columns} == {c['name'] for c in inspector.get_columns(name)}
    engine.dispose()
    command.downgrade(cfg, 'base')
    command.upgrade(cfg, 'head')
