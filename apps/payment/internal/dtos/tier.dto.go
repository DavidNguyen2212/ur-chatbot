package dtos

import (
	"payment/internal/models"

	"github.com/google/uuid"
)

type TierResponse struct {
	ID               uuid.UUID       `json:"id"`
	Name             models.TierType `json:"name"`
	NameDisplay      string          `json:"name_display"`
	Description      string          `json:"description"`
	PriceMonthly     uint            `json:"price_monthly"`
	PriceYearly      uint            `json:"price_yearly"`
	StorageLimitMB   uint            `json:"storage_limit_mb"`
	AIQueriesLimit   uint            `json:"ai_queries_limit"`
	HumanAgentsLimit uint            `json:"human_agents_limit"`
	IsActive         bool            `json:"is_active"`
}
