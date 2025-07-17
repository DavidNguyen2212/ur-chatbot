"""
DEPRECATED. NOW USE ROLE_VERIFY INJECTOR. VIEW role_verify.py FOR DETAILS
"""

import enum
import functools
from typing import Callable
from fastapi import Request, HTTPException
from app.schemas import CoolJwtPayload


# UserWarning: Duplicate Operation ID upload-tasks-wrapper for function wrapper at D:\chatbot_platform\apps\nlp\app\middlewares\role.py
#   warnings.warn(message, stacklevel=1)
# Nguyên nhân:
# FastAPI tự động sinh ra operation_id cho mỗi endpoint dựa trên tên hàm xử lý (handler function). Khi bạn dùng decorator (như role_guard) mà không giữ lại metadata gốc của hàm (tên, docstring, v.v.), tất cả các endpoint được bọc bởi decorator này sẽ có tên hàm là wrapper. Điều này dẫn đến trùng operation_id (ở đây là upload-tasks-wrapper), gây cảnh báo.
# Cách khắc phục:
# Bạn nên dùng functools.wraps để giữ lại metadata gốc của hàm khi viết decorator async.
class RoleEnum(str, enum.Enum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    AGENT = "AGENT"


# Viết middleware thì hiểu bản chất của framework. Golang thì ta dùng RoleMiddleware gắn vào route, nhưng với Fastapi, giống nest ở chỗ có decorator! nên ta tận dụng ưu thế này
def role_guard(*roles: RoleEnum):
    """
    Role guard decorator that checks if the user has the required role(s).
    Similar to the Go Echo RoleGuard middleware but adapted for FastAPI.

    Args:
        *roles: Variable number of roles that are allowed to access the endpoint

    Usage:
        @app.get("/admin-only")
        @role_guard(RoleEnum.ADMIN, RoleEnum.OWNER)
        async def admin_endpoint(request: Request):
            return {"message": "Admin access granted"}
    """

    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):  # ✅ giữ nguyên tất cả args/kwargs
            request: Request = kwargs.get("req", None)  # ✅ lấy request từ kwargs

            # fallback nếu request không nằm trong kwargs (trường hợp positional)
            if request is None:
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                        break

            if not request:
                raise HTTPException(status_code=400, detail="Missing Request object")

            user: CoolJwtPayload = getattr(request.state, "user", None)

            if not user or not user.organization:
                raise HTTPException(
                    status_code=403, detail="User doesn't belong to any Organization!"
                )

            user_role_str = user.organization.role.upper()
            try:
                user_role = RoleEnum(user_role_str)
            except ValueError:
                raise HTTPException(
                    status_code=403, detail=f"Invalid role: {user_role_str}"
                )

            if user_role in roles:
                return await func(*args, **kwargs)

            raise HTTPException(
                status_code=403, detail="Sorry, you don't have permission"
            )

        return wrapper

    return decorator


def require_owner():
    """Helper function to require OWNER role"""
    return role_guard(RoleEnum.OWNER)


def require_admin():
    """Helper function to require ADMIN role or higher"""
    return role_guard(RoleEnum.ADMIN, RoleEnum.OWNER)


def require_agent():
    """Helper function to require AGENT role or higher"""
    return role_guard(RoleEnum.AGENT, RoleEnum.ADMIN, RoleEnum.OWNER)
