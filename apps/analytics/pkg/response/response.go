package response

import (
	"net/http"
	"time"

	echo "github.com/labstack/echo/v4"
)

// Development format (hiện tại)
type ResponseData struct {
	Code    int    `json:"code" example:"20001"`
	Message string `json:"message" example:"invalid query params"`
	Data    any    `json:"data"`
}

// Production format với mã lỗi riêng
type ProductionResponseData struct {
	Code      string    `json:"code" example:"AUTH_001"`
	Message   string    `json:"message" example:"Invalid authentication token"`
	Data      any       `json:"data"`
	Timestamp time.Time `json:"timestamp"`
	TraceID   string    `json:"trace_id,omitempty"`
}

// Error codes cho production
const (
	// Authentication errors
	ErrCodeAuthInvalidToken = "AUTH_001"
	ErrCodeAuthExpiredToken = "AUTH_002"
	ErrCodeAuthMissingToken = "AUTH_003"

	// Database errors
	ErrCodeDBConnectionFailed  = "DB_001"
	ErrCodeDBQueryFailed       = "DB_002"
	ErrCodeDBTransactionFailed = "DB_003"

	// Validation errors
	ErrCodeValidationRequired = "VAL_001"
	ErrCodeValidationInvalid  = "VAL_002"
	ErrCodeValidationFormat   = "VAL_003"

	// Business logic errors
	ErrCodeRateLimitExceeded = "RATE_001"
	ErrCodeResourceNotFound  = "RES_001"
	ErrCodePermissionDenied  = "PERM_001"

	// External service errors
	ErrCodeChatServiceUnavailable    = "EXT_CHAT_001"
	ErrCodePaymentServiceUnavailable = "EXT_PAY_001"

	// Internal errors
	ErrCodeInternalServer = "INT_001"
)

// Error messages (có thể mở rộng cho i18n)
var errorMessages = map[string]string{
	ErrCodeAuthInvalidToken:          "Invalid authentication token",
	ErrCodeAuthExpiredToken:          "Authentication token has expired",
	ErrCodeAuthMissingToken:          "Authentication token is required",
	ErrCodeDBConnectionFailed:        "Database connection failed",
	ErrCodeDBQueryFailed:             "Database query failed",
	ErrCodeDBTransactionFailed:       "Database transaction failed",
	ErrCodeValidationRequired:        "Required field is missing",
	ErrCodeValidationInvalid:         "Invalid field value",
	ErrCodeValidationFormat:          "Invalid data format",
	ErrCodeRateLimitExceeded:         "Rate limit exceeded",
	ErrCodeResourceNotFound:          "Resource not found",
	ErrCodePermissionDenied:          "Permission denied",
	ErrCodeChatServiceUnavailable:    "Chat service is temporarily unavailable",
	ErrCodePaymentServiceUnavailable: "Payment service is temporarily unavailable",
	ErrCodeInternalServer:            "Internal server error",
}

// Development functions (giữ nguyên)
func SuccessResponse(c echo.Context, data any) error {
	return c.JSON(http.StatusOK, ResponseData{
		Code:    http.StatusOK,
		Message: "Success",
		Data:    data,
	})
}

func ErrorResponse(c echo.Context, statusCode int, message string) error {
	return c.JSON(statusCode, ResponseData{
		Code:    statusCode,
		Message: message,
		Data:    nil,
	})
}

// Production functions
func ProductionSuccessResponse(c echo.Context, data any) error {
	traceID := getTraceID(c)

	response := ProductionResponseData{
		Code:      "SUCCESS",
		Message:   "Operation completed successfully",
		Data:      data,
		Timestamp: time.Now(),
	}

	if traceID != "" {
		response.TraceID = traceID
	}

	return c.JSON(http.StatusOK, response)
}

func ProductionErrorResponse(c echo.Context, statusCode int, errorCode string) error {
	message, exists := errorMessages[errorCode]
	if !exists {
		message = "Unknown error occurred"
	}

	traceID := getTraceID(c)

	response := ProductionResponseData{
		Code:      errorCode,
		Message:   message,
		Data:      nil,
		Timestamp: time.Now(),
	}

	if traceID != "" {
		response.TraceID = traceID
	}

	return c.JSON(statusCode, response)
}

// Helper function để lấy trace ID từ context (nếu có)
func getTraceID(c echo.Context) string {
	if traceID := c.Get("trace_id"); traceID != nil {
		if id, ok := traceID.(string); ok {
			return id
		}
	}
	return ""
}
