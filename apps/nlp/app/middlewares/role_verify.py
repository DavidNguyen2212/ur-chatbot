from fastapi import HTTPException, Request
from app.enums.role import RoleEnum
from app.schemas.jwt import CoolJwtPayload


def role_guard(*roles: RoleEnum):
    def verify_role(request: Request):
        user: CoolJwtPayload = getattr(request.state, "user", None)

        if not user or not user.organization:
            raise HTTPException(
                status_code=403, detail="User doesn't belong to any Organization!"
            )

        try:
            user_role = RoleEnum(user.organization.role.upper())
        except ValueError:
            raise HTTPException(
                status_code=403, detail=f"Invalid role: {user.organization.role}"
            )

        if user_role not in roles:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to access this resource.",
            )

    return verify_role


def require_owner():
    return role_guard(RoleEnum.OWNER)


def require_admin():
    return role_guard(RoleEnum.ADMIN, RoleEnum.OWNER)


def require_agent():
    return role_guard(RoleEnum.AGENT, RoleEnum.ADMIN, RoleEnum.OWNER)
