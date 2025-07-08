package middlewares

import (
	"analytics/internal/constant/enums"
	"analytics/internal/dtos"
	"analytics/pkg/response"
	"net/http"
	"slices"
	"strings"

	echo "github.com/labstack/echo/v4"
)

func RoleGuard(roles ...enums.Role) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			user, ok := c.Get("user").(dtos.CoolJwtPayload)
			if !ok || user.Organization == nil {
				return response.ErrorResponse(c, http.StatusForbidden, 2001)
			}
			userRole := enums.Role(strings.ToUpper(user.Organization.Role))
			if slices.Contains(roles, userRole) {
				return next(c)
			}
			return response.ErrorResponse(c, http.StatusForbidden, 2002)
		}
	}
}
