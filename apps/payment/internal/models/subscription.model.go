package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SubscriptionStatus string
type BillingPeriod string

const (
	StatusActive   SubscriptionStatus = "ACTIVE"
	StatusPending  SubscriptionStatus = "PENDING"
	StatusFailed   SubscriptionStatus = "FAILED"
	StatusCanceled SubscriptionStatus = "CANCELED"
	StatusTrial    SubscriptionStatus = "TRIAL"

	BillingMonthly BillingPeriod = "MONTHLY"
	BillingYearly  BillingPeriod = "YEARLY"
)

type OrganizationSubscription struct {
	ID                  uuid.UUID          `gorm:"type:uuid;primaryKey" json:"id"`
	OrganizationID      uuid.UUID          `gorm:"type:uuid;not null" json:"organization_id"`
	TierID              uuid.UUID          `gorm:"type:uuid;not null" json:"tier_id"`
	Tier                SubscriptionTier   `gorm:"foreignKey:TierID" json:"tier"`
	Status              SubscriptionStatus `gorm:"type:varchar(20);default:'ACTIVE'" json:"status"`
	BillingPeriod       BillingPeriod      `gorm:"type:varchar(10);default:'MONTHLY'" json:"billing_period"`
	CurrentPeriodStart  time.Time          `json:"current_period_start"`
	CurrentPeriodEnd    time.Time          `json:"current_period_end"`
	StorageUsedMB       uint               `gorm:"default:0" json:"storage_used_mb"`
	AIQueriesUsed       uint               `gorm:"default:0" json:"ai_queries_used"`
	AutoRenew           bool               `gorm:"default:true" json:"auto_renew"`
	CancelAtPeriodEnd   bool               `gorm:"default:false" json:"cancel_at_period_end"`
	AdditionalStorageMB uint               `gorm:"default:0" json:"additional_storage_mb"`
	AdditionalAIQueries uint               `gorm:"default:0" json:"additional_ai_queries"`
	AdditionalAgents    uint               `gorm:"default:0" json:"additional_human_agents"`
	CreatedAt           time.Time          `json:"created_at"`
	UpdatedAt           time.Time          `json:"updated_at"`
}

func (s *OrganizationSubscription) BeforeCreate(tx *gorm.DB) (err error) {
	s.ID = uuid.New()
	// default:uuid_generate_v4() could be a good idea but if we change db, e.g. mysql, it losts
	return
}

func (s *OrganizationSubscription) IsActive() bool {
	now := time.Now()
	return (s.Status == StatusActive || s.Status == StatusTrial) && s.CurrentPeriodEnd.After(now)
}

func (s *OrganizationSubscription) IsTrial() bool {
	return s.Status == StatusTrial && s.CurrentPeriodEnd.After(time.Now())
}

func (s *OrganizationSubscription) GetRemainingTrialDays() int {
	if !s.IsTrial() {
		return 0
	}
	return int(time.Until(s.CurrentPeriodEnd).Hours() / 24)
}

func (s *OrganizationSubscription) DaysUntilRenewal() int {
	if s.CancelAtPeriodEnd {
		return 0
	}
	today := time.Now().Truncate(24 * time.Hour)
	end := s.CurrentPeriodEnd.Truncate(24 * time.Hour)
	return int(end.Sub(today).Hours() / 24)
}
