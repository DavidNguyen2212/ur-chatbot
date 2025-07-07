package repositories

import (
	"payment/internal/models"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Dùng interface để tách contract
// Dễ dàng inject vào service

type SubscriptionRepository interface {
	GetSubscriptionsByOrganization(orgID uuid.UUID) ([]models.OrganizationSubscription, error)
	GetActiveSubscription(orgID uuid.UUID) (*models.OrganizationSubscription, error)
	GetLastExpiredSubscription(orgID uuid.UUID) (*models.OrganizationSubscription, error)
	Save(obj *models.OrganizationSubscription) (*models.OrganizationSubscription, error)
	Create(obj *models.OrganizationSubscription) (*models.OrganizationSubscription, error)
	Delete(obj uuid.UUID) error
}

type subscriptionRepository struct {
	db *gorm.DB
}

func NewSubscriptionRepository(db *gorm.DB) SubscriptionRepository {
	return &subscriptionRepository{db}
}

// Lấy tất cả subscription của 1 tổ chức (sorted mới nhất -> cũ)
func (sr *subscriptionRepository) GetSubscriptionsByOrganization(orgID uuid.UUID) ([]models.OrganizationSubscription, error) {
	var subs []models.OrganizationSubscription
	err := sr.db.
		Preload("Tier").
		Where("organization_id = ?", orgID).
		Order("current_period_start DESC").
		Find(&subs).Error
	if err != nil {
		return nil, err
	}
	return subs, nil
}

// Lấy subscription ACTIVE hoặc TRIAL gần nhất
func (sr *subscriptionRepository) GetActiveSubscription(orgID uuid.UUID) (*models.OrganizationSubscription, error) {
	var sub models.OrganizationSubscription
	err := sr.db.
		Preload("Tier").
		Where("organization_id = ? AND status IN ? AND current_period_end >= ?", orgID, []string{"ACTIVE", "TRIAL"}, time.Now()).
		Order("current_period_start DESC").
		First(&sub).Error
	if err != nil {
		return nil, err
	}
	return &sub, nil
}

func (sr *subscriptionRepository) GetLastExpiredSubscription(orgID uuid.UUID) (*models.OrganizationSubscription, error) {
	var sub models.OrganizationSubscription
	err := sr.db.
		Preload("Tier").
		Where("organization_id = ? AND status = ? AND current_period_end < ?", orgID, "CANCELED", time.Now()).
		Order("current_period_start DESC").
		First(&sub).Error
	if err != nil {
		return nil, err
	}
	return &sub, nil
}

func (sr *subscriptionRepository) Save(obj *models.OrganizationSubscription) (*models.OrganizationSubscription, error) {
	if err := sr.db.Save(obj).Error; err != nil {
		return nil, err
	}

	return obj, nil
}

func (pr *subscriptionRepository) Create(sub *models.OrganizationSubscription) (*models.OrganizationSubscription, error) {
	if err := pr.db.Create(sub).Error; err != nil {
		return nil, err
	}
	return sub, nil
}

func (pr *subscriptionRepository) Delete(subID uuid.UUID) error {
	return pr.db.Delete(&models.OrganizationSubscription{}, subID).Error
}
