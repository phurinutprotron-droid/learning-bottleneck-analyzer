"""Enable the optional database password work on PostgreSQL; SQLite is unchanged."""
from alembic import op

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade():
    if op.get_bind().dialect.name == 'postgresql':
        op.execute('CREATE EXTENSION IF NOT EXISTS pgcrypto')


def downgrade():
    # pgcrypto can be shared by other schemas; application rollback must not remove it.
    pass

