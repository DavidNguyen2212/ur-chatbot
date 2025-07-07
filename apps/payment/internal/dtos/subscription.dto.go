package dtos

import (
	"time"

	"github.com/google/uuid"
)

type SubscriptionRenewal struct {
	BillingPeriod string `json:"billing_period" binding:"omitempty,oneof=monthly yearly weekly"`
}

type InitiatePaymentRequest struct {
	PaymentType   string `json:"payment_type"`
	BillingPeriod string `json:"billing_period" binding:"omitempty,oneof=monthly yearly weekly"`
	TierName      string `json:"tier_name"`
}

type InitiatePaymentResponse struct {
	SubscriptionID uuid.UUID `json:"subscription_id"`
	PaymentID      uuid.UUID `json:"payment_id"`
	PayOSOrderID   int64     `json:"payos_order_id"`
	CheckoutUrl    string    `json:"checkout_url"`
	Status         string    `json:"status"`
}

type InitiateChargeRequest struct {
	PaymentType             string `json:"payment_type"`
	AdditionalUsageQuantity int    `json:"additional_usage_quantity"`
	AdditionalUsageType     string `json:"additional_usage_type"`
}

type InitiateChargeResponse struct {
	ChargeID     uuid.UUID `json:"charge_id"`
	PaymentID    uuid.UUID `json:"payment_id"`
	PayOSOrderID int64     `json:"payos_order_id"`
	CheckoutUrl  string    `json:"checkout_url"`
	Status       string    `json:"status"`
}

type RenewalResponse struct {
	Success       bool    `json:"success"`
	Message       string  `json:"message"`
	Tier          string  `json:"tier"`
	BillingPeriod string  `json:"billing_period"`
	PaymentLink   *string `json:"payment_link,omitempty"` // * can be nil!
}

type OrganizationSubscriptionResponse struct {
	ID                        uuid.UUID    `json:"id"`
	OrganizationID            uuid.UUID    `json:"organization"`
	OrganizationName          string       `json:"organization_name"`
	Tier                      TierResponse `json:"tier"`
	TierName                  string       `json:"tier_name"`
	TierDisplay               string       `json:"tier_display"`
	TierPrice                 float64      `json:"tier_price"`
	Status                    string       `json:"status"`
	StatusDisplay             string       `json:"status_display"`
	BillingPeriod             string       `json:"billing_period"`
	BillingPeriodDisplay      string       `jsono:"billing_period_display"`
	CurrentPeriodStart        time.Time    `json:"current_period_start"`
	CurrentPeriodEnd          time.Time    `json:"current_period_end"`
	DaysUntilRenewal          int          `json:"days_until_renewal"`
	IsActive                  bool         `json:"is_active"`
	IsTrial                   bool         `json:"is_trial"`
	RemainingTrialDays        int          `json:"remaining_trial_days"`
	StorageLimit              int          `json:"storage_limit"`
	AIQueriesLimit            int          `json:"ai_queries_limit"`
	HumanAgentsLimit          int          `json:"human_agents_limit"`
	StorageUsedMB             uint         `json:"storage_used_mb"`
	StorageUsedPercentage     int          `json:"storage_used_percentage"`
	AIQueriesUsed             uint         `json:"ai_queries_used"`
	AIQueriesUsedPercentage   int          `json:"ai_queries_used_percentage"`
	HumanAgentsCount          int          `json:"human_agents_count"`
	HumanAgentsUsedPercentage int          `json:"human_agents_used_percentage"`
	AdditionalStorageMB       uint         `json:"additional_storage_mb"`
	AdditionalAIQueries       uint         `json:"additional_ai_queries"`
	AdditionalAgents          uint         `json:"additional_human_agents"`
	TotalStorageLimit         int          `json:"total_storage_limit"`
	TotalAIQueriesLimit       int          `json:"total_ai_queries_limit"`
	TotalHumanAgentsLimit     int          `json:"total_human_agents_limit"`
	AutoRenew                 bool         `json:"auto_renew"`
	CancelAtPeriodEnd         bool         `json:"cancel_at_period_end"`
	CreatedAt                 time.Time    `json:"created_at"`
	UpdatedAt                 time.Time    `json:"updated_at"`
}

// func MapSubscriptionToResponse(sub *models.OrganizationSubscription, tierDTO SubscriptionTierDTO, orgName string, humanAgentsCount int) OrganizationSubscriptionResponse {
// 	totalStorage := sub.GetTotalStorageLimit()
// 	totalAI := sub.GetTotalAIQueriesLimit()
// 	totalAgents := sub.GetTotalHumanAgentsLimit()

// 	return OrganizationSubscriptionResponse{
// 		ID:               sub.ID,
// 		OrganizationID:   sub.OrganizationID,
// 		OrganizationName: orgName,
// 		Tier:             tierDTO,
// 		TierName:         sub.Tier.Name,
// 		TierDisplay:      sub.Tier.NameDisplay,
// 		TierPrice: func() float64 {
// 			if sub.BillingPeriod == models.BillingYearly {
// 				return sub.Tier.PriceYearly
// 			}
// 			return sub.Tier.PriceMonthly
// 		}(),
// 		Status:               string(sub.Status),
// 		StatusDisplay:        string(sub.Status), // TODO: map if needed
// 		BillingPeriod:        string(sub.BillingPeriod),
// 		BillingPeriodDisplay: string(sub.BillingPeriod), // TODO: map if needed
// 		CurrentPeriodStart:   sub.CurrentPeriodStart,
// 		CurrentPeriodEnd:     sub.CurrentPeriodEnd,
// 		DaysUntilRenewal:     sub.DaysUntilRenewal(),
// 		IsActive:             sub.IsActive(),
// 		IsTrial:              sub.IsTrial(),
// 		RemainingTrialDays:   sub.GetRemainingTrialDays(),
// 		StorageLimit:         totalStorage,
// 		AIQueriesLimit:       totalAI,
// 		HumanAgentsLimit:     totalAgents,
// 		StorageUsedMB:        sub.StorageUsedMB,
// 		StorageUsedPercentage: func() int {
// 			if totalStorage == 0 {
// 				return 0
// 			}
// 			return min(100, int(float64(sub.StorageUsedMB)/float64(totalStorage)*100))
// 		}(),
// 		AIQueriesUsed: sub.AIQueriesUsed,
// 		AIQueriesUsedPercentage: func() int {
// 			if totalAI == 0 {
// 				return 0
// 			}
// 			return min(100, int(float64(sub.AIQueriesUsed)/float64(totalAI)*100))
// 		}(),
// 		HumanAgentsCount: humanAgentsCount,
// 		HumanAgentsUsedPercentage: func() int {
// 			if totalAgents == 0 {
// 				return 0
// 			}
// 			return min(100, int(float64(humanAgentsCount)/float64(totalAgents)*100))
// 		}(),
// 		AdditionalStorageMB:   sub.AdditionalStorageMB,
// 		AdditionalAIQueries:   sub.AdditionalAIQueries,
// 		AdditionalAgents:      sub.AdditionalAgents,
// 		TotalStorageLimit:     totalStorage,
// 		TotalAIQueriesLimit:   totalAI,
// 		TotalHumanAgentsLimit: totalAgents,
// 		AutoRenew:             sub.AutoRenew,
// 		CancelAtPeriodEnd:     sub.CancelAtPeriodEnd,
// 		CreatedAt:             sub.CreatedAt,
// 		UpdatedAt:             sub.UpdatedAt,
// 	}
// }
