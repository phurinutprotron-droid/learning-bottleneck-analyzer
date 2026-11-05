from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import NullPool
from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


def make_engine(url: str):
    if get_settings().runtime == 'cloudflare':
        from app.core.worker_database import connect
        return create_engine(url, creator=connect, poolclass=NullPool, hide_parameters=True)
    connect_args = {}
    if url.startswith('sqlite'):
        connect_args['check_same_thread'] = False
    elif url.startswith('postgresql+psycopg://'):
        connect_args['connect_timeout'] = 3
    engine = create_engine(url, connect_args=connect_args, pool_pre_ping=True, hide_parameters=True)
    if url.startswith('sqlite'):
        @event.listens_for(engine, 'connect')
        def enable_foreign_keys(connection, _):
            connection.execute('PRAGMA foreign_keys=ON')
    return engine


engine = make_engine(get_settings().database_url)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_db():
    with SessionLocal() as db:
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise

