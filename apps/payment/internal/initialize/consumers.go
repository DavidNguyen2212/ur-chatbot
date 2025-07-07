package initialize

import (
	"payment/global"
	"payment/internal/consumers"
	"payment/internal/services"
)

func InitKafkaConsumers(subscriptionService *services.SubscriptionService /*, otherService *services.OtherService */) {
	// Consumer 1: Subscription
	subscriptionConsumer := consumers.NewSubscriptionConsumer(
		"localhost:9092",
		"org-created",
		"payment-subscription-group",
		subscriptionService,
	)
	go subscriptionConsumer.Start()
	global.Logger.Info("SubscriptionConsumer started")

	// Consumer 2: Ví dụ khác (comment lại nếu chưa có)
	// anotherConsumer := consumers.NewAnotherConsumer(...)
	// go anotherConsumer.Start()
	// log.Println("AnotherConsumer started")

	// Có thể thêm consumer thứ 3, 4...
}
