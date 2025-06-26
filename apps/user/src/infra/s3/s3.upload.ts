import { Upload } from "@aws-sdk/lib-storage";
import { s3 } from "./s3.client";

interface ImagePayload {
  filename: string
  filestream: Buffer<ArrayBufferLike>
  contentType: string
}
export const uploadFileToS3 = async ({ filename, filestream, contentType }: ImagePayload) => {
  const parallelUploads3 = new Upload({
    client: s3,
    params: { Bucket: process.env.S3_BUCKET, Key: filename, Body: filestream, ContentType: contentType },
  
    // optional tags
    tags: [
      /*...*/
    ],
  
    // additional optional fields show default values below:
  
    // (optional) concurrency configuration
    queueSize: 4,
  
    // (optional) size of each part, in bytes, at least 5MB
    partSize: 1024 * 1024 * 5,
  
    // (optional) when true, do not automatically call AbortMultipartUpload when
    // a multipart upload fails to complete. You should then manually handle
    // the leftover parts.
    leavePartsOnError: false,
  });

  return parallelUploads3.done()
}
