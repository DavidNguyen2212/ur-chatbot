package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PaymentType string
type PaymentMethod string
type PaymentStatus string

const (
	// Payment Types
	PaymentTypeSubscription     PaymentType = "SUBSCRIPTION"
	PaymentTypeAdditionalCharge PaymentType = "ADDITIONAL_CHARGE"

	// Payment Methods
	PaymentMethodPayOS        PaymentMethod = "PAYOS"
	PaymentMethodBankTransfer PaymentMethod = "BANK_TRANSFER"
	PaymentMethodCreditCard   PaymentMethod = "CREDIT_CARD"

	// Payment Status
	PaymentStatusPending   PaymentStatus = "PENDING"
	PaymentStatusCompleted PaymentStatus = "COMPLETED"
	PaymentStatusFailed    PaymentStatus = "FAILED"
	PaymentStatusRefunded  PaymentStatus = "REFUNDED"
)

type Payment struct {
	ID        uuid.UUID      `json:"id" gorm:"type:uuid;primaryKey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"deleted_at" gorm:"index"`

	// Foreign Keys
	OrganizationID   uuid.UUID  `json:"organization_id" gorm:"not null;index"`
	InitiatingUserID *uuid.UUID `json:"initiating_user_id" gorm:"index"`

	// Payment Details
	PaymentType   PaymentType   `json:"payment_type" gorm:"type:varchar(20);not null"`
	PaymentMethod PaymentMethod `json:"payment_method" gorm:"type:varchar(20);not null"`
	Amount        uint          `json:"amount" gorm:"not null"` // Amount in VND

	// Optional Related Models
	SubscriptionID     *uuid.UUID `json:"subscription_id" gorm:"index"`
	AdditionalChargeID *uuid.UUID `json:"additional_charge_id" gorm:"index"`

	// Payment Processing Details
	Status      PaymentStatus `json:"status" gorm:"type:varchar(20);default:PENDING"`
	PaymentDate *time.Time    `json:"payment_date"`

	// PayOS Specific Fields
	PayOSTransactionID *string `json:"payos_transaction_id" gorm:"type:varchar(255)"`
	PayOSOrderID       *int64  `json:"payos_order_id" gorm:"type:varchar(255)"`
	PayOSPaymentLink   *string `json:"payos_payment_link" gorm:"type:varchar(512)"`

	// Additional Fields
	InvoiceNumber *string `json:"invoice_number" gorm:"type:varchar(50)"`
	Description   string  `json:"description" gorm:"type:text"`

	Subscription     *OrganizationSubscription `json:"subscription" gorm:"foreignKey:SubscriptionID;constraint:OnDelete:SET NULL"`
	AdditionalCharge *AdditionalUsageCharge    `json:"additional_charge" gorm:"foreignKey:AdditionalChargeID;constraint:OnDelete:SET NULL"`
}

// TableName sets the table name
func (Payment) TableName() string {
	return "payments"
}

// String representation
// func (p *Payment) String() string {
// 	return fmt.Sprintf("%s - %d VND - %s", p.Organization.Name, p.Amount, p.Status)
// }

// Helper methods for status display
func (p *Payment) GetStatusDisplay() string {
	switch p.Status {
	case PaymentStatusPending:
		return "Pending"
	case PaymentStatusCompleted:
		return "Completed"
	case PaymentStatusFailed:
		return "Failed"
	case PaymentStatusRefunded:
		return "Refunded"
	default:
		return string(p.Status)
	}
}

// Validation methods
// func (p *Payment) IsValid() bool {
// 	return p.OrganizationID > 0 &&
// 		p.Amount > 0 &&
// 		p.PaymentType != "" &&
// 		p.PaymentMethod != ""
// }

// GORM Hooks
func (p *Payment) BeforeCreate(tx *gorm.DB) error {
	// Set default status if not provided
	if p.Status == "" {
		p.Status = PaymentStatusPending
	}
	return nil
}
