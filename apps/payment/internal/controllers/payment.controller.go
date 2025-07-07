package controllers

import (
	"fmt"
	"net/http"
	"payment/internal/dtos"
	"payment/internal/services"
	"payment/pkg/response"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/payOSHQ/payos-lib-golang"
)

type PaymentController struct {
	paymentService *services.PaymentService
}

// Inject service từ ngoài (DI)
func NewPaymentController(paymentService *services.PaymentService) *PaymentController {
	return &PaymentController{
		paymentService: paymentService,
	}
}

// GET /subscriptions
func (pc *PaymentController) ListPayments(c *gin.Context) {
	userClaims, exists := c.Get("user")
	if !exists {
		response.ErrorResponse(c, http.StatusUnauthorized, 20010) // custom code bạn định nghĩa
		return
	}

	userPayload, ok := userClaims.(dtos.CoolJwtPayload)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user payload type"})
		return
	}

	organizationID := userPayload.Organization.ID
	if organizationID == uuid.Nil {
		response.ErrorResponse(c, http.StatusForbidden, 20011)
		return
	}

	subs, err := pc.paymentService.ListMyPayments(organizationID)
	if err != nil {
		response.ErrorResponse(c, http.StatusInternalServerError, 20012)
		return
	}

	response.SuccessResponse(c, 20000, subs)
}

func (pc *PaymentController) CancelPayment(c *gin.Context) {
	orderIDStr := c.Param("id")
	orderID, err := strconv.ParseInt(orderIDStr, 10, 64)
	if err != nil {
		response.ErrorResponse(c, http.StatusBadRequest, 20013)
		return
	}

	userClaims, exists := c.Get("user")
	if !exists {
		response.ErrorResponse(c, http.StatusUnauthorized, 20010) // custom code bạn định nghĩa
		return
	}

	userPayload, ok := userClaims.(dtos.CoolJwtPayload)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user payload type"})
		return
	}

	organizationID := userPayload.Organization.ID
	if organizationID == uuid.Nil {
		response.ErrorResponse(c, http.StatusForbidden, 20011)
		return
	}

	subs, err := pc.paymentService.CancelPayment(organizationID, orderID)
	if err != nil {
		response.ErrorResponse(c, http.StatusInternalServerError, 20012)
		return
	}

	response.SuccessResponse(c, 20000, subs)
}

func (pc *PaymentController) WebhookHandler(c *gin.Context) {
	var req payos.WebhookDataType
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.OrderCode == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Errorf("Missing orderCode in PayOS webhook")})
		return
	}

	result, err := pc.paymentService.HandleWebhook(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Errorf("Missing orderCode in PayOS webhook")})
		return
	}

	response.SuccessResponse(c, 20000, result)
}
