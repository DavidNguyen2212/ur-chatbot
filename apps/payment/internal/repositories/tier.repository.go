package repositories

import (
	"payment/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Dùng interface để tách contract
// Dễ dàng inject vào service

type TierRepository interface {
	FindByID(id uuid.UUID) (*models.SubscriptionTier, error)
	FindAll() ([]models.SubscriptionTier, error)
	FindAllActiveTiers() ([]models.SubscriptionTier, error)
	FindByTiername(tier_name string) (*models.SubscriptionTier, error)
}

type tierRepository struct {
	db *gorm.DB
}

func NewTierRepository(db *gorm.DB) TierRepository {
	return &tierRepository{db}
}

func (tr *tierRepository) FindAll() ([]models.SubscriptionTier, error) {
	var tiers []models.SubscriptionTier
	if err := tr.db.Find(&tiers).Error; err != nil {
		return nil, err
	}
	return tiers, nil
}

func (tr *tierRepository) FindAllActiveTiers() ([]models.SubscriptionTier, error) {
	var tiers []models.SubscriptionTier
	err := tr.db.Where("is_active = ?", true).Find(&tiers).Error
	return tiers, err
}

func (tr *tierRepository) FindByID(id uuid.UUID) (*models.SubscriptionTier, error) {
	var tier models.SubscriptionTier
	if err := tr.db.First(&tier, id).Error; err != nil {
		return nil, err
	}
	return &tier, nil
}

func (tr *tierRepository) FindByTiername(tier_name string) (*models.SubscriptionTier, error) {
	var tier models.SubscriptionTier
	if err := tr.db.Where("name = ?", tier_name).First(&tier).Error; err != nil {
		return nil, err
	}
	return &tier, nil
}
