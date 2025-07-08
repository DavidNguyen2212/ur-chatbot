package middlewares

import (
	"analytics/global"
	"time"

	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
)

func LoggerMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		start := time.Now()
		req := c.Request()
		res := c.Response()

		err := next(c)

		latency := time.Since(start)
		method := req.Method
		path := req.URL.Path
		query := req.URL.RawQuery
		status := res.Status
		clientIP := c.RealIP()

		global.Logger.Info("HTTP Request",
			zap.String("method", method),
			zap.String("path", path),
			zap.String("query", query),
			zap.Int("status", status),
			zap.String("ip", clientIP),
			zap.Duration("latency", latency),
		)

		return err
	}
}
