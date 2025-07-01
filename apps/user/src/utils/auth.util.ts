import { renderFile } from 'ejs'
import { AUTH } from '../constants/auth.constant'
import path from 'path'
// import { createTransport, Transporter } from 'nodemailer'
import { sendEmail } from '../infra/ses/ses.send'
import { userProducer } from '../infra/kafka/kafka.producer'

export const sendVerificationEmail = async (user_name: string, dest: string, token: string) => {
  const verification_url = `${process.env.FRONTEND_URL}${process.env.EMAIL_VERIFICATION_URL}?token=${token}`
  const context = {
    user_name,
    verification_url,
    timeOutDay: AUTH.EMAIL_VERIFICATION_TIMEOUT_DAYS
  }

  const htmlMsg = await renderFile(path.join(__dirname, '..', 'templates', 'auth', 'verification.ejs'), context)
  const plainMsg = await renderFile(path.join(__dirname, '..', 'templates', 'auth', 'verification.txt.ejs'), context)

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

  // Deprecated. Move to kafka
  // await sendEmail(
  //   process.env.SES_EXAMPLE_USER! || dest, 
  //   '[CoolChat] Xác minh địa chỉ email của bạn',
  //   {
  //     html: htmlMsg,
  //     text: plainMsg
  //   },
  // )
  await userProducer.send({
    topic: 'email.send',
    messages: [
      {   
        value: JSON.stringify({
          to: process.env.SES_EXAMPLE_USER! || dest,
          subject: '[CoolChat] Xác minh địa chỉ email của bạn',
          html: htmlMsg,
          text: plainMsg,
          type: 'verification'
        })
      }
    ]
  });

}

export const sendPasswordResetEmail = async (user_name: string, dest: string, token: string) => {
  const reset_url = `${process.env.FRONTEND_URL}${process.env.RESET_PASSWORD_URL}?token=${token}`
  const context = {
    user_name,
    reset_url,
    timeOutHours: AUTH.PASSWORD_RESET_TIMEOUT_HOURS
  }

  const htmlMsg = await renderFile(path.join(__dirname, '..', 'templates', 'auth', 'passwordReset.ejs'), context)
  const plainMsg = await renderFile(path.join(__dirname, '..', 'templates', 'auth', 'passwordReset.txt.ejs'), context)

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
  //   subject: '[CoolChat] Đặt lại mật khẩu của bạn',
  //   text: plainMsg,
  //   html: htmlMsg
  // })

  // await sendEmail(
  //   process.env.SES_EXAMPLE_USER! || dest, 
  //   '[CoolChat] Đặt lại mật khẩu của bạn',
  //   {
  //     html: htmlMsg,
  //     text: plainMsg
  //   },
  // )
  await userProducer.send({
    topic: 'email.send',
    messages: [
      {   
        value: JSON.stringify({
          to: process.env.SES_EXAMPLE_USER! || dest,
          subject: '[CoolChat] Đặt lại mật khẩu của bạn',
          html: htmlMsg,
          text: plainMsg,
          type: 'resetPassword'
        })
      }
    ]
  });
}
