package models

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ChargeType string
type ChargePaymentStatus string

const (
	// Charge Types
	ChargeTypeAIQueries   ChargeType = "AI_QUERIES"
	ChargeTypeStorage     ChargeType = "STORAGE"
	ChargeTypeHumanAgents ChargeType = "HUMAN_AGENTS"

	// Payment Status
	ChargeStatusPending ChargePaymentStatus = "PENDING"
	ChargeStatusPaid    ChargePaymentStatus = "PAID"
	ChargeStatusFailed  ChargePaymentStatus = "FAILED"
)

type AdditionalUsageCharge struct {
	ID        uuid.UUID      `json:"id" gorm:"type:uuid;primaryKey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	// Foreign Keys
	OrganizationSubscriptionID uuid.UUID `json:"organization_subscription_id" gorm:"not null;index"`

	// Charge Details
	ChargeType ChargeType `json:"charge_type" gorm:"type:varchar(20);not null"`
	Amount     uint       `json:"amount" gorm:"not null"` // Amount in VND
	Quantity   uint       `json:"quantity" gorm:"not null"`
	UnitPrice  uint       `json:"unit_price" gorm:"not null"` // Price per unit in VND

	// Status and Billing
	Status      ChargePaymentStatus `json:"status" gorm:"type:varchar(20);default:PENDING"`
	BillingDate time.Time           `json:"billing_date" gorm:"default:CURRENT_TIMESTAMP"`

	// Additional Info
	Description string `json:"description" gorm:"type:text"`

	// Relationships
	OrganizationSubscription OrganizationSubscription `json:"organization_subscription" gorm:"foreignKey:OrganizationSubscriptionID;constraint:OnDelete:CASCADE"`
	Payments                 []Payment                `json:"payments" gorm:"foreignKey:AdditionalChargeID"`
}

// TableName sets the table name
func (AdditionalUsageCharge) TableName() string {
	return "additional_usage_charges"
}

// String representation
func (auc *AdditionalUsageCharge) String() string {
	return fmt.Sprintf("%s - %d VND - %s", auc.GetChargeTypeDisplay(), auc.Amount, auc.GetStatusDisplay())
}

// Helper methods for display
func (auc *AdditionalUsageCharge) GetChargeTypeDisplay() string {
	switch auc.ChargeType {
	case ChargeTypeAIQueries:
		return "Additional AI Queries"
	case ChargeTypeStorage:
		return "Additional Storage"
	case ChargeTypeHumanAgents:
		return "Additional Human Agents"
	default:
		return string(auc.ChargeType)
	}
}

func (auc *AdditionalUsageCharge) GetStatusDisplay() string {
	switch auc.Status {
	case ChargeStatusPending:
		return "Pending"
	case ChargeStatusPaid:
		return "Paid"
	case ChargeStatusFailed:
		return "Failed"
	default:
		return string(auc.Status)
	}
}

// Validation methods
// func (auc *AdditionalUsageCharge) IsValid() bool {
// 	return auc.OrganizationSubscriptionID > 0 &&
// 		auc.Amount > 0 &&
// 		auc.Quantity > 0 &&
// 		auc.UnitPrice > 0 &&
// 		auc.ChargeType != ""
// }

// Business logic methods
func (auc *AdditionalUsageCharge) CalculateAmount() uint {
	return auc.Quantity * auc.UnitPrice
}

func (auc *AdditionalUsageCharge) IsPaid() bool {
	return auc.Status == ChargeStatusPaid
}

func (auc *AdditionalUsageCharge) IsPending() bool {
	return auc.Status == ChargeStatusPending
}

// GORM Hooks
func (auc *AdditionalUsageCharge) BeforeCreate(tx *gorm.DB) error {
	auc.ID = uuid.New()
	// Set default status if not provided
	if auc.Status == "" {
		auc.Status = ChargeStatusPending
	}

	// Set billing date if not provided
	if auc.BillingDate.IsZero() {
		auc.BillingDate = time.Now()
	}

	// Calculate amount if not provided
	if auc.Amount == 0 {
		auc.Amount = auc.CalculateAmount()
	}

	return nil
}

func (auc *AdditionalUsageCharge) BeforeUpdate(tx *gorm.DB) error {
	// Recalculate amount if quantity or unit_price changed
	if auc.Amount != auc.CalculateAmount() {
		auc.Amount = auc.CalculateAmount()
	}

	return nil
}
