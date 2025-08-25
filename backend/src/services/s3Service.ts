import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export class S3Service {
  private static s3Client: S3Client;
  private static bucketName: string;

  static initialize() {
    if (!process.env['AWS_REGION'] || !process.env['AWS_S3_BUCKET_NAME']) {
      throw new Error(
        'AWS configuration missing. Please set AWS_REGION and AWS_S3_BUCKET_NAME environment variables.'
      );
    }

    this.bucketName = process.env['AWS_S3_BUCKET_NAME'];

    this.s3Client = new S3Client({
      region: process.env['AWS_REGION'],
      credentials: {
        accessKeyId: process.env['AWS_ACCESS_KEY_ID'] || '',
        secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] || '',
      },
    });
  }

  /**
   * Generate a pre-signed URL for file upload
   */
  static async getUploadUrl(
    fileName: string,
    fileType: string,
    userId: number,
    maxSize?: number
  ): Promise<{ uploadUrl: string; key: string }> {
    if (!this.s3Client) {
      this.initialize();
    }

    const key = `lessons/${userId}/${Date.now()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: fileType,
      // Remove ContentLength as it can cause issues with presigned URLs
      // The browser will set the correct content length automatically
    });

    // Add conditions to the presigned URL to ensure security
    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 3600,
      // Add conditions to match what the client will send
      signableHeaders: new Set(['content-type']),
    });

    return { uploadUrl, key };
  }

  /**
   * Generate a pre-signed URL for file download
   */
  static async getDownloadUrl(key: string): Promise<string> {
    if (!this.s3Client) {
      this.initialize();
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
  }

  /**
   * Delete a file from S3
   */
  static async deleteFile(key: string): Promise<boolean> {
    if (!this.s3Client) {
      this.initialize();
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      console.error('Error deleting file from S3:', error);
      return false;
    }
  }
}
