"""now

Revision ID: f122d140ba59
Revises: cc4e79db4af4
Create Date: 2025-07-14 18:06:40.276400

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f122d140ba59'
down_revision: Union[str, Sequence[str], None] = 'cc4e79db4af4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Set default value for uploaded_at and updated_at
    op.alter_column(
        'documents', 'uploaded_at',
        server_default=sa.text("timezone('utc', now())"),
        existing_type=sa.TIMESTAMP(timezone=True),
    )
    op.alter_column(
        'documents', 'updated_at',
        server_default=sa.text("timezone('utc', now())"),
        existing_type=sa.TIMESTAMP(timezone=True),
    )



def downgrade() -> None:
    # Drop trigger and function

    # Remove default value
    op.alter_column(
        'documents', 'uploaded_at',
        server_default=None,
        existing_type=sa.TIMESTAMP(timezone=True),
    )
    op.alter_column(
        'documents', 'updated_at',
        server_default=None,
        existing_type=sa.TIMESTAMP(timezone=True),
    )
