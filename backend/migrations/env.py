from alembic import context
from app.core.config import get_settings
from app.core.database import Base, make_engine
from app.models import entities  # register models

target_metadata = Base.metadata

if context.is_offline_mode():
    context.configure(url=get_settings().database_url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    with make_engine(get_settings().database_url).connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=True)
        with context.begin_transaction():
            context.run_migrations()
