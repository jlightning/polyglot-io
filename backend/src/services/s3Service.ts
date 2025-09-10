import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dayjs from 'dayjs';
import sharp from 'sharp';

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
    userId: number
  ): Promise<{ uploadUrl: string; key: string }> {
    if (!this.s3Client) {
      this.initialize();
    }

    const key = `lessons/${userId}/${dayjs().valueOf()}-${fileName}`;

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
   * Get file content from S3
   */
  static async getFileContent(key: string): Promise<string> {
    if (!this.s3Client) {
      this.initialize();
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new Error('File content is empty');
      }

      // Convert the stream to string
      const content = await response.Body.transformToString();
      return content;
    } catch (error) {
      console.error('Error getting file content from S3:', error);
      throw new Error('Failed to download file content from S3');
    }
  }

  /**
   * Get file buffer from S3 (for binary files like images)
   */
  static async getFileBuffer(key: string): Promise<Buffer> {
    if (!this.s3Client) {
      this.initialize();
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new Error('File content is empty');
      }

      // Convert the stream to buffer
      const chunks: Uint8Array[] = [];
      const reader = response.Body.transformToWebStream().getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      // Combine all chunks into a single buffer
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const buffer = new Uint8Array(totalLength);
      let offset = 0;

      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.length;
      }

      return Buffer.from(buffer);
    } catch (error) {
      console.error('Error getting file buffer from S3:', error);
      throw new Error('Failed to download file buffer from S3');
    }
  }

  /**
   * Get public file URL from S3
   */
  static getFileUrl(key: string): string {
    const region = process.env['AWS_REGION'] || 'us-east-1';
    return `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`;
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

  /**
   * Convert image file (PNG, GIF, WebP) to JPG and replace it in S3
   * Downloads image from S3, converts to JPG, uploads JPG, and deletes original
   */
  static async convertImageToJpgAndReplace(
    imageKey: string,
    _userId: number
  ): Promise<string> {
    if (!this.s3Client) {
      this.initialize();
    }

    try {
      // Download image file from S3
      const imageBuffer = await this.getFileBuffer(imageKey);

      // Convert image to JPG using Sharp
      const jpgBuffer = await sharp(imageBuffer)
        .jpeg({ quality: 90 }) // High quality JPG
        .toBuffer();

      // Generate new JPG key (replace extension with .jpg)
      const jpgKey = imageKey.replace(/\.(png|gif|webp)$/i, '.jpg');

      // Upload JPG to S3
      const uploadCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: jpgKey,
        Body: jpgBuffer,
        ContentType: 'image/jpeg',
      });

      await this.s3Client.send(uploadCommand);

      // Delete original image file
      await this.deleteFile(imageKey);

      console.log(`Successfully converted ${imageKey} to ${jpgKey}`);
      return jpgKey;
    } catch (error) {
      console.error('Error converting image to JPG:', error);
      throw new Error('Failed to convert image to JPG');
    }
  }

  /**
   * Check if a file is PNG based on its S3 key (kept for backward compatibility)
   */
  static isPngFile(key: string): boolean {
    return key.toLowerCase().endsWith('.png');
  }
}
