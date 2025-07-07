package services

import (
	"fmt"
	"payment/internal/models"
	"payment/internal/repositories"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type TierService struct {
	tierRepo repositories.TierRepository
}

func NewTierService(repo repositories.TierRepository) *TierService {
	return &TierService{repo}
}

func (ts *TierService) ListSubscriptionTier(c *gin.Context) ([]models.SubscriptionTier, error) {
	return ts.tierRepo.FindAllActiveTiers()
}

func (ts *TierService) GetSubscriptionTierByID(id uuid.UUID) (*models.SubscriptionTier, error) {
	// parse id safely
	fmt.Println(id)
	return ts.tierRepo.FindByID(id) // giả sử bạn có hàm parse uint
}
