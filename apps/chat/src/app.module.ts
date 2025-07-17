import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatModule } from './chat/chat.module';
import { ChatbotModule } from './chatbot/chatbot.module';
import { LoggerModule } from 'nestjs-pino';
import { join } from 'path';
import { ServeStaticModule } from '@nestjs/serve-static';

@Module({
  imports: [
    // Config first
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env']
    }),
    // Logger second
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get<string>('NODE_ENV', 'development');
        const logLevel = configService.get<string>('LOG_LEVEL', 'info');
        const appName = configService.get<string>('APP_NAME', 'nestjs-app');

        return {
          pinoHttp: {
            name: appName,
            level: logLevel,
            customProps: (req, res) => ({
              context: 'HTTP',
              correlationId: req.headers['x-correlation-id'] || Math.random().toString(36).substring(2, 15),
              userAgent: req.headers['user-agent'],
            }),
            transport: nodeEnv === 'development' ? {
              target: 'pino-pretty',
              options: {
                singleLine: true,
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
              },
            } : undefined,
            redact: nodeEnv === 'production' ? {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.body.password',
                'req.body.token',
              ],
              remove: true,
            } : undefined,
            serializers: {
              req: (req) => ({
                method: req.method,
                url: req.url,
                headers: req.headers,
                remoteAddress: req.remoteAddress,
                remotePort: req.remotePort,
              }),
              res: (res) => ({
                statusCode: res.statusCode,
                headers: res.headers,
              }),
            },
          }
        }
      },
      inject: [ConfigService],  
    }), 
    // Static serving
    // Will be replaced by https://www.jsdelivr.com/ in future
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/static', // Tất cả file trong public sẽ được truy cập qua /static/*
    }),
    // Other connections
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    ChatModule,
    ChatbotModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
