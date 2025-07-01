import express from 'express'
import cors, { CorsOptions } from 'cors'
import { createServer } from 'http'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import swaggerUi from 'swagger-ui-express'
import swaggerJsdoc from 'swagger-jsdoc'
import authRouter from './routes/auth.route'
import orgRouter from './routes/organization.route'
import usersRouter from './routes/user.route'
import { defaultErrorHandler } from './middlewares/errors.middleware'
import { connectUserProducer } from './infra/kafka/kafka.producer'
import { startEmailConsumer } from './infra/kafka/consumers/email.consumer'

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'X clone (Twitter API)',
      version: '1.0.0'
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [
      {
        BearerAuth: []
      }
    ],
    persistAuthorization: true
  },
  apis: ['./openapi/*.yaml'] // files containing annotations as above
}
const openapiSpecification = swaggerJsdoc(options)
const app = express()
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false // Disable the `X-RateLimit-*` headers
  // store: ... , // Use an external store for more precise rate limiting
})
app.use(limiter)

const httpServer = createServer(app)
app.use(helmet())
// const corsOptions: CorsOptions = {
//   origin: isProduction ? envConfig.clientUrl : '*'
// }
// app.use(cors(corsOptions))
// const port = envConfig.port
const port = 4000

// Tạo folder upload
// initFolder()
app.use(express.json())
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpecification))
app.use('/auth', authRouter)
app.use('/users', usersRouter)
app.use('/organization', orgRouter)
// app.use('/tweets', tweetsRouter)
// app.use('/bookmarks', bookmarksRouter)
// app.use('/likes', likesRouter)
// app.use('/search', searchRouter)
// app.use('/conversations', conversationsRouter)
// app.use('/static', staticRouter)
// app.use('/static/video', express.static(UPLOAD_VIDEO_DIR))
app.use(defaultErrorHandler as express.ErrorRequestHandler)
Promise.all([
  connectUserProducer(),
  startEmailConsumer()
]).then(() => {
  console.log('Connected to KAFKA_BROKER and started email consumer!')
  httpServer.listen(port, () => {
    console.log(`User-Service now listening on port ${port}`)
  })
}).catch(err => {
  console.error('Failed to start Kafka services:', err)
})
