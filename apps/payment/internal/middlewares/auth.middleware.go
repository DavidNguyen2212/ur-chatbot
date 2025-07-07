package middlewares

import (
	"encoding/json"
	"fmt"
	"net/http"
	"payment/global"
	"payment/internal/dtos"
	"payment/pkg/response"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			response.ErrorResponse(c, http.StatusUnauthorized, response.ErrUnauthorizedHeader)
			c.Abort()
			return
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
			response.ErrorResponse(c, http.StatusUnauthorized, response.ErrInvalidToken)
			c.Abort()
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			response.ErrorResponse(c, http.StatusUnauthorized, response.ErrInvalidTokenClaims)
			c.Abort()
			return
		}

		var payload dtos.CoolJwtPayload
		claimBytes, _ := json.Marshal(claims)
		json.Unmarshal(claimBytes, &payload)

		// Inject payload vào context để dùng trong controller
		c.Set("user", payload)

		c.Next()
	}
}
