import { Controller, Injectable, OnModuleInit } from "@nestjs/common";
import { ChatbotService } from "./chatbot.service";
import { Ctx, KafkaContext, MessagePattern, Payload } from "@nestjs/microservices";

@Injectable()
@Controller()
export class ChatbotListener implements OnModuleInit {
    constructor(private readonly chatbotService: ChatbotService) {}

    onModuleInit() {
        console.log('Chatbot Kafka listener initialized');
    }

    @MessagePattern('organization.registered')
    async handleOrganizationRegistered(
        @Payload() message: any,
        @Ctx() context: KafkaContext
    ) {
        console.log('Raw message:', message);
        
        try {
            // NestJS đã tự động parse JSON string thành object
            const payload = message;
            const { orgId, orgName } = payload;
            console.log(`Received organization.registered event:`, payload);
            console.log(`Topic: ${context.getTopic()}`);
            await this.chatbotService.createDefaultChatbotConfig(orgId, orgName);
        } catch (error) {
            console.error('Error processing message:', error);
            console.error('Message content:', message);
        }
    }
}