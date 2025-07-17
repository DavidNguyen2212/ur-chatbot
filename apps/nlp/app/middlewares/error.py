from fastapi import Request, status
from fastapi.exceptions import RequestValidationError, HTTPException
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from app.core import get_logger
from app.schemas import error_response
from app.schemas.exceptions import BaseCustomException
import traceback
import json

logger = get_logger()


async def custom_exception_handler(request: Request, exc: BaseCustomException):
    """Handle custom exceptions"""
    logger.warning(
        f"Custom Exception: {exc.error_code} - {exc.message} - "
        f"{request.method} {request.url} - Details: {exc.details}"
    )

    return error_response(
        message=exc.message,
        status_code=exc.status_code,
        error_code=exc.error_code,
        details=exc.details,
    )


async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions"""
    logger.warning(
        f"HTTP Exception: {exc.status_code} - {exc.detail} - "
        f"{request.method} {request.url}"
    )

    return error_response(
        message=exc.detail if isinstance(exc.detail, str) else str(exc.detail),
        status_code=exc.status_code,
        error_code="HTTP_ERROR",
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation exceptions"""
    logger.warning(
        f"Validation Exception: {exc.errors()} - " f"{request.method} {request.url}"
    )

    # Format validation errors
    errors = []
    for error in exc.errors():
        field = " -> ".join(str(loc) for loc in error["loc"])
        errors.append({"field": field, "message": error["msg"], "type": error["type"]})

    return error_response(
        message="Validation failed",
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        error_code="VALIDATION_ERROR",
        details={"errors": errors},
    )


async def database_exception_handler(request: Request, exc: SQLAlchemyError):
    """Handle database exceptions"""
    logger.error(
        f"Database Exception: {exc} - {request.method} {request.url}\n"
        f"{traceback.format_exc()}"
    )

    if isinstance(exc, IntegrityError):
        return error_response(
            message="Data integrity violation",
            status_code=status.HTTP_409_CONFLICT,
            error_code="INTEGRITY_ERROR",
        )

    return error_response(
        message="Database operation failed",
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        error_code="DATABASE_ERROR",
    )


async def general_exception_handler(request: Request, exc: Exception):
    """Handle all other exceptions"""
    logger.error(
        f"Unhandled Exception: {exc} - {request.method} {request.url}\n"
        f"{traceback.format_exc()}"
    )

    # Handle specific Python exceptions
    if isinstance(exc, FileNotFoundError):
        return error_response(
            message="File not found",
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="FILE_NOT_FOUND",
        )
    elif isinstance(exc, PermissionError):
        return error_response(
            message="Permission denied",
            status_code=status.HTTP_403_FORBIDDEN,
            error_code="PERMISSION_DENIED",
        )
    elif isinstance(exc, ValueError):
        return error_response(
            message="Invalid input value",
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="VALUE_ERROR",
        )
    elif isinstance(exc, KeyError):
        return error_response(
            message="Required key missing",
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="KEY_ERROR",
        )
    elif isinstance(exc, json.JSONDecodeError):
        return error_response(
            message="Invalid JSON format",
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="JSON_DECODE_ERROR",
        )

    # Generic server error
    return error_response(
        message="Internal server error",
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        error_code="INTERNAL_SERVER_ERROR",
    )
