import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  
  // Cấu hình Kafka microservice
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
  
  app.useStaticAssets(join(__dirname, '..', 'public')); //js, css, images
  app.setBaseViewsDir(join(__dirname, '..', 'views')); //view
  app.setViewEngine('ejs');
  app.enableCors({origin: '*'})
  app.use(cookieParser())

  app.useGlobalPipes(
    new ValidationPipe({
      // Chuẩn rest
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('chat');
  const config = new DocumentBuilder()
    .setTitle('Chat Service API')
    .addBearerAuth()
    .addTag('auth')
    .addTag('users')
    .addTag('statistics')
    .addTag('notifications')
    // .addTag('health')
    .setDescription('Chat Service API Documentation')
    .setVersion('1')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Khởi động microservices trước
  await app.startAllMicroservices();
  
  // Sau đó khởi động HTTP server
  await app.listen(configService.get<string>('PORT') ?? 3000, () => {
    console.log("Chat-Service now listening on PORT 4001");
  });
}
bootstrap();
