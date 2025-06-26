import { renderFile } from 'ejs'
import { AUTH } from '../constants/auth.constant'
import path from 'path'
// import { createTransport, Transporter } from 'nodemailer'
import { sendEmail } from '../infra/ses/ses.send'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'

interface InviteData {
  organization_name: string
  inviter_name: string
  invite_code: string
  email: string
  role: string
  expires_at: Date
}

export const sendOrgInvitationEmail = async (payload: InviteData, dest: string) => {
  const signup_link = `${process.env.FRONTEND_URL}/sign-up`
  const formattedDate = format(payload.expires_at, "dd MMMM yyyy, HH:mm", { locale: vi })
  const context = {
    ...payload,
    expires_at: formattedDate,
    signup_link,
  }

  const htmlMsg = await renderFile(path.join(__dirname, '..', 'templates', 'organization', 'invitation.ejs'), context)
  const plainMsg = await renderFile(path.join(__dirname, '..', 'templates', 'organization', 'invitation.txt.ejs'), context)

  // const transporter: Transporter = createTransport({
  //   host: process.env.SMTP_HOST,
  //   port: Number(process.env.SMTP_PORT),
  //   secure: true,
  //   auth: {
  //     user: process.env.SMTP_USER,
  //     pass: process.env.SMTP_PASSWORD
  //   }
  // })

  // await transporter.sendMail({
  //   from: process.env.SMTP_FROM,
  //   to: dest,
  //   subject: '[CoolChat] Xác minh địa chỉ email của bạn',
  //   text: plainMsg,
  //   html: htmlMsg
  // })
  await sendEmail(
    process.env.SES_EXAMPLE_USER! || dest, 
    '[CoolChat] Invitation to join us',
    {
      html: htmlMsg,
      text: plainMsg
    },
  )
}