import { userProducer } from "./kafka.producer"

export const sendOrgRegisteredEvent = async (data: {
  orgId: string,
  orgName: string,
  userId: string,
  userEmail: string
}) => {
  await userProducer.send({
    topic: 'org.registered',
    messages: [
      { value: JSON.stringify(data) }
    ]
  })
}