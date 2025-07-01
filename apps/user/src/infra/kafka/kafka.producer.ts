import { kafka } from "./kafka.instance"

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