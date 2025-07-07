package services

import (
	"fmt"
	"math/rand"
	"payment/global"
	"payment/internal/models"
	"payment/internal/repositories"
	"payment/pkg/utils"
	"strconv"
	"strings"
	"time"

	payosLib "github.com/payOSHQ/payos-lib-golang"
)

type PayOSService struct {
	paymentRepo      repositories.PaymentRepository
	subscriptionRepo repositories.SubscriptionRepository
	chargeRepo       repositories.ChargeRepository
}

func NewPayOSService(paymentRepo repositories.PaymentRepository, subscriptionRepo repositories.SubscriptionRepository, chargeRepo repositories.ChargeRepository) *PayOSService {
	return &PayOSService{
		paymentRepo:      paymentRepo,
		subscriptionRepo: subscriptionRepo,
		chargeRepo:       chargeRepo,
	}
}

const (
	AIQueryPricePer1000 = 2000 // 300,000 VND per 1,000 queries
	StoragePricePerGB   = 2000 // 400,000 VND per GB per month
	HumanAgentPrice     = 2000 // 300,000 VND per additional agent per month
)

func (ps *PayOSService) generateOrderID() int64 {
	timestamp := time.Now().Unix()
	random := rand.Intn(100000)
	orderIDStr := fmt.Sprintf("%d%05d", timestamp, random)
	orderID, _ := strconv.ParseInt(orderIDStr, 10, 64)
	return orderID
}

func (ps *PayOSService) createDescription(payment *models.Payment) string {
	switch payment.PaymentType {
	case models.PaymentTypeSubscription:
		// we shoud fetch organizion name from user service or
		// get from token
		description := fmt.Sprintf("Gói %s", payment.OrganizationID)
		if payment.SubscriptionID != nil {
			// You would fetch subscription details here
			tier_name := payment.Subscription.Tier.GetNameDisplay()
			period_type := "Tháng"
			if payment.Subscription.BillingPeriod != "" {
				period_type = string(payment.Subscription.BillingPeriod)
			}
			description = fmt.Sprintf("Gói %s - %s", tier_name, period_type)
		}
		return description
	case models.PaymentTypeAdditionalCharge:
		description := "Phí phát sinh"
		if payment.AdditionalChargeID != nil {
			charge_type := payment.AdditionalCharge.GetChargeTypeDisplay()
			description = fmt.Sprintf("Phí %s", charge_type)
		}
		return description
	default:
		return "Thanh toán"
	}
}

func (ps *PayOSService) CreatePaymentLink(payment *models.Payment) *string {
	orderID := ps.generateOrderID()
	description := ps.createDescription(payment)
	item := payosLib.Item{
		Name:     utils.Truncate(description, 25),
		Quantity: 1,
		Price:    int(payment.Amount),
	}

	expiredAt := int(time.Now().Add(24 * time.Hour).Unix())
	paymentData := payosLib.CheckoutRequestType{
		OrderCode:   orderID,
		Amount:      int(payment.Amount),
		Description: utils.Truncate(description, 25),
		Items: []payosLib.Item{
			item,
		},
		CancelUrl: fmt.Sprintf("%s/payment/cancel", global.Config.Frontend.URL),
		ReturnUrl: fmt.Sprintf("%s/payment/success", global.Config.Frontend.URL),
		ExpiredAt: &expiredAt,
	}

	contact_email := "abc" // Call user_service to get 4 thông tin dưới
	orgName := "abc"
	orgPhone := "abc"
	orgBuyerAddress := "abc"
	if contact_email != "" {
		paymentData.BuyerName = &orgName
		paymentData.BuyerEmail = &contact_email
		paymentData.BuyerPhone = &orgPhone
		paymentData.BuyerAddress = &orgBuyerAddress
	}

	payment_link, err := payosLib.CreatePaymentLink(paymentData)
	if err != nil {
		fmt.Println("Error initilize payment link")
		return nil
	}

	payment.PayOSOrderID = &orderID
	payment.PayOSPaymentLink = &payment_link.CheckoutUrl
	// payment.save()

	return payment.PayOSPaymentLink
}

// -------------
// -------------
func (ps *PayOSService) process_subscription_payment(payment *models.Payment) {
	additional_charge := payment.AdditionalCharge
	subscription := additional_charge.OrganizationSubscription

	// # Mark the charge as paid
	additional_charge.Status = models.ChargeStatusPaid
	_ = ps.chargeRepo.Save(additional_charge)

	quantity := additional_charge.Quantity

	switch additional_charge.ChargeType {
	case models.ChargeTypeAIQueries:
		subscription.AdditionalAIQueries += quantity * 1000
		_, _ = ps.subscriptionRepo.Save(&subscription)
	case models.ChargeTypeStorage:
		subscription.AdditionalStorageMB += quantity * 1024
		_, _ = ps.subscriptionRepo.Save(&subscription)
	case models.ChargeTypeHumanAgents:
		subscription.AdditionalAgents += quantity
		_, _ = ps.subscriptionRepo.Save(&subscription)
	}
}

func (ps *PayOSService) handle_cancel_payment(payment *models.Payment) {
	// # Identify payment type from description
	is_renewal := strings.Contains(payment.Description, "Gia hạn")
	is_upgrade := strings.Contains(payment.Description, "Nâng cấp")
	payment_type_str := "standard"
	if is_renewal {
		payment_type_str = "renewal"
	} else if is_upgrade {
		payment_type_str = "upgrade"
	}
	fmt.Println(payment_type_str)

	if payment.PaymentType == models.PaymentTypeSubscription && payment.Subscription != nil {
		// Find if this was the only payment for this subscription
		hasOthers, _ := ps.paymentRepo.HasOtherValidPayments(payment.Subscription.ID, payment.ID)
		if !hasOthers && payment.Subscription.Status == models.StatusPending {
			payment.Subscription.Status = models.StatusFailed
			ps.subscriptionRepo.Save(payment.Subscription)
		} else if is_renewal {
			// For renewals, we simply keep the existing subscription in its current state
			// No need to modify auto_renew or cancel_at_period_end flags
		}
	} else if payment.PaymentType == models.PaymentTypeAdditionalCharge && payment.AdditionalCharge != nil {
		hasOthers, _ := ps.paymentRepo.HasOtherValidChargePayments(payment.AdditionalCharge.ID, payment.ID)
		if !hasOthers && models.SubscriptionStatus(payment.AdditionalCharge.Status) == models.SubscriptionStatus(models.ChargeStatusPending) {
			payment.AdditionalCharge.Status = models.ChargeStatusFailed
			ps.chargeRepo.Save(payment.AdditionalCharge)
		}
	}
}

func (ps *PayOSService) VerifyPayment(payos_order_id int64) bool {
	payment_info, err := payosLib.GetPaymentLinkInformation(payos_order_id)
	if err != nil {
		fmt.Println("Error verify payment")
		return false
	}

	// if payos_order_id == "123" {
	// 	return true
	// }

	payment, err := ps.paymentRepo.FindByPayOSOrderID(payos_order_id)
	if err != nil {
		fmt.Println("Payment not found")
		return false
	}

	switch payment_info.Status {
	case string(models.ChargeStatusPaid):
		payment.Status = models.PaymentStatusCompleted
		now := time.Now()
		payment.PaymentDate = &now
		payment.PayOSTransactionID = &payment_info.Id
		err = ps.paymentRepo.Save(payment)
		if err != nil {
			fmt.Println("Error saving payment")
			return false
		}
		if payment.Subscription != nil {
			ps.process_subscription_payment(payment)
		}
		return true
	case string(models.StatusCanceled):
		payment.Status = models.PaymentStatusFailed
		err = ps.paymentRepo.Save(payment)
		if err != nil {
			fmt.Println("Error saving payment")
			return false
		}
		ps.handle_cancel_payment(payment)
		return false
	default:
		return false
	}
}
