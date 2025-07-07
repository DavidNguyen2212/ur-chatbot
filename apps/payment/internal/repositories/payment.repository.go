package repositories

import (
	"errors"
	"payment/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Dùng interface để tách contract
// Dễ dàng inject vào service

type PaymentRepository interface {
	Create(payment *models.Payment) (*models.Payment, error)
	FindByPayOSOrderID(orderID int64) (*models.Payment, error)
	Save(payment *models.Payment) error
	HasOtherValidPayments(subscriptionID uuid.UUID, excludeID uuid.UUID) (bool, error)
	HasOtherValidChargePayments(subscriptionID uuid.UUID, excludeID uuid.UUID) (bool, error)
	Delete(paymentID uuid.UUID) error
	FindPaymentsByOrg(orgID uuid.UUID) ([]models.Payment, error)
	FindLatestPendingByOrgAndSubscription(orgID uuid.UUID, subID uuid.UUID) (*models.Payment, error)
}

type paymentRepository struct {
	db *gorm.DB
}

func NewPaymentRepository(db *gorm.DB) PaymentRepository {
	return &paymentRepository{db}
}

func (pr *paymentRepository) Create(payment *models.Payment) (*models.Payment, error) {
	if err := pr.db.Create(payment).Error; err != nil {
		return nil, err
	}
	return payment, nil
}

func (pr *paymentRepository) FindByPayOSOrderID(orderID int64) (*models.Payment, error) {
	var payment models.Payment
	if err := pr.db.Preload("Subscription").
		Where("payos_order_id = ?", orderID).
		First(&payment).Error; err != nil {
		return nil, err
	}
	return &payment, nil
}

func (pr *paymentRepository) Save(payment *models.Payment) error {
	result := pr.db.Save(payment)
	return result.Error
}

func (pr *paymentRepository) HasOtherValidPayments(subscriptionID uuid.UUID, excludeID uuid.UUID) (bool, error) {
	var exists bool
	err := pr.db.Model(&models.Payment{}).
		Where("subscription_id = ? AND status IN ? AND id != ?", subscriptionID, []string{"COMPLETED", "PENDING"}, excludeID).
		Select("count(*) > 0").
		Find(&exists).Error
	return exists, err
}

func (pr *paymentRepository) HasOtherValidChargePayments(chargeID uuid.UUID, excludeID uuid.UUID) (bool, error) {
	var exists bool
	err := pr.db.Model(&models.Payment{}).
		Where("additional_charge_id = ? AND status IN ? AND id != ?", chargeID, []string{"COMPLETED", "PENDING"}, excludeID).
		Select("count(*) > 0").
		Find(&exists).Error
	return exists, err
}

func (pr *paymentRepository) Delete(paymentID uuid.UUID) error {
	return pr.db.Delete(&models.Payment{}, paymentID).Error
}

func (pr *paymentRepository) FindPaymentsByOrg(orgID uuid.UUID) ([]models.Payment, error) {
	var payments []models.Payment
	err := pr.db.Where("organization_id = ?", orgID).Order("created_at DESC").Find(&payments).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil // không có kết quả nào
		}
		return nil, err
	}

	return payments, nil
}
func (pr *paymentRepository) FindLatestPendingByOrgAndSubscription(orgID uuid.UUID, subID uuid.UUID) (*models.Payment, error) {
	var payment models.Payment
	err := pr.db.
		Where("organization_id = ? AND subscription_id = ? AND status = ?", orgID, subID, models.PaymentStatusPending).
		Order("created_at DESC").
		First(&payment).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil // không có kết quả nào
		}
		return nil, err
	}

	return &payment, nil
}
