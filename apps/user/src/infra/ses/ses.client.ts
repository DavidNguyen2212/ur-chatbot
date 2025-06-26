import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

export const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'ap-southeast-1',
  credentials: {
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'secret-access-key',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'access-key-id'
  }
})