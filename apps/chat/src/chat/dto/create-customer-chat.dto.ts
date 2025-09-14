// dtos/create-customer-message.dto.ts
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateCustomerMessageDto {
  @IsNotEmpty()
  @IsString()
  session_id: string;

  @IsNotEmpty()
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  customer_name?: string;

  @IsOptional()
  @IsString()
  customer_email?: string;

  @IsOptional()
  @IsString()
  organization_id?: string;
}
