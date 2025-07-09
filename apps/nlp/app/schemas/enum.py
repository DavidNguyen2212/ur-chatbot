import enum

class PriorityEnum(str, enum.Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    NONE = "NONE"


class DocumentTypeEnum(str, enum.Enum):
    FILE = "FILE"
    TEXT = "TEXT"
    URL = "URL"


class TrainingStatusEnum(str, enum.Enum):
    UNTRAINED = "UNTRAINED"
    PENDING = "PENDING"
    TRAINED = "TRAINED"