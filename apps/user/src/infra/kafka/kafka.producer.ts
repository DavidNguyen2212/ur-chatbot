import { Kafka } from 'kafkajs'

const kafka = new Kafka({
  clientId: 'user-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092']
})

export const userProducer = kafka.producer()

export const connectUserProducer = async () => {
  await userProducer.connect()
}

export const sendUserCreatedEvent = async (user: any) => {
  await userProducer.send({
    topic: 'user.created',
    messages: [{ value: JSON.stringify(user) }]
  })
}