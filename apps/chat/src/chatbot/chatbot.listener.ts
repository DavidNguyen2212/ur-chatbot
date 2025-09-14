import { Controller, Injectable, OnModuleInit } from "@nestjs/common";
import { ChatbotService } from "./chatbot.service";
import { Ctx, KafkaContext, MessagePattern, Payload } from "@nestjs/microservices";
import { PinoLogger } from "nestjs-pino";
import { KAFKA_EVENT } from "../common/constant/event";

@Injectable()
@Controller()
export class ChatbotListener implements OnModuleInit {
    constructor(
        private readonly chatbotService: ChatbotService,
        private readonly logger: PinoLogger
    ) {}

    onModuleInit() {
        this.logger.info('Chatbot Kafka listener initialized');
    }

    @MessagePattern(KAFKA_EVENT.ORG_REGISTER)
    async handleOrganizationRegistered(
        @Payload() message: any,
        @Ctx() context: KafkaContext
    ) {
        this.logger.info(`Raw message: ${message}`);
        
        try {
            // NestJS đã tự động parse JSON string thành object
            const payload = message;
            const { orgId, orgName } = payload;
            this.logger.info(`Received organization.registered event: ${payload}`, payload);
            this.logger.info(`Topic: ${context.getTopic()}`);
            await this.chatbotService.createDefaultChatbotConfig(orgId, orgName);
        } catch (error) {
            this.logger.error(`Error processing message: ${error}`);
            this.logger.error(`Message content: ${message}`);
        }
    }
}