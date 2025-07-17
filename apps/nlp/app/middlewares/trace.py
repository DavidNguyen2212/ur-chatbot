import uuid
import time
from typing import Awaitable, Callable, Optional
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.logger import get_logger

# Constants for trace ID
TRACE_ID_KEY = "trace_id"
TRACE_ID_HEADER = "X-Trace-ID"

logger = get_logger()


class TraceMiddleware(BaseHTTPMiddleware):
    """
    Trace middleware that creates trace ID for each request and injects it into context.
    Similar to the Go Echo TraceMiddleware but adapted for FastAPI.
    """

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        start_time = time.time()

        # Get trace ID from header or generate new one
        trace_id = request.headers.get(TRACE_ID_HEADER)
        if not trace_id:
            trace_id = str(uuid.uuid4())

        # Inject trace ID into request state
        request.state.trace_id = trace_id

        # Log request start with trace ID
        logger.info(
            "Request started",
            extra={
                "trace_id": trace_id,
                "method": request.method,
                "path": request.url.path,
                "query": str(request.url.query),
                "ip": self._get_client_ip(request),
            },
        )

        # Process request
        response = await call_next(request)

        # Add trace ID to response headers
        response.headers[TRACE_ID_HEADER] = trace_id

        # Log request completion with trace ID and details
        latency = time.time() - start_time
        logger.info(
            "Request completed",
            extra={
                "trace_id": trace_id,
                "method": request.method,
                "path": request.url.path,
                "query": str(request.url.query),
                "status": response.status_code,
                "ip": self._get_client_ip(request),
                "latency": f"{latency:.4f}s",
            },
        )

        return response

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address from request"""
        # Check for forwarded headers first
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        # Check for real IP header
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

        # Fallback to client host
        return request.client.host if request.client else "unknown"


def get_trace_id(request: Request) -> Optional[str]:
    """Helper function to get trace ID from request state"""
    return getattr(request.state, TRACE_ID_KEY, None)


def with_trace_id(trace_id: str) -> dict:
    """Helper function to create context with trace ID"""
    return {TRACE_ID_KEY: trace_id}
