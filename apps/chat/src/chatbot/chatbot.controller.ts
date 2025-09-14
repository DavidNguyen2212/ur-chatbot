import { Controller, Get, Post, Body, Patch, Param, Delete, Put, UseGuards, Req, Res, Headers, NotFoundException, Options, UseInterceptors, UploadedFiles, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CoolJwtPayload } from '../common/interfaces/payload';
import { ChatbotConfigDto } from './dto/chatbot-config.dto';
import { Request, Response } from 'express';
import { AnyFilesInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';

@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Get('config')
  async getChatbotConfig(
    @CurrentUser() user: CoolJwtPayload,
  ) {
    return this.chatbotService.getChatbotConfigByOrg(user.organization?.id!);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Patch('config')
  @UseInterceptors(FileFieldsInterceptor(
      [
        { name: 'avatar', maxCount: 1 },
        { name: 'background_image', maxCount: 1 },
      ],
    ),
  )
  async partialUpdateChatbotConfig(
    @CurrentUser() user: CoolJwtPayload,
    @UploadedFiles() files: { avatar?: Express.Multer.File[]; background_image?: Express.Multer.File[] },
    @Body() configData: ChatbotConfigDto,
  ) {
    const maxSizeMB = 10;
    for (const [field, fileList] of Object.entries(files)) {
      for (const file of fileList ?? []) {
        if (file.size > maxSizeMB * 1024 * 1024) {
          throw new BadRequestException(
            `File "${file.originalname}" in field "${field}" exceeds ${maxSizeMB}MB`,
          );
        }
      }
    }

    // Convert to single file map: avatar, background
    const fileMap: Record<string, Express.Multer.File | undefined> = {
      avatar: files.avatar?.[0],
      background_image: files.background_image?.[0],
    };

    return this.chatbotService.updateChatbotConfig(
      user.organization?.id!,
      configData,
      fileMap,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Post('config/reset')
  async resetConfig(@CurrentUser() user: CoolJwtPayload) {
    return this.chatbotService.resetConfig(user.organization?.id!, user.organization?.name!);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @Get('embed-code')
  async getEmbedCode(
    @CurrentUser() user: CoolJwtPayload, 
    @Req() req: Request
  ) {
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
      if (err instanceof ForbiddenException) {
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
