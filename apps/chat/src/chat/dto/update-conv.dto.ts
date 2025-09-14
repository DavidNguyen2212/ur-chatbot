import { IsOptional, IsBoolean, IsString, IsDateString } from 'class-validator';

export class UpdateConversationDto {
  @IsOptional()
  @IsString()
  customer_name?: string;

  @IsOptional()
  @IsString()
  mode?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsDateString()
  ended_at?: Date;

  // Thêm các trường khác nếu cần cập nhật
}
