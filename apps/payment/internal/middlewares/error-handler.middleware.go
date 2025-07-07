package middlewares

import (
	"net/http"
	"payment/global"
	"payment/pkg/response"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func ErrorHandlerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next() // xử lý request

		// nếu có lỗi phát sinh trong c.Errors
		if len(c.Errors) > 0 {
			for _, e := range c.Errors {
				global.Logger.Error("Unhandled error",
					zap.String("path", c.Request.URL.Path),
					zap.Error(e.Err),
				)
			}

			// Trả response lỗi chuẩn JSON
			// (Tuỳ bạn define logic: trả error đầu tiên hoặc tổng hợp)
			response.ErrorResponse(c, http.StatusBadGateway, 20000) // ví dụ code 20000 là "internal error"
			c.Abort()
		}
	}
}

// Trong controller/service:
// if err != nil {
// 	c.Error(err) // 👈 thêm error vào context
// 	return
// }
