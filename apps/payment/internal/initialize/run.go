package initialize

import (
	"fmt"
	"payment/global"
	"payment/internal/repositories"
	"payment/internal/routers"
	"payment/internal/services"

	"go.uber.org/zap"
)

func Run() {
	fmt.Println("Loading configuration and env...")
	LoadConfig()

	fmt.Println("Loading logger...")
	InitLogger()
	global.Logger.Info("Logger initialized")

	fmt.Println("Loading database...")
	InitPostgreSQL()

	fmt.Println("Loading payment portal...")
	InitPayOS()

	// Initialize repositories
	db := global.PgDB
	tierRepo := repositories.NewTierRepository(db)
	subscriptionRepo := repositories.NewSubscriptionRepository(db)
	paymentRepo := repositories.NewPaymentRepository(db)
	chargeRepo := repositories.NewChargeRepository(db)

	// Initialize services
	tierService := services.NewTierService(tierRepo)
	subscriptionService := services.NewSubscriptionService(subscriptionRepo, paymentRepo, chargeRepo, tierRepo)
	paymentService := services.NewPaymentService(subscriptionRepo, paymentRepo, chargeRepo, tierRepo)

	// Setup router with services
	r := routers.SetupRouterWithServices(tierService, subscriptionService, paymentService)

	// Initialize Kafka consumers with subscription service, ...
	InitKafkaConsumers(subscriptionService)

	port := fmt.Sprintf(":%d", global.Config.Server.Port)
	global.Logger.Info("Starting server...", zap.String("port", port))

	if err := r.Run(port); err != nil {
		global.Logger.Fatal("Failed to start server", zap.Error(err))
	}
}
