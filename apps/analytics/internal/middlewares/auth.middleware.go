package middlewares

import (
	"analytics/global"
	"analytics/internal/dtos"
	"analytics/pkg/response"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	echo "github.com/labstack/echo/v4"
)

func AuthMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			authHeader := c.Request().Header.Get("Authorization")
			if !strings.HasPrefix(authHeader, "Bearer ") {
				return response.ErrorResponse(c, http.StatusUnauthorized, response.ErrUnauthorizedHeader)
			}

			tokenString := strings.TrimPrefix(authHeader, "Bearer ")
			jwtSecret := global.Config.Security.JWT.Key

			token, err := jwt.Parse(tokenString, func(token *jwt.Token) (any, error) {
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok || token.Method.Alg() != "HS256" {
					return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
				}
				return []byte(jwtSecret), nil
			})
			if err != nil || !token.Valid {
				return response.ErrorResponse(c, http.StatusUnauthorized, response.ErrInvalidToken)
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				return response.ErrorResponse(c, http.StatusUnauthorized, response.ErrInvalidTokenClaims)
			}

			var payload dtos.CoolJwtPayload
			claimBytes, _ := json.Marshal(claims)
			json.Unmarshal(claimBytes, &payload)

			// Inject payload vào context để dùng trong controller
			c.Set("user", payload)

			return next(c)
		}
	}
}
