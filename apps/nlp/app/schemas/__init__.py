"""
Schemas of NLP-Service. This modules contains:
- Request, Response data structure
- JWT payload type
- Exception type
- Event type for Message Queue producers & consumers
"""

from .jwt import CoolJwtPayload
from .req_res import error_response, success_response, SuccessResponse

__all__ = [
    "CoolJwtPayload",
    "error_response",
    "success_response",
    "SuccessResponse"
]
