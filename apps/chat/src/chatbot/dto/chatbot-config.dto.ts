import { Transform } from "class-transformer";
import { IsEnum, IsHexColor, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";

export class ChatbotConfigDto {
    @IsOptional()
    @IsString()
    avatar?: string; // Giả sử lưu URL hoặc file path
  
    @IsOptional()
    @IsString()
    background_image?: string;
  
    @IsString()
    organization_id: string; // Microservice lưu UUID string
  
    @IsHexColor()
    primary_background_color: string;
  
    @IsHexColor()
    secondary_background_color: string;
  
    @IsHexColor()
    primary_font_color: string;
  
    @IsString()
    @MinLength(2)
    @MaxLength(50)
    display_name: string;
  
    @IsEnum(['ARIAL', 'HELVETICA', 'VERDANA', 'TAHOMA', 'ROBOTO', 'OPEN_SANS'])
    font: string;
  
    @IsOptional()
    @IsString()
    @MaxLength(200)
    description?: string;
  
    @IsNumber()
    border_radius: number;
  
    @IsNumber()
    message_border_radius: number;
  
    @IsEnum(['12', '14', '16', '18', '20', '22', '24'])
    font_size: string;
  
    @IsHexColor()
    sending_message_font_color: string;
  
    @IsHexColor()
    receiving_message_background_color: string;
  
    @IsHexColor()
    sending_message_background_color: string;
  
    @IsHexColor()
    receiving_message_font_color: string;
  
    @IsEnum(['FRIENDLY', 'PROFESSIONAL', 'HUMOROUS', 'CONCISE'])
    chatbot_tone: string;

    @IsString()
    @MinLength(10)
    @MaxLength(500)
    @Transform(({ value }) => ChatbotConfigDto.sanitizeMessage(value))

    @IsString()
    @MinLength(10)
    @MaxLength(500)
    @Transform(({ value }) => ChatbotConfigDto.sanitizeMessage(value))
    goodbye_message: string;

    @IsString()
    @MinLength(10)
    @MaxLength(500)
    @Transform(({ value }) => ChatbotConfigDto.sanitizeMessage(value))
    human_switch_message: string;

    @IsOptional()
    @Transform(({ value }) => ChatbotConfigDto.validateAllowedDomains(value))
    allowed_domains?: string;

    @IsNumber()
    @Min(1, { message: 'Ngưỡng giới hạn tần suất phải ít nhất là 1' })
    rate_limit_threshold: number;

    static sanitizeMessage(message: string): string {
        return message.replace('/\s+/g', ' ').trim()
    }

    static validateAllowedDomains(value: string): string | undefined {
        if (!value) 
            return value;
        const domains = value.split(',').map(domain => domain.trim()).filter(Boolean);
        const validatedDomains: string[] = [];
        for (const domainEntry of domains) {
            let cleanedDomain = domainEntry;
      
            // Remove protocol
            if (cleanedDomain.includes('://')) {
              cleanedDomain = cleanedDomain.split('://').pop()!;
            }
      
            // Remove path
            cleanedDomain = cleanedDomain.split('/')[0];
      
            // Basic domain validation
            if (!/^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/.test(cleanedDomain)) {
              throw new Error(`Định dạng tên miền không hợp lệ: ${domainEntry}`);
            }
      
            validatedDomains.push(cleanedDomain);
          }
      
        return validatedDomains.join(',');
    }
}