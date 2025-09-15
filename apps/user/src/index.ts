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
import { startGrpcServer } from './grpc/grpcServer'
import { httpLogger } from './middlewares/httpLogger'
import { logger } from './utils/logger'

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'User Serivce (SWAGGER API)',
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
app.use(httpLogger);
const httpServer = createServer(app)
app.use(helmet())
const corsOptions: CorsOptions = {
  // origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : '*' // REAL PRODUCT
  origin: process.env.NODE_ENV === 'production' ? '*' : process.env.FRONTEND_URL // LOCAL PRODUCT
}
app.use(cors(corsOptions))
const port = process.env.PORT || 4000

app.use(express.json())
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpecification))
app.use('/auth', authRouter)
app.use('/users', usersRouter)
app.use('/organization', orgRouter)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  })
})

app.use(defaultErrorHandler as express.ErrorRequestHandler)

startGrpcServer()

Promise.all([
  connectUserProducer(),
  startEmailConsumer()
]).then(() => {
  logger.info('Connected to KAFKA_BROKER and started email consumer!')
  
  httpServer.listen(port, () => {
    logger.info(`User-Service HTTP now listening on port ${port}`)
  })
}).catch(err => {
  logger.error('Failed to start Kafka services:', err)
  
  // Nếu Kafka fail, vẫn start HTTP server để app không chết
  httpServer.listen(port, () => {
    logger.warn(`User-Service HTTP started without Kafka on port ${port}`)
  })
})

// Hệ thooongs log của microservice.
// [Microservice] → stdout/stderr → [Container Runtime] → [Log Agent] → [Central Log Store]
//      ↓               ↓                    ↓                 ↓              ↓
//    Your App      Console.log         Kubernetes        Fluentd         ELK/Loki