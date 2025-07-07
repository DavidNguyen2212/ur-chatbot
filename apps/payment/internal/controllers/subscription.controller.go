package controllers

import (
	"fmt"
	"net/http"
	"payment/internal/dtos"
	"payment/internal/services"
	"payment/pkg/response"
	"slices"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Inject TierService từ ngoài → dễ test, loose coupling

type SubscriptionController struct {
	subscriptionService *services.SubscriptionService
}

// Inject service từ ngoài (DI)
func NewSubscriptionController(subscriptionService *services.SubscriptionService) *SubscriptionController {
	return &SubscriptionController{
		subscriptionService: subscriptionService,
	}
}

// GET /subscriptions
func (sc *SubscriptionController) ListMySubscriptions(c *gin.Context) {
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

	subs, err := sc.subscriptionService.ListMySubscriptionTier(organizationID)
	if err != nil {
		response.ErrorResponse(c, http.StatusInternalServerError, 20012)
		return
	}

	response.SuccessResponse(c, 20000, subs)
}

// GET /subscriptions/active
func (sc *SubscriptionController) GetActiveSubscription(c *gin.Context) {
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

	sub, err := sc.subscriptionService.GetActiveSubscriptionTier(organizationID)
	if err != nil {
		response.ErrorResponse(c, http.StatusNotFound, 20013)
		return
	}

	response.SuccessResponse(c, 20000, sub)
}

func (sc *SubscriptionController) RenewSubscription(c *gin.Context) {
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

	role := userPayload.Organization.Role
	fmt.Println("Role:", role)
	if !slices.Contains([]string{"OWNER, ADMIN"}, role) {
		response.ErrorResponse(c, http.StatusForbidden, 20011)
		return
	}

	// Req body
	var req dtos.SubscriptionRenewal
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	sub, err := sc.subscriptionService.RenewSubscriptionTier(organizationID, req)
	if err != nil {
		response.ErrorResponse(c, http.StatusNotFound, 20013)
		return
	}

	response.SuccessResponse(c, 20000, sub)
}

func (sc *SubscriptionController) InitiatePayment(c *gin.Context) {
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

	var req dtos.InitiatePaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	data, err := sc.subscriptionService.InitiateSubPayment(organizationID, req, userPayload)
	if err != nil {
		response.ErrorResponse(c, http.StatusBadRequest, 2006)
	}

	response.SuccessResponse(c, http.StatusOK, data)
}

func (sc *SubscriptionController) InitiateCharge(c *gin.Context) {
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

	var req dtos.InitiateChargeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	data, err := sc.subscriptionService.InitiateCharge(organizationID, req, userPayload)
	if err != nil {
		response.ErrorResponse(c, http.StatusBadRequest, 2006)
	}

	response.SuccessResponse(c, http.StatusOK, data)
}

func (sc *SubscriptionController) CancelSubscription(c *gin.Context) {
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
	if !slices.Contains([]string{"OWNER", "ADMIN"}, userPayload.Organization.Role) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "You do not have permission to cancel this subscription."})
		return
	}

	organizationID := userPayload.Organization.ID
	if organizationID == uuid.Nil {
		response.ErrorResponse(c, http.StatusForbidden, 20011)
		return
	}

	sub, err := sc.subscriptionService.CancelSubscription(organizationID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user payload type"})
		return
	}

	response.SuccessResponse(c, http.StatusOK, sub)
}

func (sc *SubscriptionController) ReactivateSubscription(c *gin.Context) {
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
	if !slices.Contains([]string{"OWNER", "ADMIN"}, userPayload.Organization.Role) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "You do not have permission to cancel this subscription."})
		return
	}

	organizationID := userPayload.Organization.ID
	if organizationID == uuid.Nil {
		response.ErrorResponse(c, http.StatusForbidden, 20011)
		return
	}

	sub, err := sc.subscriptionService.ReactivateSubscription(organizationID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user payload type"})
		return
	}

	response.SuccessResponse(c, http.StatusOK, sub)
}
