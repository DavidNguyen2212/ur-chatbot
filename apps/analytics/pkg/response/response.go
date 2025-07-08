package response

import (
	"net/http"

	echo "github.com/labstack/echo/v4"
)

type ResponseData struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data"`
}

func SuccessResponse(c echo.Context, code int, data any) error {
	return c.JSON(http.StatusOK, ResponseData{
		Code:    code,
		Message: Msg[code],
		Data:    data,
	})
}

func ErrorResponse(c echo.Context, statusCode int, errorCode int) error {
	return c.JSON(statusCode, ResponseData{
		Code:    errorCode,
		Message: Msg[errorCode],
		Data:    nil,
	})
}
