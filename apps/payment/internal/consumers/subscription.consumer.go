package consumers

import (
	"context"
	"encoding/json"
	"log"
	"payment/internal/services"

	"github.com/google/uuid"
	"github.com/segmentio/kafka-go"
)

type OrganizationCreatedEvent struct {
	OrganizationID   string `json:"organization_id"`
	OrganizationName string `json:"organization_name"`
}

type SubscriptionConsumer struct {
	Reader              *kafka.Reader
	SubscriptionService *services.SubscriptionService
}

func NewSubscriptionConsumer(broker, topic, groupID string, service *services.SubscriptionService) *SubscriptionConsumer {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers: []string{broker},
		Topic:   topic,
		GroupID: groupID,
	})
	return &SubscriptionConsumer{
		Reader:              reader,
		SubscriptionService: service,
	}
}

func (sc *SubscriptionConsumer) Start() {
	log.Println("Kafka consumer started...")

	for {
		m, err := sc.Reader.ReadMessage(context.Background())
		if err != nil {
			log.Printf("error reading message: %v", err)
			continue
		}

		var event OrganizationCreatedEvent
		if err := json.Unmarshal(m.Value, &event); err != nil {
			log.Printf("invalid message format: %v", err)
			continue
		}

		log.Printf("Received event: %+v", event)

		_, err = sc.SubscriptionService.CreateFreeTrialSubscription(uuid.MustParse(event.OrganizationID), event.OrganizationName)
		if err != nil {
			log.Printf("failed to create subscription: %v", err)
		}
	}
}
