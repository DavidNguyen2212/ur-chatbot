package middlewares

import (
	"analytics/global"
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
)

/*
Logger middleware deprecated.
Now use Trace middleware
*/
const (
	TraceIDKey    = "trace_id"
	TraceIDHeader = "X-Trace-ID"
)

// TraceMiddleware tạo trace ID cho mỗi request và inject vào context
func TraceMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		start := time.Now()
		req := c.Request()

		// Tạo trace ID từ header hoặc tạo mới
		traceID := c.Request().Header.Get(TraceIDHeader)
		if traceID == "" {
			traceID = uuid.New().String()
		}

		// Inject trace ID vào context
		c.Set(TraceIDKey, traceID)

		// Thêm trace ID vào response header
		c.Response().Header().Set(TraceIDHeader, traceID)

		// Log request bắt đầu với trace ID
		global.Logger.Info("Request started",
			zap.String("trace_id", traceID),
			zap.String("method", req.Method),
			zap.String("path", req.URL.Path),
			zap.String("query", req.URL.RawQuery),
			zap.String("ip", c.RealIP()),
		)

		// Xử lý request
		err := next(c)

		// Log response hoàn thành với trace ID và thông tin chi tiết
		latency := time.Since(start)
		res := c.Response()

		global.Logger.Info("Request completed",
			zap.String("trace_id", traceID),
			zap.String("method", req.Method),
			zap.String("path", req.URL.Path),
			zap.String("query", req.URL.RawQuery),
			zap.Int("status", res.Status),
			zap.String("ip", c.RealIP()),
			zap.Duration("latency", latency),
		)

		return err
	}
}

// GetTraceID helper function để lấy trace ID từ context
func GetTraceID(c echo.Context) string {
	if traceID := c.Get(TraceIDKey); traceID != nil {
		if id, ok := traceID.(string); ok {
			return id
		}
	}
	return ""
}

// WithTraceID helper function để tạo context với trace ID
func WithTraceID(ctx context.Context, traceID string) context.Context {
	return context.WithValue(ctx, TraceIDKey, traceID)
}
