import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { UploadService } from './services/upload.service';

@Module({
  imports: [ConfigModule],
  providers: [
    UploadService,
    {
      provide: S3Client,
      useFactory: (configService: ConfigService) => {
        return new S3Client({
          region: configService.get<string>('AWS_REGION'),
          credentials: {
            accessKeyId: configService.get<string>('AWS_ACCESS_KEY_ID') || "AWS_ACCESS_KEY",
            secretAccessKey: configService.get<string>('AWS_SECRET_ACCESS_KEY') || "AWS_SECRET_KEY",
          },
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [UploadService],
})
export class SharedModule {}
