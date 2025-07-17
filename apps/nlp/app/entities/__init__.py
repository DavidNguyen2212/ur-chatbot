"""
Entities package - SQLAlchemy models and enums.
"""
from sqlalchemy.orm import DeclarativeBase

# Base class for all entities
class Base(DeclarativeBase):
    pass

from .document import CoolDocument
from .training_status import OrganizationTrainingStatus

# Define public API
__all__ = [
    "Base",
    "CoolDocument",
    "OrganizationTrainingStatus",
]

# Package version
__version__ = "1.0.0"
