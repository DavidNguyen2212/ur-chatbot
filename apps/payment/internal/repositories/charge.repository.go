package repositories

import (
	"payment/internal/models"

	"gorm.io/gorm"
)

// Dùng interface để tách contract
// Dễ dàng inject vào service

type ChargeRepository interface {
	Create(charge *models.AdditionalUsageCharge) (*models.AdditionalUsageCharge, error)
	Save(charge *models.AdditionalUsageCharge) error
}

type chargeRepository struct {
	db *gorm.DB
}

func NewChargeRepository(db *gorm.DB) ChargeRepository {
	return &chargeRepository{db}
}

func (cr *chargeRepository) Create(charge *models.AdditionalUsageCharge) (*models.AdditionalUsageCharge, error) {
	if err := cr.db.Create(charge).Error; err != nil {
		return nil, err
	}
	return charge, nil
}

func (cr *chargeRepository) Save(charge *models.AdditionalUsageCharge) error {
	result := cr.db.Save(charge)
	return result.Error
}
