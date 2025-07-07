package controllers

import (
	"net/http"
	"payment/internal/dtos"
	"payment/internal/services"
	"payment/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Inject TierService từ ngoài → dễ test, loose coupling

type TierController struct {
	tierService *services.TierService
}

// Inject service từ ngoài (DI)
func NewTierController(tierService *services.TierService) *TierController {
	return &TierController{
		tierService: tierService,
	}
}

func (tc *TierController) ListSubscriptionTier(c *gin.Context) {
	tiers, err := tc.tierService.ListSubscriptionTier(c)
	if err != nil {
		response.ErrorResponse(c, http.StatusNotAcceptable, 20004)
		return
	}

	response.SuccessResponse(c, 20001, tiers)
}

func (tc *TierController) ListSubscriptionTierByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.ErrorResponse(c, http.StatusBadRequest, response.ErrCodeParamInvalid)
		return
	}
	tier, err := tc.tierService.GetSubscriptionTierByID(id)
	if err != nil {
		response.ErrorResponse(c, http.StatusNotAcceptable, response.ErrFetchSubscription)
		return
	}

	nameDisplay := tier.GetNameDisplay() // map "FREE" -> "Miễn phí" chẳng hạn

	result := dtos.TierResponse{
		ID:               tier.ID,
		Name:             tier.Name,
		NameDisplay:      nameDisplay,
		Description:      tier.Description,
		PriceMonthly:     tier.PriceMonthly,
		PriceYearly:      tier.PriceYearly,
		StorageLimitMB:   tier.StorageLimitMB,
		AIQueriesLimit:   tier.AIQueriesLimit,
		HumanAgentsLimit: tier.HumanAgentsLimit,
		IsActive:         tier.IsActive,
	}

	response.SuccessResponse(c, 20001, result)
}
