from enum import Enum
from dataclasses import dataclass
from typing import List, Callable, Awaitable, Dict, Any

class ConsumerName(str, Enum):
    EMAIL_SENDER = "nlp-email-sender"
    DOCUMENT_TRAINER = "nlp-document-trainer"
    URL_CRAWLER = "nlp-url-crawler"

@dataclass
class ConsumerConfig:
    name: ConsumerName
    group_id: str
    topics: List[str]
    handler_func: Callable[[Dict[str, Any]], Awaitable[None]]

