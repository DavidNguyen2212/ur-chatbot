import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import * as crypto from 'crypto';

export type ChatbotConfigDocument = HydratedDocument<ChatbotConfig>;

@Schema({ timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class ChatbotConfig {
  // === Microservice: Organization ID từ service khác ===
  @Prop({ required: true })
  organization_id: string; // formerly a ForeignKey to organization.Organization

  // === Appearance Settings ===
  @Prop({ type: String, nullable: true })
  avatar?: string | null; // Lưu URL đã upload lên S3 hoặc media server

  @Prop({ type: String, nullable: true })
  background_image?: string | null;  // như avatar

  @Prop({
    default: '#FFFFFF',
    match: /^#([A-Fa-f0-9]{6})$/,
  })
  primary_background_color: string;

  @Prop({
    default: '#F0F0F0',
    match: /^#([A-Fa-f0-9]{6})$/,
  })
  secondary_background_color: string;

  @Prop({
    default: '#000000',
    match: /^#([A-Fa-f0-9]{6})$/,
  })
  primary_font_color: string;

  @Prop({ required: true, minlength: 2, maxlength: 50 })
  display_name: string;

  @Prop({
    enum: ['ARIAL', 'HELVETICA', 'VERDANA', 'TAHOMA', 'ROBOTO', 'OPEN_SANS'],
    default: 'ARIAL',
  })
  font: string;

  @Prop({ type: String, maxlength: 200 })
  description?: string;

  @Prop({ default: 8 })
  border_radius: number;

  @Prop({ default: 12 })
  message_border_radius: number;

  // === Message Appearance ===
  @Prop({
    enum: ['12', '14', '16', '18', '20', '22', '24'],
    default: '16',
  })
  font_size: string;

  @Prop({
    default: '#000000',
    match: /^#([A-Fa-f0-9]{6})$/,
  })
  sending_message_font_color: string;

  @Prop({
    default: '#FFFFFF',
    match: /^#([A-Fa-f0-9]{6})$/,
  })
  receiving_message_background_color: string;

  @Prop({
    default: '#E3E3E3',
    match: /^#([A-Fa-f0-9]{6})$/,
  })
  sending_message_background_color: string;

  @Prop({
    default: '#000000',
    match: /^#([A-Fa-f0-9]{6})$/,
  })
  receiving_message_font_color: string;

  // === Personality Settings ===
  @Prop({
    enum: ['FRIENDLY', 'PROFESSIONAL', 'HUMOROUS', 'CONCISE'],
    default: 'PROFESSIONAL',
  })
  chatbot_tone: string;

  @Prop({
    required: true,
    minlength: 10,
    maxlength: 500,
    default: 'Xin chào! Tôi có thể giúp gì cho bạn?',
  })
  welcome_message: string;

  @Prop({
    required: true,
    minlength: 10,
    maxlength: 500,
    default: 'Cảm ơn bạn đã trò chuyện. Chúc bạn một ngày tốt lành!',
  })
  goodbye_message: string;

  @Prop({
    required: true,
    minlength: 10,
    maxlength: 500,
    default: 'Tôi sẽ kết nối bạn với nhân viên hỗ trợ. Vui lòng đợi trong giây lát.',
  })
  human_switch_message: string;

  // === Embedding ===
  @Prop({
    type: String,
    default: '',
  })
  allowed_domains: string;

  @Prop({ 
    type: String, 
    required: true, 
    unique: true,
    default: () => crypto.randomUUID()
  })
  embedding_token: string; // UUID dạng string

  // === Rate Limiting ===
  @Prop({
    default: 20,
  })
  rate_limit_threshold: number;
}

export const ChatbotConfigSchema = SchemaFactory.createForClass(ChatbotConfig);
