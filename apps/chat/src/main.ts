import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  // Init app 
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  // Config and Logger first
  const configService = app.get(ConfigService);
  const logger = app.get(Logger);
  app.useLogger(logger)
  
  // Kafka microservice Setup
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: ['localhost:9092'],
        clientId: 'chat-service',
      },
      consumer: {
        groupId: 'chat-service-consumer-group',
      },
    },
  });
  
  // Assests and view engine
  // app.useStaticAssets(join(__dirname, '..', 'public')); //js, css, images
  // app.setBaseViewsDir(join(__dirname, '..', 'views')); //view
  // app.setViewEngine('ejs');

  // Middlewares (CORS, cookie, pipes)
  app.enableCors({origin: '*'})
  app.use(cookieParser())
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true, // to convert formdata
      },
    }),
  );

  // API prefix and SwaggerDocs builder
  app.setGlobalPrefix('chat');
  const config = new DocumentBuilder()
    .setTitle('Chat Service API')
    .addBearerAuth()
    .setDescription('Chat Service API Documentation')
    .setVersion('1')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // bootstrap microservices in advance
  await app.startAllMicroservices();
  
  // bootstrap http server
  const port = configService.get<string>('PORT') ?? 3000;
  await app.listen(port, () => {
    logger.log(`Chat-Service now listening on PORT ${port}`, 'Bootstrap');
    logger.log(`Swagger documentation available at http://localhost:${port}/api/docs`, 'Bootstrap');
  });
}

bootstrap();
