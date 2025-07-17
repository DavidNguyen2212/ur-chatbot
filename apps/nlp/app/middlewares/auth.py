from typing import Awaitable, Callable
from fastapi import Request, HTTPException, Response
from fastapi.security.utils import get_authorization_scheme_param
from starlette.middleware.base import BaseHTTPMiddleware
import jwt
from app.schemas import CoolJwtPayload
from app.core import get_config, get_logger

logger = get_logger()


class AuthMiddleware(BaseHTTPMiddleware):
    EXEMPT_PATHS = ("/docs", "/redoc", "/openapi.json", "/health")

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        # Ignore middleware for docs and health
        if request.url.path in self.EXEMPT_PATHS:
            return await call_next(request)

        authorization: str = request.headers.get("Authorization")
        scheme, token = get_authorization_scheme_param(authorization)
        if not authorization or scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Unauthorized")

        try:
            config = get_config()
            payload = jwt.decode(token, config.JWT_SECRET, algorithms="HS256")
            user = CoolJwtPayload(**payload)

        except jwt.ExpiredSignatureError:
            logger.error("Token has expired")
            raise HTTPException(status_code=401, detail="Token expired")
        except jwt.InvalidTokenError as e:
            logger.error(f"Invalid token: {str(e)}")
            raise HTTPException(status_code=401, detail="Invalid token")
        except Exception as e:
            logger.error(f"Unexpected error during token validation: {str(e)}")
            raise HTTPException(status_code=401, detail="Invalid token")

        request.state.user = user
        response = await call_next(request)
        return response
