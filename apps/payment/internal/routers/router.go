package routers

import (
	"payment/internal/controllers"
	"payment/internal/middlewares"
	"payment/internal/services"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

/*
// Deprecated. Now we use SetupRouterWithServices (for Kafka init)
func SetupRouter() *gin.Engine {
	db := global.PgDB

	// First init repo layer
	tierRepo := repositories.NewTierRepository(db)
	subscriptionRepo := repositories.NewSubscriptionRepository(db)
	paymentRepo := repositories.NewPaymentRepository(db)
	chargeRepo := repositories.NewChargeRepository(db)

	// Init all tier
	tierService := services.NewTierService(tierRepo)
	tierController := controllers.NewTierController(tierService)

	// Init all subscription
	subscriptionService := services.NewSubscriptionService(subscriptionRepo, paymentRepo, chargeRepo, tierRepo)
	subscriptionController := controllers.NewSubscriptionController(subscriptionService)

	// Init all payment
	paymentService := services.NewPaymentService(subscriptionRepo, paymentRepo, chargeRepo, tierRepo)
	paymentController := controllers.NewPaymentController(paymentService)

	return setupRoutes(tierController, subscriptionController, paymentController)
}
*/

func SetupRouterWithServices(tierService *services.TierService, subscriptionService *services.SubscriptionService, paymentService *services.PaymentService) *gin.Engine {
	// Init controllers with provided services
	tierController := controllers.NewTierController(tierService)
	subscriptionController := controllers.NewSubscriptionController(subscriptionService)
	paymentController := controllers.NewPaymentController(paymentService)

	return setupRoutes(tierController, subscriptionController, paymentController)
}

func setupRoutes(tierController *controllers.TierController, subscriptionController *controllers.SubscriptionController, paymentController *controllers.PaymentController) *gin.Engine {
	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowAllOrigins:  true,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE"},
		AllowHeaders:     []string{"Origin", "Authorization", "Content-Type"},
		AllowCredentials: true,
	}))

	// Public routes
	// public := r.Group("")
	// {
	// 	public.GET("/tiers", tierController.ListSubscriptionTier)
	// 	public.GET("/tiers/:id", tierController.ListSubscriptionTierByID)
	// }

	// Protected routes
	protected := r.Group("")
	protected.Use(middlewares.AuthMiddleware())
	{
		tiers := protected.Group("/tiers")
		{
			tiers.GET("", tierController.ListSubscriptionTier)
			tiers.GET("/:id", tierController.ListSubscriptionTierByID)
		}

		subscriptions := protected.Group("/subscriptions")
		{
			subscriptions.GET("", subscriptionController.ListMySubscriptions)
			subscriptions.GET("/active", subscriptionController.GetActiveSubscription)
			subscriptions.POST("/renew", subscriptionController.RenewSubscription)
			subscriptions.POST("/initiate-payment", subscriptionController.InitiatePayment)
			subscriptions.POST("/initiate-charge", subscriptionController.InitiateCharge)
			/*
				❗ Cho phép người dùng huỷ đăng ký, thường là "huỷ gia hạn tự động" vào cuối chu kỳ hiện tại.

				🔒 Quan trọng nếu bạn có tính năng "auto-renew" (gia hạn tự động).

				🛎 Dùng trong các sản phẩm SaaS có công khai gói trả phí, người dùng chủ động huỷ.

				Ví dụ: "Bạn sẽ tiếp tục sử dụng gói đến hết ngày 30/07/2025. Sau đó sẽ không bị tính phí thêm."
			*/
			subscriptions.POST("/:id/cancel", subscriptionController.CancelSubscription)
			/*
				✅ Cho phép kích hoạt lại một subscription vừa huỷ trước khi kỳ hiện tại kết thúc.

				🧠 Giống kiểu người dùng đổi ý sau khi nhấn "huỷ", họ quay lại nhấn "Reactivate".

				🔄 Cần thiết nếu bạn dùng mô hình "cancel_at_period_end" như Stripe.
			*/
			// subscriptions.POST("/subscriptions/:id/reactivate", subscriptionController.ReactivateSubscription)
		}

		payments := protected.Group("/payments")
		{
			payments.GET("/", paymentController.ListPayments)
			payments.POST("webhook/", paymentController.WebhookHandler)
			// 	payments.POST("/", paymentController.CreatePayment)
			// 	payments.PATCH("/:id/cancel", paymentController.CancelPayment)
		}
	}

	return r
}
