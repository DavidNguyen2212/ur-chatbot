import {
    PipeTransform,
    Injectable,
    BadRequestException,
  } from '@nestjs/common';
  
@Injectable()
export class FileSizeValidationPipe implements PipeTransform {
    constructor(private readonly maxSizeInMB: number) {}

    transform(file: Express.Multer.File) {
        const maxBytes = this.maxSizeInMB * 1024 * 1024;

        if (file && file.size > maxBytes) {
            throw new BadRequestException(`File size should not exceed ${this.maxSizeInMB}MB`);
        }
        return file;
    }
}
