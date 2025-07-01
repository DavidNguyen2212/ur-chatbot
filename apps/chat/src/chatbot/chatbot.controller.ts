import { Controller, Get, Post, Body, Patch, Param, Delete, Put, UseGuards, Req, Res, Headers, NotFoundException, Options } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CoolJwtPayload } from '../common/interfaces/payload';
import { ChatbotConfigDto } from './dto/chatbot-config.dto';
import { Request, Response } from 'express';

@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Get('config')
  async getChatbotConfig(
    @CurrentUser() user: CoolJwtPayload,
  ) {
    return this.chatbotService.getChatbotConfig(user.organization?.id!);
  }

  @Put('config')
  async updateChatbotConfig(
    @CurrentUser() user: CoolJwtPayload,
    @Body() configData: ChatbotConfigDto) {
    return this.chatbotService.updateChatbotConfig(user.organization?.id!, configData);
  }

  @Patch('config')
  async partialUpdateChatbotConfig(
    @CurrentUser() user: CoolJwtPayload,
    @Body() configData: Partial<ChatbotConfigDto>) {
    return this.chatbotService.updateChatbotConfig(user.organization?.id!, configData);
  }

  @Post('config/reset')
  async resetConfig(@CurrentUser() user: CoolJwtPayload) {
    return this.chatbotService.resetConfig(user.organization?.id!, user.organization?.name!);
  }

  @Get('embed-code')
  async getEmbedCode(
    @CurrentUser() user: CoolJwtPayload, 
    @Req() req: Request) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return this.chatbotService.getEmbedCode(user.organization?.id!, baseUrl);
  }

  @Get('widget-config/:token')
  async getWidgetConfig(
    @Headers('origin') origin: string,
    @Param('token') token: string,
    @Res() res: Response
  ) {
    try {
      const config = await this.chatbotService.getWidgetConfigByToken(token, origin)
      // Add cors header
      this.addCorsHeaders(res, origin)
      res.status(200).json(config)
    } catch (err) {
      this.addCorsHeaders(res, origin);
      if (err.message === 'Miền này không được phép truy cập widget chatbot') {
        res.status(403).json({ detail: err.message });
      }
      if (err instanceof NotFoundException) {
        res.status(404).json({ detail: err.message });
      }
      res.status(500).json({ detail: 'Internal Server Error' });
    }
  }

  @Options('widget-config/:token')
  optionsWidgetConfig(@Headers('origin') origin: string, @Res() res: Response) {
    this.addCorsHeaders(res, origin);
    res.status(200).send();
  }

  private addCorsHeaders(res: Response, origin?: string) {
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin)
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
}
