import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, ParseUUIDPipe, Query, BadRequestException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { AgentChangeDTO, CreateChatDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CoolJwtPayload } from '../common/interfaces/payload';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UUID } from 'crypto';
import { CreateCustomerMessageDto } from './dto/create-customer-chat.dto';
import { UpdateConversationDto } from './dto/update-conv.dto';

@Controller('')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AGENT', 'OWNER', 'ADMIN')
  @Get("conversations")
  async listConversations(
    @Req() req: Request,
    @CurrentUser() user: CoolJwtPayload,
    @Query("active") active?: string,
    @Query("agent") agentId?: string,
    @Query("has_agent") hasAgent?: string,
    @Query("customer") customer?: string,
    @Query("mode") mode?: string,
    @Query("page") page = 1,
    @Query("limit") limit = 20,
  ) { 
    return this.chatService.listConversations({
      user,
      active,
      agentId,
      hasAgent,
      customer,
      mode,
      page: +page,
      limit: +limit,
    });
  }

  // @Post("conversations/:conv_id/assign-agent")
  // async changeAgentOfChat(
  //   @CurrentUser() user: CoolJwtPayload, 
  //   @Req() req: Request,
  //   @Body() agentChangeDto: AgentChangeDTO,
  //   @Param('conv_id', ParseUUIDPipe) convId: string
  // ) {
  //   return await this.chatService.changeAgentOfChat(convId, agentChangeDto.agent_id, user.organization?.id!);
  // }

  // @Post("conversations/:id/end-conversation")
  // async endConversation(
  //   @Param('conv_id') convId: string,
  //   @CurrentUser() user: CoolJwtPayload,
  // ): Promise<any> {
  //   return this.chatService.endConversation(convId, user.organization?.id!);
  // }

  @Patch("conversations/:id")
  d(
    @CurrentUser() user: CoolJwtPayload,
    @Param('id') id: string,
    @Body() updateDto: UpdateConversationDto
  ) {
    return this.chatService.updateConversation(id, updateDto);
  }

  @Delete("conversations/:conv_id")
  async deleteConversation(
    @CurrentUser() user: CoolJwtPayload,
    @Param('conv_id') convId: string
  ) {
    return this.chatService.deleteConversation(convId, user.organization?.id!);
  }

  @Get("customer-messages")
  async getMessages(@Query('session_id') session_id: string) {
    if (!session_id) return [];
    return this.chatService.getMessagesBySession(session_id);
  }

  @Post("customer-messages")
  async createMessage(@Body() dto: CreateCustomerMessageDto) {
    const { session_id, content } = dto;
    if (!session_id || !content) {
      throw new BadRequestException('session_id và content là bắt buộc');
    }
    return this.chatService.createCustomerMessage(dto);
  }

}
