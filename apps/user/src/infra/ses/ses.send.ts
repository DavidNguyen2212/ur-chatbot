import { SendEmailCommand } from '@aws-sdk/client-ses'
import { sesClient } from './ses.client'

interface EmailPayload {
  fromAddress: string
  toAddresses: string[] | string
  ccAddresses?: string[] | string
  body: {
    html: string
    text: string
  } | string
  subject: string
  replyToAddresses?: string[] | string
}

const createSendEmailCommand = ({
  fromAddress,
  toAddresses,
  ccAddresses,
  body,
  subject,
  replyToAddresses
}: EmailPayload) => {
  const toArray = (value?: string[] | string): string[] => {
    if (!value) return []
    return Array.isArray(value) ? value : [value]
  }

  const messageBody = typeof body === 'string'
    ? {
        Text: {
          Charset: 'UTF-8',
          Data: body
        }
      }
    : {
        Html: {
          Charset: 'UTF-8',
          Data: body.html
        },
        Text: {
          Charset: 'UTF-8',
          Data: body.text
        }
      }

  return new SendEmailCommand({
    Destination: {
      ToAddresses: toArray(toAddresses),
      CcAddresses: toArray(ccAddresses)
    },
    Message: {
      Body: messageBody,
      Subject: {
        Charset: 'UTF-8',
        Data: subject
      }
    },
    Source: fromAddress,
    ReplyToAddresses: toArray(replyToAddresses)
  })
}

export const sendEmail = async (
  toAddress: string[] | string,
  subject: string,
  body: { html: string; text: string } | string
) => {
  const sendEmailCommand = createSendEmailCommand({
    fromAddress: process.env.SES_FROM_ADDRESS || 'default@example.com',
    toAddresses: toAddress,
    body,
    subject
  })

  try {
    const response = await sesClient.send(sendEmailCommand)
    console.log('Email sent successfully!')
    return response
  } catch (error) {
    console.error('Failed to send email.', error)
    return error
  }
}
