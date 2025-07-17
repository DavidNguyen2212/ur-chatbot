"""
Repository Layer of NLP-Service
"""

from .document import DocumentRepository
from .training_status import TrainingStatusRepository

__all__ = ["DocumentRepository", "TrainingStatusRepository"]
