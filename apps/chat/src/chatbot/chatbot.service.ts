import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Model } from 'mongoose';
import { ChatbotConfig } from './schemas/chatbot-config.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Request } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { UploadService } from '../shared/services/upload.service';
import { UUID } from 'crypto';

@Injectable()
export class ChatbotService {
  constructor (
    private readonly logger: PinoLogger,
    private readonly uploadService: UploadService,
    @InjectModel(ChatbotConfig.name)
    private readonly chatbotConfModel: Model<ChatbotConfig>
  ) {}

  async getChatbotConfigByOrg(orgId: UUID) {
    this.logger.info(orgId)
    const config = await this.chatbotConfModel.findOne({
      organization_id: orgId
    }).lean()

    return config
  }

  async getChatbotConfigByOrgAndToken(orgId: string, token: string) {
    this.logger.info(orgId)
    const config = await this.chatbotConfModel.findOne({
      organization_id: orgId,
      embedding_token: token
    }).lean()

    return config
  }


  async updateChatbotConfig(orgId: UUID, body: any, files: Record<string, Express.Multer.File | undefined>) {
    const avatar = files['avatar'];
    const backgroundImage = files['background_image'];

    const [avatarUrl, backgroundImageUrl] = await Promise.all([
      avatar ? this.uploadService.uploadFile(avatar, "chatbot/avatar", orgId) : Promise.resolve(undefined),
      backgroundImage ? this.uploadService.uploadFile(backgroundImage, "chatbot/bg", orgId) : Promise.resolve(undefined),
    ]);
    
    const updatedConfig = {
      ...body,
      ...(avatarUrl && { avatar: avatarUrl }),
      ...(backgroundImageUrl && { background_image: backgroundImageUrl }),
    };

    const config = await this.chatbotConfModel.findOneAndUpdate({
      organization_id: orgId
      },
      updatedConfig,
      { new: true, runValidators: true }
    )

    if (!config) {
      throw new NotFoundException('Không tìm thấy cấu hình Chatbot.');
    }
    return config;
  }

  async resetConfig(orgId: UUID, orgName: string) {
    const config = await this.chatbotConfModel.findOne({ organization_id: orgId });
    if (!config) {
      throw new NotFoundException('Không tìm thấy cấu hình Chatbot.');
    }
  
    // Reset fields về mặc định
    config.display_name = `Trợ lý ${orgName}`; 
    config.avatar = null;
    config.background_image = null;
    config.font = 'ARIAL';
    config.description = '';
    config.border_radius = 8;
    config.message_border_radius = 12;
    config.primary_background_color = '#FFFFFF';
    config.secondary_background_color = '#F0F0F0';
    config.primary_font_color = '#000000';
    config.font_size = '16';
    config.sending_message_font_color = '#000000';
    config.sending_message_background_color = '#E3E3E3';
    config.receiving_message_font_color = '#000000';
    config.receiving_message_background_color = '#FFFFFF';
    config.rate_limit_threshold = 20;
  
    await config.save();
  
    return config.toObject();
  }
  
  async getEmbedCode(orgId: UUID, baseUrl: string) {
    const config = await this.chatbotConfModel.findOne({ organization_id: orgId }).lean();
    if (!config) {
      throw new NotFoundException('Không tìm thấy cấu hình Chatbot.');
    }
  
    const embedCode = `<!-- CoolChat Widget -->
  <div id='coolchat-widget-container'></div>
  <link rel='stylesheet' href='${baseUrl}/static/css/chatbot-widget.min.css'>
  <script>
  (function() {
      if (window.coolchatWidget) return;
      const script = document.createElement('script');
      script.src = '${baseUrl}/static/js/chatbot-widget.min.js';
      script.async = true;
      script.defer = true;
      script.setAttribute('data-token', '${config.embedding_token}');
      script.setAttribute('data-base-url', '${baseUrl}');
      document.head.appendChild(script);
  })();
  </script>`;
  
    return {
      embed_code: embedCode,
      token: config.embedding_token,
    };
  }
  
  async getWidgetConfigByToken(token: string, origin?: string) {
    const config = await this.chatbotConfModel.findOne({ embedding_token: token }).lean();
    if (!config) {
      throw new NotFoundException('Token không hợp lệ');
    }

    const allowed_domains = (config.allowed_domains || '')
      .split(',')
      .map(domain => domain.trim())
      .filter(Boolean)

    if (origin) {
      const domain = new URL(origin).hostname
      if (allowed_domains.length && !allowed_domains.includes(domain)) {
        throw new ForbiddenException('This domain is not allowed to access widget chatbot');
      }
    }

    return config
  }

  async createDefaultChatbotConfig(orgId: string, orgName: string) {
    const exists = await this.chatbotConfModel.exists({ organization_id: orgId });
    if (exists) return;
  
    await this.chatbotConfModel.create({
      organization_id: orgId,
      display_name: `Trợ lý ${orgName}`,
    });
  
    console.log(`Created default ChatbotConfig for org ${orgName}`);
  }
  

  findAll() {
    return `This action returns all chatbot`;
  }

  findOne(id: number) {
    return `This action returns a #${id} chatbot`;
  }

  update(id: number, updateChatbotDto) {
    return `This action updates a #${id} chatbot`;
  }

  remove(id: number) {
    return `This action removes a #${id} chatbot`;
  }
}
