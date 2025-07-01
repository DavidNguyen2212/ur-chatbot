import { Kafka } from 'kafkajs'

export const kafka = new Kafka({
  clientId: 'user-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092']
})