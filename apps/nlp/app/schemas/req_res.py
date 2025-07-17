from typing import Any, Optional
from fastapi.responses import JSONResponse
from fastapi import status
from pydantic import BaseModel
from typing import Generic, TypeVar

T = TypeVar("T")

class SuccessResponse(BaseModel, Generic[T]):
    """Standard API response schema"""
    success: bool
    message: str
    data: Optional[T] = None


class ErrorResponse(SuccessResponse):
    """Error response schema"""
    success: bool = False
    error_code: Optional[str] = None
    details: Optional[Any] = None


def success_response(
    message: str, data: Optional[Any] = None, status_code: int = status.HTTP_200_OK
) -> JSONResponse:
    """Create success response"""
    return JSONResponse(
        status_code=status_code,
        content=SuccessResponse(success=True, message=message, data=data).model_dump(),
    )


def error_response(
    message: str,
    status_code: int = status.HTTP_400_BAD_REQUEST,
    error_code: Optional[str] = None,
    details: Optional[Any] = None,
    data: Optional[Any] = None,
) -> JSONResponse:
    """Create error response"""
    return JSONResponse(
        status_code=status_code,
        content=ErrorResponse(
            message=message, error_code=error_code, details=details, data=data
        ).model_dump(),
    )
