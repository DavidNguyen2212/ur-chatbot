package dtos

import (
	"fmt"
	"time"
)

/*
DTO for MonthlySubscriptionSummary
*/
type GetMonthlySubscriptionSummaryQuery struct {
	BaseQuery
	OrganizationID string `query:"organization"`
	MonthExact     string `query:"month"`
	MonthGte       string `query:"month__gte"`
	MonthLte       string `query:"month__lte"`
}

func (g *GetMonthlySubscriptionSummaryQuery) ValidateMonthFormats() error {
	months := []string{g.MonthExact, g.MonthGte, g.MonthLte}
	for _, m := range months {
		if m == "" {
			continue
		}
		_, err := time.Parse("2006-01", m)
		if err != nil {
			return fmt.Errorf("invalid month format: %s", m)
		}
	}
	return nil
}

type MonthlySubscriptionSummaryResponse struct {
	Count    int32                           `json:"count"`
	Next     string                          `json:"next"`
	Previous string                          `json:"previous"`
	Results  []MonthlySubscriptionSummaryDTO `json:"results"`
}

type MonthlySubscriptionSummaryDTO struct {
	OrganizationID           string  `json:"organization"`
	Month                    string  `json:"month"`
	NewSubscriptionThisMonth int32   `json:"new_subscriptions_this_month"`
	ActiveSubscriptions      int32   `json:"active_subscriptions"`
	TrialSubscriptions       int32   `json:"trial_subscriptions"`
	CanceledSubscriptions    int32   `json:"canceled_subscriptions"`
	MonthlyRevenue           float64 `json:"monthly_revenue"`
	TrialConversionRate      float64 `json:"trial_conversion_rate"`
}

type GetMonthlyPaymentsReportQuery struct {
	BaseQuery
	OrganizationID string `query:"organization"`
	MonthExact     string `query:"month"`
	MonthGte       string `query:"month__gte"`
	MonthLte       string `query:"month__lte"`
}

func (q *GetMonthlyPaymentsReportQuery) ValidateMonthFormats() error {
	months := []string{q.MonthExact, q.MonthGte, q.MonthLte}
	for _, m := range months {
		if m == "" {
			continue
		}
		if _, err := time.Parse("2006-01", m); err != nil {
			return fmt.Errorf("invalid month format: %s", m)
		}
	}
	return nil
}

type MonthlyPaymentsReportDTO struct {
	Month                     string `json:"month"`
	TotalPayments             int32  `json:"total_payments"`
	TotalAmount               int64  `json:"total_amount"`
	SubscriptionPayments      int32  `json:"subscription_payments"`
	SubscriptionAmount        int64  `json:"subscription_amount"`
	AdditionalChargePayments  int32  `json:"additional_charge_payments"`
	AdditionalChargeAmount    int64  `json:"additional_charge_amount"`
	MonthlySubscriptionAmount int64  `json:"monthly_subscription_amount"`
	YearlySubscriptionAmount  int64  `json:"yearly_subscription_amount"`
	CompletedPayments         int32  `json:"completed_payments"`
	CompletedAmount           int64  `json:"completed_amount"`
	PendingPayments           int32  `json:"pending_payments"`
	FailedPayments            int32  `json:"failed_payments"`
	RefundedPayments          int32  `json:"refunded_payments"`
	PayosPaymentAmount        int64  `json:"payos_payment_amount"`
	BankTransferAmount        int64  `json:"bank_transfer_amount"`
	CreditCardAmount          int64  `json:"credit_card_amount"`
}

type MonthlyPaymentsReportResponse struct {
	Count    int32                      `json:"count"`
	Next     string                     `json:"next"`
	Previous string                     `json:"previous"`
	Results  []MonthlyPaymentsReportDTO `json:"results"`
}

type GetOrganizationUsageSnapshotQuery struct {
	BaseQuery
	ID   string   `query:"id"`
	IDIn []string `query:"id__in"`
}

type OrganizationUsageSnapshotDTO struct {
	ID                  string  `json:"id"`
	Name                string  `json:"name"`
	StorageUsedMB       int32   `json:"storage_used_mb"`
	StorageLimitMB      int32   `json:"storage_limit_mb"`
	StorageUsagePercent float32 `json:"storage_usage_percent"`
	DocumentCount       int32   `json:"document_count"`
	HumanAgentCount     int32   `json:"human_agent_count"`
	AIQueriesUsed       int32   `json:"ai_queries_used"`
	AIQueriesLimit      int32   `json:"ai_queries_limit"`
	AIUsagePercent      float32 `json:"ai_usage_percent"`
	SubscriptionTier    string  `json:"subscription_tier"`
	SubscriptionStatus  string  `json:"subscription_status"`
}

type OrganizationUsageSnapshotResponse struct {
	Count    int32                          `json:"count"`
	Next     string                         `json:"next"`
	Previous string                         `json:"previous"`
	Results  []OrganizationUsageSnapshotDTO `json:"results"`
}
