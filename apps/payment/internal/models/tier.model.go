package models

import (
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type TierType string

const (
	TierFree         TierType = "FREE"
	TierStarter      TierType = "STARTER"
	TierProfessional TierType = "PROFESSIONAL"
)

type SubscriptionTier struct {
	ID               uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	Name             TierType  `gorm:"type:varchar(20);unique;not null" json:"name"` // FREE, STARTER, PROFESSIONAL
	Description      string    `gorm:"type:text" json:"description"`
	PriceMonthly     uint      `gorm:"default:0" json:"price_monthly"`
	PriceYearly      uint      `gorm:"default:0" json:"price_yearly"`
	StorageLimitMB   uint      `gorm:"default:100" json:"storage_limit_mb"`
	AIQueriesLimit   uint      `gorm:"default:500" json:"ai_queries_limit"`
	HumanAgentsLimit uint      `gorm:"default:2" json:"human_agents_limit"`
	IsActive         bool      `gorm:"default:true" json:"is_active"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

func (SubscriptionTier) TableName() string {
	return "subscription_tiers"
}

func (tier SubscriptionTier) GetNameDisplay() string {
	switch tier.Name {
	case "FREE":
		return "Miễn phí"
	case "STARTER":
		return "Khởi đầu"
	case "PROFESSIONAL":
		return "Chuyên nghiệp"
	default:
		return string(tier.Name)
	}
}

func (s *SubscriptionTier) BeforeCreate(tx *gorm.DB) (err error) {
	s.ID = uuid.New()
	// default:uuid_generate_v4() could be a good idea but if we change db, e.g. mysql, it losts
	return
}

var validTiers = map[string]bool{
	"FREE":         true,
	"STARTER":      true,
	"PROFESSIONAL": true,
}

func IsValidTier(name string) bool {
	return validTiers[strings.ToUpper(name)]
}
