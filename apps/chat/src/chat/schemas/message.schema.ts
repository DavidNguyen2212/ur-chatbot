import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument, SchemaTypes } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

@Schema({ timestamps: { createdAt: 'timestamp' } })
export class Message {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Conversation', required: true,
    index: true
   })
  conversation: string;

  @Prop({ required: true })
  content: string;

  @Prop({
    enum: ['CUSTOMER', 'AGENT', 'AI', 'SYSTEM'],
    required: true,
  })
  sender_type: 'CUSTOMER' | 'AGENT' | 'AI' | 'SYSTEM';

  @Prop({ required: true })
  sender: string;

  @Prop({ default: false })
  is_read: boolean;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Hook để cập nhật last_activity của conversation
MessageSchema.post('save', async function (doc: MessageDocument) {
  const conversationModel = this.model('Conversation');
  await conversationModel.findByIdAndUpdate(doc.conversation, {
    last_activity: new Date(),
  });
});

MessageSchema.index({ conversation: 1, timestamp: -1 }); // Cho query messages theo conversation