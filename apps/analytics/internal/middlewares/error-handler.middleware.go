package middlewares

import (
	"errors"
	"fmt"
	"net/http"
	"runtime/debug"

	"analytics/global"

	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
)

// ErrorResponse is standard output for error
// Can expand with fields: traceID, details, ... if needed
func ErrorResponse(c echo.Context, code int, message string) error {
	return c.JSON(code, map[string]any{
		"error":   message,
		"code":    code,
		"success": false,
	})
}

// Custom HTTP error handler for Echo
func CustomHTTPErrorHandler(err error, c echo.Context) {
	var (
		code    = http.StatusInternalServerError
		message = "Internal Server Error"
	)

	// Case echo.HTTPError => get its code/message
	if he, ok := err.(*echo.HTTPError); ok {
		code = he.Code
		if m, ok := he.Message.(string); ok {
			message = m
		} else {
			message = fmt.Sprintf("%v", he.Message)
		}
	} else if errors.Is(err, echo.ErrNotFound) {
		code = http.StatusNotFound
		message = "Resource not found"
	} else if err != nil {
		message = err.Error()
	}

	// Log error (log stacktrace where panic)
	if code == http.StatusInternalServerError {
		global.Logger.Error("Internal Server Error", zap.Error(err), zap.ByteString("stacktrace", debug.Stack()))
	} else {
		global.Logger.Warn("HTTP Error", zap.Error(err))
	}

	// response JSON
	if !c.Response().Committed {
		_ = ErrorResponse(c, code, message)
	}
}
