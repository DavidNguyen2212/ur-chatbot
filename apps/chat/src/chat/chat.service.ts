import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CreateChatDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { UUID } from 'crypto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Conversation } from './schemas/conversation.schema';
import { ConfigService } from '@nestjs/config';
import { Message } from './schemas/message.schema';
import { PinoLogger } from 'nestjs-pino';
// import { ChatGateway } from './chat.gateway';
import { CreateCustomerMessageDto } from './dto/create-customer-chat.dto';
import { UpdateConversationDto } from './dto/update-conv.dto';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<Conversation>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<Message>,
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
    // private readonly subscriptionClient: SubscriptionGrpcClient, // gRPC
    // private readonly userServiceClient: UserServiceClient, // gRPC
    // private readonly chatGateway: ChatGateway,
  ) {}
  async saveMessage({
    conversationId,
    content,
    sender_type,
    sender_id,
  }: {
    conversationId: string;
    content: string;
    sender_type: string;
    sender_id?: string;
  }) {
    await this.conversationModel.findByIdAndUpdate(conversationId, {
      last_activity: new Date(),
    });

    const message = await this.messageModel.create({
      conversation: conversationId,
      content,
      sender_type,
      sender_id: sender_id || null,
    });

    return {
      id: message._id.toString(),
      content: message.content,
      sender_type: message.sender_type,
      sender_id: message.sender,
      timestamp: message.timestamp,
    };
  }

  async isAiInitializing(conversationId: string): Promise<boolean> {
    // Dummy flag, tùy bạn implement
    return false;
  }

  findOne(id: string) {
    return `This action returns a #${id} chat`;
  }

  // async changeAgentOfChat(convId: string, agentId: UUID, orgId: UUID) {
  //   const conversation = await this.conversationModel.findOne({
  //     id: convId,
  //     organization_id: orgId
  //   })
  //   if (!conversation) {
  //     throw new NotFoundException('Conversation does not exist!');
  //   }

  //   // Gọi sang user service để xác minh agent có thuộc org không
  //   let agentInfo: { name?: string, email?: string };
  //   try {
  //     const res = await this.userServiceClient.validateAgentInOrg(agentId, orgId);
  //     if (!res.valid) {
  //       throw new BadRequestException('agent invalid');
  //     }
  //     agentInfo = res;
  //   } catch (err) {
  //     throw new BadRequestException('agent_id invalid or does not belong to this organization');
  //   }

  //   // Gán agent mới
  //   conversation.agent_id = agentId;
  //   await conversation.save();

  //   // Tạo message hệ thống
  //   const systemMessage = `Trợ lý ${agentInfo.name || agentInfo.email || 'không rõ'} sẽ tiếp tục cuộc hội thoại.`;
  //   const message = await this.messageModel.create({
  //     conversation,
  //     content: systemMessage,
  //     sender_type: 'SYSTEM'
  //   })

  //   // Gửi websocket
  //   try {
  //     await this.chatGateway.sendMessageToRoom(`chat_${conversation._id}`, {
  //       id: message._id,
  //       content: message.content,
  //       sender_type: message.sender_type,
  //       timestamp: message.timestamp.toISOString(),
  //     })
  //   } catch (err) {
  //     this.logger.error('WebSocket error:', err);
  //   }

  //   return conversation.toObject();
  // }

  // async endConversation(convId: string, orgId: UUID): Promise<any> {
  //   const conversation = await this.conversationModel.findById(convId);
  //   if (!conversation) throw new NotFoundException('Cuộc hội thoại không tồn tại');

  //   if (conversation.organization_id !== orgId) {
  //     throw new ForbiddenException('Không có quyền truy cập cuộc hội thoại này');
  //   }

  //   if (conversation.mode !== 'HUMAN') {
  //     throw new BadRequestException('Cuộc hội thoại không ở chế độ HUMAN');
  //   }

  //   // Gọi gRPC kiểm tra quota AI
  //   const canUseAI = await this.subscriptionClient.checkAIUsage(orgId);
  //   if (!canUseAI) {
  //     throw new ForbiddenException('Dịch vụ AI không khả dụng cho gói đăng ký của bạn');
  //   }

  //   // Nếu chưa có session AI thì khởi tạo
  //   if (!conversation.ai_session_id) {
  //     const sessionId = await this.initializeAISession(conversation._id.toString(), orgId);
  //     if (!sessionId) {
  //       throw new InternalServerErrorException('Không thể khởi tạo phiên AI');
  //     }
  //     conversation.ai_session_id = sessionId;
  //   }

  //   // Cập nhật trạng thái: AI mode, xoá agent, cập nhật last_activity
  //   conversation.mode = 'AI';
  //   conversation.agent_id = undefined;
  //   conversation.last_activity = new Date();
  //   await conversation.save();

  //   // Ghi log hệ thống
  //   const content = 'Cuộc hội thoại với nhân viên hỗ trợ đã kết thúc. Bạn đang trò chuyện với AI.';
  //   const message = await this.messageModel.create({
  //     conversation_id: conversation._id,
  //     content,
  //     sender_type: 'SYSTEM',
  //   });

  //   // Gửi message & notification qua websocket
  //   try {
  //     const room = `chat_${conversation._id}`;
  //     await this.chatGateway.sendMessageToRoom(room, {
  //       id: message._id,
  //       content: message.content,
  //       sender_type: message.sender_type,
  //       timestamp: message.timestamp.toISOString(),
  //     });

  //     await this.chatGateway.sendMessageToRoom(room, {
  //       mode: conversation.mode,
  //     }, 'chat:mode_change');
  //   } catch (err) {
  //     console.error('Lỗi khi gửi WebSocket:', err);
  //   }

  //   return {
  //     mode: conversation.mode,
  //     ai_session_id: conversation.ai_session_id,
  //     message_id: message._id,
  //   };
  // }

  async initializeAISession(conversationId: string, orgId: string): Promise<string | null> {
    // Tạo session ID đơn giản, hoặc logic phức tạp hơn tùy bạn
    return `ai_${conversationId}_${Date.now()}`;
  }

  async deleteConversation(convId: string, orgId: UUID): Promise<any> {
    const conversation = await this.conversationModel.findOne({
      id: convId,
      organization_id: orgId
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    conversation.is_active = false;
    conversation.ended_at = new Date();
    await conversation.save();

    await this.messageModel.create({
      conversation: conversation._id,
      content: 'Cuộc hội thoại đã được đóng.',
      sender_type: 'SYSTEM', // hoặc enum nếu bạn dùng enum
    });
  }

  async listConversations(params: {
    user: any;
    active?: string;
    agentId?: string;
    hasAgent?: string;
    customer?: string;
    mode?: string;
    page: number;
    limit: number;
  }) {
    const {
      user,
      active,
      agentId,
      hasAgent,
      customer,
      mode,
      page,
      limit,
    } = params;
  
    const organizationId = user.organization_member?.organization_id;
    if (!organizationId) return { results: [], total_count: 0 };
  
    const match: any = { organization_id: organizationId };
  
    if (typeof active === 'string') {
      match.is_active = active.toLowerCase() === 'true';
    }
  
    if (agentId) {
      match.agent_id = agentId;
    }
  
    if (typeof hasAgent === 'string') {
      if (hasAgent.toLowerCase() === 'true') {
        match.agent_id = { $ne: null };
      } else {
        match.agent_id = null;
      }
    }
  
    if (customer) {
      match.$or = [
        { customer_email: { $regex: customer, $options: 'i' } },
        { customer_name: { $regex: customer, $options: 'i' } },
      ];
    }
  
    if (mode) {
      match.mode = mode.toUpperCase();
    }
  
    const skip = (page - 1) * limit;
  
    const baseMatch = { organization_id: organizationId };
    const baseCountPromise = this.conversationModel.countDocuments(baseMatch);
  
    const aggregatePipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'messages',
          localField: '_id',
          foreignField: 'conversation',
          as: 'messages',
        },
      },
      {
        $addFields: {
          latest_message_time: { $max: "$messages.timestamp" },
        },
      },
      {
        $sort: <Record<string, 1 | -1>>{
          latest_message_time: -1,
          started_at: -1,
        },
      },
      { $skip: skip },
      { $limit: limit },
    ];
  
    const conversations = await this.conversationModel.aggregate(aggregatePipeline);
  
    const totalCountPromise = this.conversationModel.countDocuments(match);
    const assignedCountPromise = this.conversationModel.countDocuments({
      ...match,
      agent_id: { $ne: null },
    });
  
    const needSupportCountPromise = this.conversationModel.countDocuments({
      ...match,
      mode: 'HUMAN',
    });
  
    const [total_count, assigned_count, need_support_count] = await Promise.all([
      baseCountPromise,
      assignedCountPromise,
      needSupportCountPromise,
    ]);
  
    return {
      results: conversations,
      total_count,
      assigned_count,
      need_support_count,
    };
  }

  async updateConversation(id: string, updateDto: UpdateConversationDto) {
    const updated = await this.conversationModel.findByIdAndUpdate(id, updateDto, {
      new: true, // trả về bản ghi đã cập nhật
      runValidators: true,
    });
  
    if (!updated) {
      throw new NotFoundException('Không tìm thấy cuộc hội thoại');
    }
  
    return updated;
  }


  async getMessagesBySession(session_id: string) {
    const conversation = await this.conversationModel.findOne({ customer_session_id: session_id });
    if (!conversation) return [];
    return this.messageModel.find({ conversation: conversation._id }).sort({ createdAt: 1 }).lean();
  }

  async createCustomerMessage(dto: CreateCustomerMessageDto) {
    const { session_id, content, customer_name, customer_email, organization_id } = dto;

    let conversation = await this.conversationModel.findOne({ customer_session_id: session_id });
    if (!conversation) {
      conversation = await this.conversationModel.create({
        customer_session_id: session_id,
        customer_name: customer_name || '',
        customer_email: customer_email || '',
        organization_id,
        is_active: true,
      });
    }

    const message = await this.messageModel.create({
      conversation: conversation._id,
      content,
      sender_type: 'CUSTOMER', // Enum giống Django
    });

    return message.toObject();
  }
  

}
