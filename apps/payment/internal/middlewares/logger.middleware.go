package middlewares

import (
	"time"

	"payment/global"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func LoggerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery
		method := c.Request.Method
		clientIP := c.ClientIP()

		// xử lý tiếp
		c.Next()

		end := time.Now()
		latency := end.Sub(start)

		status := c.Writer.Status()

		global.Logger.Info("HTTP Request",
			zap.String("method", method),
			zap.String("path", path),
			zap.String("query", query),
			zap.Int("status", status),
			zap.String("ip", clientIP),
			zap.Duration("latency", latency),
		)
	}
}
