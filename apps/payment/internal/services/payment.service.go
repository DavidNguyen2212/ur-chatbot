package services

import (
	"fmt"
	"payment/global"
	"payment/internal/models"
	"payment/internal/repositories"
	"slices"

	"github.com/google/uuid"
	"github.com/payOSHQ/payos-lib-golang"
)

type PaymentService struct {
	subscriptionRepo repositories.SubscriptionRepository
	paymentRepo      repositories.PaymentRepository
	chargeRepo       repositories.ChargeRepository
	tierRepo         repositories.TierRepository
}

func NewPaymentService(
	subscriptionRepo repositories.SubscriptionRepository,
	paymentRepo repositories.PaymentRepository,
	chargeRepo repositories.ChargeRepository,
	tierRepo repositories.TierRepository,
) *PaymentService {
	return &PaymentService{
		subscriptionRepo: subscriptionRepo,
		paymentRepo:      paymentRepo,
		chargeRepo:       chargeRepo,
		tierRepo:         tierRepo,
	}
}

func (ps *PaymentService) ListMyPayments(orgId uuid.UUID) ([]models.Payment, error) {
	return ps.paymentRepo.FindPaymentsByOrg(orgId)
}

func (ps *PaymentService) CancelPayment(orgId uuid.UUID, orderID int64) (any, error) {
	payment, err := ps.paymentRepo.FindByPayOSOrderID(orderID)
	if err != nil {
		global.Logger.Error(fmt.Sprintf("Payment not found for order ID: %v", orderID))
		return nil, err
	}

	// Skip if payment is already completed or failed
	if slices.Contains([]string{"COMPLETED", "FAILED"}, string(payment.Status)) {
		return "Payment already marked as completed or failed", nil
	}

	payment.Status = models.PaymentStatusFailed
	ps.paymentRepo.Save(payment)

	// Handle cleanup for the canceled payment
	ps.handle_canceled_payment(payment)
	global.Logger.Info(fmt.Sprintf("Payment %v marked as failed due to cancellation", orderID))
	return "Payment marked as failed", nil
}

func (ps *PaymentService) handle_canceled_payment(payment *models.Payment) {
	if payment.PaymentType == models.PaymentTypeSubscription && payment.Subscription != nil {
		_, err := ps.paymentRepo.HasOtherValidPayments(payment.Subscription.ID, payment.ID)
		if err != nil {
			// this is a new subscription or upgrade with no other payments, mark it as FAILED
			payment.Subscription.Status = models.StatusFailed
			ps.subscriptionRepo.Save(payment.Subscription)
		} else {
			// For renewals, we simply keep the existing subscription in its current state
			// No need to modify auto_renew or cancel_at_period_end flags
			global.Logger.Info(fmt.Sprintf("Renewal payment for %s was canceled.", payment.OrganizationID))
		}
	} else if payment.PaymentType == models.PaymentTypeAdditionalCharge && payment.AdditionalCharge != nil {
		_, err := ps.paymentRepo.HasOtherValidChargePayments(payment.Subscription.ID, payment.ID)
		if err != nil {
			// this is a new subscription or upgrade with no other payments, mark it as FAILED
			payment.AdditionalCharge.Status = models.ChargeStatusFailed
			ps.chargeRepo.Save(payment.AdditionalCharge)
			global.Logger.Info(fmt.Sprintf("Additional charge for %s marked as FAILED due to canceled payment", payment.OrganizationID))
		}
	}
}

func (ps *PaymentService) HandleWebhook(webhookData *payos.WebhookDataType) (any, error) {
	payment, err := ps.paymentRepo.FindByPayOSOrderID(webhookData.OrderCode)
	if err != nil {
		global.Logger.Error(fmt.Sprintf("Payment not found for order ID: %v", webhookData.OrderCode))
		return nil, err
	}

	if payment.Status == models.PaymentStatusCompleted {
		return "Already processes", nil
	}

	// # Log the payment type based on description
	//     payment_type_str = "standard"
	//     if payment.payment_type == "SUBSCRIPTION":
	//         if "Gia hạn" in payment.description:
	//             payment_type_str = "renewal"
	//         elif "Nâng cấp" in payment.description:
	//             payment_type_str = "upgrade"
	//         else:
	//             payment_type_str = "new subscription"
	//     elif payment.payment_type == "ADDITIONAL_CHARGE":
	//         payment_type_str = "additional charge"

	//     logger.info(
	//         f"Processing {payment_type_str} payment (OrderID: {order_id}, Status: {status})",
	//     )
	payos_service := NewPayOSService(ps.paymentRepo, ps.subscriptionRepo, ps.chargeRepo)
	is_verified := payos_service.VerifyPayment(webhookData.OrderCode)
	if is_verified {
		return "success", nil
	}

	return "Payment verification failed", fmt.Errorf("404")

}
