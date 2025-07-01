import { kafka } from "../kafka.instance"
import { sendEmail } from "../../ses/ses.send"

const consumer = kafka.consumer({ groupId: 'email-group' })

export async function startEmailConsumer() {
  await consumer.connect()
  await consumer.subscribe({ 
    topic: 'email.send',
    fromBeginning: false
  })

  await consumer.run({
    eachMessage: async ({ message }) => {
      console.log('Receive email duty!');
      if (!message.value) 
        return
      const { to, subject, html, text } = JSON.parse(message.value.toString());
      await sendEmail(to, subject, { html, text });
    }
  })
}