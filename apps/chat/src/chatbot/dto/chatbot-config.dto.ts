import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsHexColor,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

enum FontEnum {
  ARIAL = 'ARIAL',
  HELVETICA = 'HELVETICA',
  VERDANA = 'VERDANA',
  TAHOMA = 'TAHOMA',
  ROBOTO = 'ROBOTO',
  OPEN_SANS = 'OPEN_SANS',
}

enum FontSizeEnum {
  _12 = '12',
  _14 = '14',
  _16 = '16',
  _18 = '18',
  _20 = '20',
  _22 = '22',
  _24 = '24',
}

enum ToneEnum {
  FRIENDLY = 'FRIENDLY',
  PROFESSIONAL = 'PROFESSIONAL',
  HUMOROUS = 'HUMOROUS',
  CONCISE = 'CONCISE',
}

export class ChatbotConfigDto {
  @IsOptional()
  @IsHexColor()
  primary_background_color?: string;

  @IsOptional()
  @IsHexColor()
  secondary_background_color?: string;

  @IsOptional()
  @IsHexColor()
  primary_font_color?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  display_name?: string;

  @IsOptional()
  @IsEnum(FontEnum)
  font?: FontEnum;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @IsNumber()
  border_radius?: number;

  @IsOptional()
  @IsNumber()
  message_border_radius?: number;

  @IsOptional()
  @IsEnum(FontSizeEnum)
  font_size?: FontSizeEnum;

  @IsOptional()
  @IsHexColor()
  sending_message_font_color?: string;

  @IsOptional()
  @IsHexColor()
  receiving_message_background_color?: string;

  @IsOptional()
  @IsHexColor()
  sending_message_background_color?: string;

  @IsOptional()
  @IsHexColor()
  receiving_message_font_color?: string;

  @IsOptional()
  @IsEnum(ToneEnum)
  chatbot_tone?: ToneEnum;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  @Transform(({ value }) => ChatbotConfigDto.sanitizeMessage(value))
  goodbye_message?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  @Transform(({ value }) => ChatbotConfigDto.sanitizeMessage(value))
  human_switch_message?: string;

  @IsOptional()
  @Transform(({ value }) => ChatbotConfigDto.validateAllowedDomains(value))
  allowed_domains?: string;

  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'Ngưỡng giới hạn tần suất phải ít nhất là 1' })
  rate_limit_threshold?: number;

  // Utility
  static sanitizeMessage(message: string): string {
    return typeof message === 'string'
      ? message.replace(/\s+/g, ' ').trim()
      : message;
  }

  static validateAllowedDomains(value: string): string | undefined {
    if (!value) return value;
    const domains = value
      .split(',')
      .map((domain) => domain.trim())
      .filter(Boolean);

    const validatedDomains: string[] = [];

    for (const domainEntry of domains) {
      let cleanedDomain = domainEntry;

      if (cleanedDomain.includes('://')) {
        cleanedDomain = cleanedDomain.split('://').pop()!;
      }

      cleanedDomain = cleanedDomain.split('/')[0];

      if (
        !/^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/.test(cleanedDomain)
      ) {
        throw new Error(`Định dạng tên miền không hợp lệ: ${domainEntry}`);
      }

      validatedDomains.push(cleanedDomain);
    }

    return validatedDomains.join(',');
  }
}
