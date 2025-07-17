import { Module } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ChatbotController } from './chatbot.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ChatbotListener } from './chatbot.listener';
import { ChatbotConfig, ChatbotConfigSchema } from './schemas/chatbot-config.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'KAFKA_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'chat-service',
            brokers: ['localhost:9092'],
          },
          consumer: {
            groupId: 'chat-service-consumer-group',
          },
        }
      }
    ]),
    MongooseModule.forFeature([{ name: ChatbotConfig.name, schema: ChatbotConfigSchema }]),
    SharedModule
  ],
  controllers: [ChatbotController, ChatbotListener],
  providers: [ChatbotService],
})
export class ChatbotModule {}
