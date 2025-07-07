package services

import (
	"fmt"
	"payment/global"
	"payment/internal/dtos"
	"payment/internal/models"
	"payment/internal/repositories"
	"payment/pkg/utils"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
)

type SubscriptionService struct {
	subscriptionRepo repositories.SubscriptionRepository
	paymentRepo      repositories.PaymentRepository
	chargeRepo       repositories.ChargeRepository
	tierRepo         repositories.TierRepository
}

func NewSubscriptionService(
	subscriptionRepo repositories.SubscriptionRepository,
	paymentRepo repositories.PaymentRepository,
	chargeRepo repositories.ChargeRepository,
	tierRepo repositories.TierRepository,
) *SubscriptionService {
	return &SubscriptionService{
		subscriptionRepo: subscriptionRepo,
		paymentRepo:      paymentRepo,
		chargeRepo:       chargeRepo,
		tierRepo:         tierRepo,
	}
}

func (ss *SubscriptionService) ListMySubscriptionTier(orgId uuid.UUID) ([]models.OrganizationSubscription, error) {
	return ss.subscriptionRepo.GetSubscriptionsByOrganization(orgId)
}

func (ss *SubscriptionService) GetActiveSubscriptionTier(orgId uuid.UUID) (*models.OrganizationSubscription, error) {
	result, err := ss.subscriptionRepo.GetActiveSubscription(orgId)
	if err != nil {
		// no active subscription, try to get the most recent expired one
		result, err = ss.subscriptionRepo.GetLastExpiredSubscription(orgId)
	}

	return result, err
}

func (ss *SubscriptionService) RenewSubscriptionTier(orgId uuid.UUID, req dtos.SubscriptionRenewal) (*dtos.RenewalResponse, error) {
	sub, err := ss.subscriptionRepo.GetActiveSubscription(orgId)
	if err != nil {
		// no active subscription => not found
		return nil, err
	}

	// Not allow free tier (can't renew)
	if sub.Tier.Name == models.TierFree {
		return nil, err
	}

	// Extract billing period from request
	billing_period := req.BillingPeriod
	subscription, payment_link, _ := ss.renew_subscription(orgId, sub, billing_period)

	response := &dtos.RenewalResponse{
		Success:       true,
		Message:       "Subscription renewal initiated successfully",
		Tier:          string(subscription.Tier.Name),
		BillingPeriod: string(subscription.BillingPeriod),
	}

	if payment_link != "" {
		response.PaymentLink = &payment_link
	}

	return response, nil
}

func (ss *SubscriptionService) renew_subscription(orgId uuid.UUID, sub *models.OrganizationSubscription, billing_period string) (*models.OrganizationSubscription, string, error) {
	current_tier := sub.Tier
	billing_period_to_use := billing_period
	original_billing_period := sub.BillingPeriod

	var amount uint
	if billing_period_to_use == string(models.BillingYearly) {
		amount = current_tier.PriceYearly
	} else {
		amount = current_tier.PriceMonthly // default
	}

	// If it's a paid tier, create a payment record
	if amount > 0 {
		ss.subscriptionRepo.Save(sub)
		var period_display string
		if billing_period_to_use == string(models.BillingYearly) {
			period_display = "năm"
		} else {
			period_display = "tháng"
		}

		payment, _ := ss.paymentRepo.Create(&models.Payment{
			OrganizationID: orgId,
			PaymentType:    models.PaymentTypeSubscription,
			PaymentMethod:  models.PaymentMethodPayOS,
			Amount:         amount,
			Status:         models.PaymentStatusPending,
			Description:    fmt.Sprintf("Gia hạn gói %s - %s", current_tier.GetNameDisplay(), period_display),
			Subscription:   sub,
		})

		payos_service := NewPayOSService(ss.paymentRepo, ss.subscriptionRepo, ss.chargeRepo)
		payment_link := payos_service.CreatePaymentLink(payment)
		if payment_link != nil {
			return sub, *payment_link, nil
		}
		// Revert changes if payment link creation fails
		sub.BillingPeriod = original_billing_period
		ss.subscriptionRepo.Save(sub)
		ss.paymentRepo.Delete(payment.ID)
		return sub, uuid.Nil.String(), nil
	}

	currentEnd := sub.CurrentPeriodEnd
	if currentEnd.IsZero() {
		currentEnd = time.Now()
	}

	if billing_period_to_use == "YEARLY" {
		sub.CurrentPeriodEnd = currentEnd.AddDate(0, 0, 365)
	} else {
		sub.CurrentPeriodEnd = currentEnd.AddDate(0, 0, 30)
	}
	sub.Status = models.StatusActive

	ss.subscriptionRepo.Save(sub)
	return sub, uuid.Nil.String(), nil
}

/*
InitiatePaymentProcessing initiates payment processing for various payment types.

This function handles different types of payments including subscriptions and additional charges.

Parameters:
  - organization: The organization making the payment
  - paymentData: PaymentData struct containing payment details:
  - PaymentType: SUBSCRIPTION or ADDITIONAL_CHARGE
  - TierName: String, for new subscriptions or upgrades
  - BillingPeriod: String, optional for new subscriptions
  - AdditionalUsageType: String, for new additional usage charge (AI_QUERIES, STORAGE, HUMAN_AGENTS)
  - AdditionalUsageQuantity: Integer, for new additional usage charge
  - Amount: Integer amount for payment (in VND)
  - Description: Optional payment description
  - user: The user initiating the payment

Returns:
  - PaymentResult: A struct containing:
  - Success: Boolean indicating if operation succeeded
  - Data: Map with payment details if successful
  - ErrorMessage: String with error details if unsuccessful

Example usage:

	org := &Organization{ID: "org123", Name: "Example Corp"}
	user := &User{ID: "user456", Name: "John Doe"}

	paymentData := &PaymentData{
		PaymentType:   "SUBSCRIPTION",
		TierName:      "Premium",
		BillingPeriod: "MONTHLY",
		Amount:        500000, // 500,000 VND
		Description:   "Monthly premium subscription",
	}

	result := InitiatePaymentProcessing(org, paymentData, user)
	if result.Success {
		fmt.Printf("Payment successful: %+v\n", result.Data)
	} else {
		fmt.Printf("Payment failed: %s\n", result.ErrorMessage)
	}
*/
func (ss *SubscriptionService) InitiateSubPayment(orgId uuid.UUID, req dtos.InitiatePaymentRequest, user dtos.CoolJwtPayload) (any, error) {
	// Validate input parameters
	if err := ss.validate_payment_request(req.PaymentType, &req.TierName, models.PaymentTypeSubscription); err != nil {
		return nil, err
	}

	// Normalize billing period
	billing_period := ss.normalize_billing_period(req.BillingPeriod)

	existingSub, err := ss.GetActiveSubscriptionTier(orgId)
	if err != nil {
		// No active subscription, create a new one
		return ss.createNewSubscription(orgId, req.TierName, billing_period)
	}

	//  Handle as an upgrade if there's an existing active subscription
	if existingSub.IsActive() {
		// Skip if it's the same tier
		return ss.handleSubscriptionUpgrade(orgId, existingSub, req, billing_period, user)
	}

	return nil, fmt.Errorf("Failed to Init payment")
}

func (ss *SubscriptionService) validate_payment_request(req_payment_type string, req_tier_name *string, expect_payment_type models.PaymentType) error {
	if req_payment_type != string(expect_payment_type) {
		return fmt.Errorf("invalid payment type: %s, expected: %s",
			req_payment_type, models.PaymentTypeSubscription)
	}

	if req_tier_name != nil && *req_tier_name == "" {
		return fmt.Errorf("tier name is required")
	}

	return nil
}

// normalizeBillingPeriod normalizes and validates billing period
func (ss *SubscriptionService) normalize_billing_period(period string) string {
	validPeriods := []string{"MONTHLY", "YEARLY"}
	if !slices.Contains(validPeriods, period) {
		return "MONTHLY" // Default fallback
	}
	return period
}

// createNewSubscription creates a new subscription for organization without active subscription
func (ss *SubscriptionService) createNewSubscription(orgId uuid.UUID, tierName, billingPeriod string) (any, error) {
	subscription, paymentLink, err := ss.create_subscription(orgId, tierName, billingPeriod)
	if err != nil {
		return nil, fmt.Errorf("failed to create subscription: %w", err)
	}

	payment, err := ss.paymentRepo.FindLatestPendingByOrgAndSubscription(orgId, subscription.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve payment record: %w", err)
	}

	return dtos.InitiatePaymentResponse{
		SubscriptionID: subscription.ID,
		PaymentID:      payment.ID,
		PayOSOrderID:   *payment.PayOSOrderID,
		CheckoutUrl:    paymentLink,
		Status:         string(payment.Status),
	}, nil
}

func (ss *SubscriptionService) create_subscription(orgId uuid.UUID, tier_name string, billing_period string) (*models.OrganizationSubscription, string, error) {
	tier, err := ss.getTierWithFallback(tier_name)
	if err != nil {
		return nil, "", err
	}
	// Calculate subscription period
	startDate := time.Now()
	endDate := utils.If(billing_period == string(models.BillingYearly), startDate.AddDate(1, 0, 0), startDate.AddDate(0, 1, 0))

	// Get or create subscription
	subscription, isNew, err := ss.getOrCreateSubscription(orgId, tier, startDate, endDate, billing_period)
	if err != nil {
		return nil, "", fmt.Errorf("failed to get or create subscription: %w", err)
	}

	// Log subscription operation
	ss.logSubscriptionOperation(orgId, isNew)

	// Handle payment for paid tiers
	isPaidTier := utils.If(billing_period == string(models.BillingYearly), tier.PriceYearly > 0, tier.PriceMonthly > 0)
	if isPaidTier {
		paymentLink, err := ss.createSubscriptionPayment(orgId, tier, billing_period, subscription)
		if err != nil {
			return subscription, "", fmt.Errorf("failed to create payment: %w", err)
		}
		return subscription, paymentLink, nil
	}

	// Free tier - no payment needed
	return subscription, "", nil
}

func (ss *SubscriptionService) handleSubscriptionUpgrade(
	orgId uuid.UUID,
	existingSub *models.OrganizationSubscription,
	req dtos.InitiatePaymentRequest,
	billingPeriod string,
	user dtos.CoolJwtPayload,
) (any, error) {
	// Check if trying to upgrade to same tier
	if existingSub.Tier.Name == models.TierType(req.TierName) {
		return nil, fmt.Errorf("you are already subscribed to the %s tier",
			existingSub.Tier.GetNameDisplay())
	}

	// Get target tier
	newTier, err := ss.tierRepo.FindByTiername(req.TierName)
	if err != nil {
		return nil, fmt.Errorf("tier %s not found: %w", req.TierName, err)
	}

	// Use existing billing period if not specified
	if req.BillingPeriod == "" {
		billingPeriod = string(existingSub.BillingPeriod)
	}

	// Create upgrade subscription and payment
	newSub, payment, err := ss.createUpgradeSubscription(orgId, newTier, billingPeriod, user)
	if err != nil {
		return nil, fmt.Errorf("failed to create upgrade subscription: %w", err)
	}

	// Create PayOS payment link
	paymentLink, err := ss.createPaymentLink(payment, user, existingSub.Tier.Name, newTier.Name)
	if err != nil {
		// Cleanup on failure
		ss.cleanupFailedUpgrade(newSub.ID, payment.ID)
		return nil, fmt.Errorf("failed to create payment link: %w", err)
	}

	return dtos.InitiatePaymentResponse{
		SubscriptionID: newSub.ID,
		PaymentID:      payment.ID,
		PayOSOrderID:   *payment.PayOSOrderID,
		CheckoutUrl:    *paymentLink,
		Status:         string(payment.Status),
	}, nil
}

// createUpgradeSubscription creates a new subscription and payment for upgrade
func (ss *SubscriptionService) createUpgradeSubscription(
	orgId uuid.UUID,
	newTier *models.SubscriptionTier,
	billingPeriod string,
	user dtos.CoolJwtPayload,
) (*models.OrganizationSubscription, *models.Payment, error) {
	// Calculate pricing
	price := utils.If(billingPeriod == string(models.BillingYearly), newTier.PriceYearly, newTier.PriceMonthly)

	// Calculate subscription period
	startDate := time.Now()
	endDate := utils.If(billingPeriod == string(models.BillingYearly), startDate.AddDate(1, 0, 0), startDate.AddDate(0, 1, 0))

	// Create new subscription
	newSub, err := ss.subscriptionRepo.Create(&models.OrganizationSubscription{
		OrganizationID:     orgId,
		Tier:               *newTier,
		Status:             models.StatusPending,
		CurrentPeriodStart: startDate,
		CurrentPeriodEnd:   endDate,
		BillingPeriod:      models.BillingPeriod(billingPeriod),
		AutoRenew:          true,
	})
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create subscription: %w", err)
	}

	// Create payment record
	payment, err := ss.paymentRepo.Create(&models.Payment{
		OrganizationID:   orgId,
		PaymentType:      models.PaymentTypeSubscription,
		PaymentMethod:    models.PaymentMethodPayOS,
		Amount:           uint(price),
		Subscription:     newSub,
		Status:           models.PaymentStatusPending,
		Description:      fmt.Sprintf("Nâng cấp Gói %s", newTier.GetNameDisplay()),
		InitiatingUserID: &user.UserID,
	})
	if err != nil {
		ss.subscriptionRepo.Delete(newSub.ID) // Cleanup subscription on payment creation failure
		return nil, nil, fmt.Errorf("failed to create payment: %w", err)
	}

	return newSub, payment, nil
}

// createPaymentLink creates PayOS payment link and logs the operation
func (ss *SubscriptionService) createPaymentLink(
	payment *models.Payment,
	user dtos.CoolJwtPayload,
	oldTierName, newTierName models.TierType,
) (*string, error) {
	payOsService := NewPayOSService(ss.paymentRepo, ss.subscriptionRepo, ss.chargeRepo)
	paymentLink := payOsService.CreatePaymentLink(payment)

	if paymentLink == nil {
		return nil, fmt.Errorf("PayOS service failed to create payment link")
	}

	global.Logger.Info(fmt.Sprintf(
		"Created upgrade payment link for %s, upgrading from %s to %s",
		user.Organization.Name, oldTierName, newTierName,
	))

	return paymentLink, nil
}

// cleanupFailedUpgrade removes subscription and payment records when upgrade fails
func (ss *SubscriptionService) cleanupFailedUpgrade(subscriptionID, paymentID uuid.UUID) {
	if err := ss.subscriptionRepo.Delete(subscriptionID); err != nil {
		global.Logger.Error(fmt.Sprintf("Failed to cleanup subscription %s: %v", subscriptionID, err))
	}

	if err := ss.paymentRepo.Delete(paymentID); err != nil {
		global.Logger.Error(fmt.Sprintf("Failed to cleanup payment %s: %v", paymentID, err))
	}
}

func (ss *SubscriptionService) getTierWithFallback(tierName string) (*models.SubscriptionTier, error) {
	tier, err := ss.tierRepo.FindByTiername(tierName)
	if err != nil {
		// Fallback to FREE tier
		global.Logger.Warn(fmt.Sprintf("Tier %s not found, falling back to FREE tier", tierName))

		freeTier, freeErr := ss.tierRepo.FindByTiername(string(models.TierFree))
		if freeErr != nil {
			return nil, fmt.Errorf("no subscription tiers found in the database")
		}
		return freeTier, nil
	}
	return tier, nil
}

func (ss *SubscriptionService) getOrCreateSubscription(
	orgId uuid.UUID,
	tier *models.SubscriptionTier,
	startDate, endDate time.Time,
	billingPeriod string,
) (*models.OrganizationSubscription, bool, error) {
	// Try to get existing subscription
	existingSub, err := ss.subscriptionRepo.GetActiveSubscription(orgId)
	if err != nil {
		// Create new subscription
		newSub := ss.buildNewSubscription(orgId, tier, startDate, endDate, billingPeriod)
		createdSub, createErr := ss.subscriptionRepo.Create(newSub)
		if createErr != nil {
			return nil, false, fmt.Errorf("failed to create subscription: %w", createErr)
		}
		return createdSub, true, nil
	}
	// Update existing subscription
	updatedSub := ss.updateExistingSubscription(existingSub, tier, startDate, endDate, billingPeriod)
	updatedSub, saveErr := ss.subscriptionRepo.Save(updatedSub)
	if saveErr != nil {
		return nil, false, fmt.Errorf("failed to update subscription: %w", saveErr)
	}

	return updatedSub, false, nil
}

// buildNewSubscription creates a new subscription model
func (ss *SubscriptionService) buildNewSubscription(
	orgId uuid.UUID,
	tier *models.SubscriptionTier,
	startDate, endDate time.Time,
	billingPeriod string,
) *models.OrganizationSubscription {
	status := models.StatusPending
	if tier.Name == models.TierFree {
		status = models.StatusActive
	}

	return &models.OrganizationSubscription{
		OrganizationID:     orgId,
		Tier:               *tier,
		Status:             status,
		CurrentPeriodStart: startDate,
		CurrentPeriodEnd:   endDate,
		BillingPeriod:      models.BillingPeriod(billingPeriod),
		AutoRenew:          true,
	}
}

// updateExistingSubscription updates an existing subscription with new tier and billing info
func (ss *SubscriptionService) updateExistingSubscription(
	subscription *models.OrganizationSubscription,
	tier *models.SubscriptionTier,
	startDate, endDate time.Time,
	billingPeriod string,
) *models.OrganizationSubscription {
	subscription.Tier = *tier
	subscription.BillingPeriod = models.BillingPeriod(billingPeriod)
	subscription.AutoRenew = true

	if tier.Name == models.TierFree {
		subscription.Status = models.StatusActive
		subscription.CurrentPeriodStart = startDate
		subscription.CurrentPeriodEnd = endDate
	} else {
		subscription.Status = models.StatusPending
	}

	return subscription
}

// createSubscriptionPayment creates payment record and generates payment link
func (ss *SubscriptionService) createSubscriptionPayment(
	orgId uuid.UUID,
	tier *models.SubscriptionTier,
	billingPeriod string,
	subscription *models.OrganizationSubscription,
) (string, error) {
	// Calculate amount and description
	amount, periodDisplay := utils.IfTuple(billingPeriod == string(models.BillingYearly), tier.PriceYearly, "năm", tier.PriceMonthly, "tháng")
	description := fmt.Sprintf("Gói %s - %s", tier.GetNameDisplay(), periodDisplay)

	// Create payment record
	payment, err := ss.paymentRepo.Create(&models.Payment{
		OrganizationID: orgId,
		PaymentType:    models.PaymentTypeSubscription,
		PaymentMethod:  models.PaymentMethodPayOS,
		Amount:         amount,
		Subscription:   subscription,
		Status:         models.PaymentStatusPending,
		Description:    description,
	})
	if err != nil {
		return "", fmt.Errorf("failed to create payment record: %w", err)
	}

	// Generate PayOS payment link
	paymentLink, err := ss.generatePaymentLink(payment, orgId)
	if err != nil {
		return "", fmt.Errorf("failed to generate payment link: %w", err)
	}

	return paymentLink, nil
}

// generatePaymentLink creates PayOS payment link
func (ss *SubscriptionService) generatePaymentLink(payment *models.Payment, orgId uuid.UUID) (string, error) {
	payOsService := NewPayOSService(ss.paymentRepo, ss.subscriptionRepo, ss.chargeRepo)
	paymentLink := payOsService.CreatePaymentLink(payment)

	if paymentLink == nil {
		return "", fmt.Errorf("PayOS service failed to create payment link")
	}

	global.Logger.Info(fmt.Sprintf("Created subscription payment link for %s", orgId))
	return *paymentLink, nil
}

// logSubscriptionOperation logs the subscription creation/update operation
func (ss *SubscriptionService) logSubscriptionOperation(orgId uuid.UUID, isNew bool) {
	if isNew {
		global.Logger.Info(fmt.Sprintf("Created new subscription for %s", orgId))
	} else {
		global.Logger.Info(fmt.Sprintf("Updated existing subscription for %s", orgId))
	}
}

/*
 */
func (ss *SubscriptionService) InitiateCharge(orgId uuid.UUID, req dtos.InitiateChargeRequest, user dtos.CoolJwtPayload) (any, error) {
	if err := ss.validate_payment_request(req.PaymentType, nil, models.PaymentTypeAdditionalCharge); err != nil {
		return nil, err
	}

	existingSub, err := ss.GetActiveSubscriptionTier(orgId)
	if err != nil {
		return nil, fmt.Errorf("No active subscription found")
	}

	charge, payment, payment_link, err := ss.createAdditionalUsageCharge(existingSub, req.AdditionalUsageType, req.AdditionalUsageQuantity)
	if err != nil {
		return nil, fmt.Errorf("Failed to create additional usage charge")
	}

	return dtos.InitiateChargeResponse{
		ChargeID:     charge.ID,
		PaymentID:    payment.ID,
		PayOSOrderID: *payment.PayOSOrderID,
		CheckoutUrl:  *payment_link,
		Status:       string(payment.Status),
	}, nil
}

func (ss *SubscriptionService) createAdditionalUsageCharge(existingSub *models.OrganizationSubscription, usageType string, usageQuantity int) (*models.AdditionalUsageCharge, *models.Payment, *string, error) {
	if usageType == "" || usageQuantity <= 0 {
		return nil, nil, nil, fmt.Errorf("Valid quantity is required for additional usage")
	}

	unit_price, amount, description := ss.select_charge_price(usageType, usageQuantity)

	charge, err := ss.chargeRepo.Create(&models.AdditionalUsageCharge{
		OrganizationSubscriptionID: existingSub.ID,
		ChargeType:                 models.ChargeType(usageType),
		Amount:                     uint(*amount),
		Quantity:                   uint(usageQuantity),
		UnitPrice:                  uint(*unit_price),
		Status:                     models.ChargeStatusPending,
		Description:                *description,
	})
	if err != nil {
		return nil, nil, nil, fmt.Errorf("Error create charge")
	}

	payment, err := ss.paymentRepo.Create(&models.Payment{
		OrganizationID: existingSub.OrganizationID,
		PaymentType:    models.PaymentTypeAdditionalCharge,
		PaymentMethod:  models.PaymentMethodPayOS,
		Amount:         uint(*amount),
		Status:         models.PaymentStatus(models.ChargeStatusPending),
		Description:    fmt.Sprintf("Phí %s", strings.ToLower(*description)),
	})

	payOsService := NewPayOSService(ss.paymentRepo, ss.subscriptionRepo, ss.chargeRepo)
	paymentLink := payOsService.CreatePaymentLink(payment)

	if paymentLink == nil {
		return nil, nil, nil, fmt.Errorf("PayOS service failed to create payment link")
	}

	return charge, payment, paymentLink, nil

}

func (ss *SubscriptionService) select_charge_price(usageType string, quantity int) (*int, *int, *string) {
	var unit_price, amount int
	var description string

	switch usageType {
	case string(models.ChargeTypeAIQueries):
		unit_price = AIQueryPricePer1000
		amount = quantity * unit_price
		description = fmt.Sprintf("Thêm %vK truy vấn AI", quantity)
	case string(models.ChargeTypeStorage):
		unit_price = StoragePricePerGB
		amount = quantity * unit_price
		description = fmt.Sprintf("Thêm %vK GB lưu trữ", quantity)
	case string(models.ChargeTypeHumanAgents):
		unit_price = HumanAgentPrice
		amount = quantity * unit_price
		description = fmt.Sprintf("Thêm %v nhân viên", quantity)
	default:
		return nil, nil, nil
	}

	return &unit_price, &amount, &description
}

func (ss *SubscriptionService) CancelSubscription(orgId uuid.UUID) (*models.OrganizationSubscription, error) {
	existingSub, err := ss.GetActiveSubscriptionTier(orgId)
	if err != nil {
		return nil, fmt.Errorf("No active subscription found")
	}

	existingSub.CancelAtPeriodEnd = true
	existingSub.AutoRenew = false
	global.Logger.Info(fmt.Sprintf("Subscription for %s marked for cancellation", orgId))
	return ss.subscriptionRepo.Save(existingSub)
}

func (ss *SubscriptionService) ReactivateSubscription(orgId uuid.UUID) (*models.OrganizationSubscription, error) {
	existingSub, err := ss.GetActiveSubscriptionTier(orgId)
	if err != nil {
		return nil, fmt.Errorf("No active subscription found")
	}

	existingSub.CancelAtPeriodEnd = false
	existingSub.AutoRenew = true
	global.Logger.Info(fmt.Sprintf("Subscription for %s marked for cancellation", orgId))
	return ss.subscriptionRepo.Save(existingSub)
}

func (ss *SubscriptionService) CreateFreeTrialSubscription(orgID uuid.UUID, orgName string) (*models.OrganizationSubscription, error) {
	freeTier, err := ss.tierRepo.FindByTiername(string(models.TierFree))
	if err != nil || freeTier == nil {
		return nil, fmt.Errorf("free tier not found")
	}

	// Check existing subscription
	existing, err := ss.subscriptionRepo.GetActiveSubscription(orgID)
	if err == nil && existing != nil {
		return nil, fmt.Errorf("free tier already created") // đã tồn tại
	}

	now := time.Now()
	sub := &models.OrganizationSubscription{
		OrganizationID:     orgID,
		TierID:             freeTier.ID,
		Status:             models.StatusTrial,
		CurrentPeriodStart: now,
		CurrentPeriodEnd:   now.AddDate(0, 0, 30),
		AutoRenew:          true,
	}

	return ss.subscriptionRepo.Create(sub)
}
