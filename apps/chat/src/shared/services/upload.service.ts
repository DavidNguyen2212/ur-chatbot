import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID, UUID } from 'crypto';
import { extname } from 'path';

@Injectable()
export class UploadService {
  constructor(
    private readonly s3Client: S3Client,
    private readonly configService: ConfigService
  ) {}

  async uploadFile(file: Express.Multer.File, folder: string, org_id: UUID): Promise<string> {
    const key = `${this.configService.get('UPLOAD_BASE_PATH')}/${org_id}/${folder}/${randomUUID()}${extname(file.originalname)}`;

    const command = new PutObjectCommand({
      Bucket: this.configService.get('S3_BUCKET'),
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    await this.s3Client.send(command);

    return `https://${this.configService.get('S3_BUCKET')}.s3.${this.configService.get('AWS_REGION')}.amazonaws.com/${key}`;
  }
}
