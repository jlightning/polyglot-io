import { randomUUID } from 'crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import type { Context } from './index';
import {
  loadObjectStorageConfig,
  type ObjectStorageConfig,
} from './objectStorageConfig';

export interface ObjectMetadata {
  contentLength: number | null;
  contentType: string | null;
  etag: string | null;
}

function safeFileName(fileName: string): string {
  const baseName = fileName.split(/[\\/]/).pop() || 'upload';
  const normalized = baseName
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return normalized || 'upload';
}

/** S3-compatible object storage selected by OBJECT_STORAGE_PROVIDER. */
export class ObjectStorageService {
  private client?: S3Client;
  private config?: ObjectStorageConfig;

  initialize(_ctx?: Context): void {
    const config = loadObjectStorageConfig();
    this.config = config;
    this.client = new S3Client({
      region: config.region,
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  private ready(): { client: S3Client; config: ObjectStorageConfig } {
    if (!this.client || !this.config) this.initialize();
    return { client: this.client!, config: this.config! };
  }

  get provider(): string {
    return this.ready().config.provider;
  }

  async getUploadUrl(
    _ctx: Context,
    fileName: string,
    fileType: string,
    userId: number
  ): Promise<{ uploadUrl: string; key: string }> {
    const { client, config } = this.ready();
    const key = `lessons/${userId}/${randomUUID()}/${safeFileName(fileName)}`;
    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: fileType,
    });
    const uploadUrl = await getSignedUrl(client, command, {
      expiresIn: config.uploadUrlTtlSeconds,
      signableHeaders: new Set(['content-type']),
    });
    return { uploadUrl, key };
  }

  async getDownloadUrl(_ctx: Context, key: string): Promise<string> {
    const { client, config } = this.ready();
    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: config.bucket, Key: key }),
      { expiresIn: config.downloadUrlTtlSeconds }
    );
  }

  async headObject(_ctx: Context, key: string): Promise<ObjectMetadata> {
    const { client, config } = this.ready();
    const response = await client.send(
      new HeadObjectCommand({ Bucket: config.bucket, Key: key })
    );
    return {
      contentLength: response.ContentLength ?? null,
      contentType: response.ContentType ?? null,
      etag: response.ETag ?? null,
    };
  }

  async getFileContent(ctx: Context, key: string): Promise<string> {
    const { client, config } = this.ready();
    try {
      const response = await client.send(
        new GetObjectCommand({ Bucket: config.bucket, Key: key })
      );
      if (!response.Body) throw new Error('File content is empty');
      return response.Body.transformToString();
    } catch (error) {
      console.error(`Object download failed (${config.provider}):`, error);
      throw new Error('Failed to download object content');
    }
  }

  async getFileBuffer(ctx: Context, key: string): Promise<Buffer> {
    const { client, config } = this.ready();
    try {
      const response = await client.send(
        new GetObjectCommand({ Bucket: config.bucket, Key: key })
      );
      if (!response.Body) throw new Error('File content is empty');
      return Buffer.from(await response.Body.transformToByteArray());
    } catch (error) {
      console.error(
        `Object buffer download failed (${config.provider}):`,
        error
      );
      throw new Error('Failed to download object buffer');
    }
  }

  async deleteFile(_ctx: Context, key: string): Promise<boolean> {
    const { client, config } = this.ready();
    try {
      await client.send(
        new DeleteObjectCommand({ Bucket: config.bucket, Key: key })
      );
      return true;
    } catch (error) {
      console.error(`Object deletion failed (${config.provider}):`, error);
      return false;
    }
  }

  async convertImageToJpgAndReplace(
    ctx: Context,
    imageKey: string,
    _userId: number
  ): Promise<string> {
    const { client, config } = this.ready();
    try {
      const imageBuffer = await this.getFileBuffer(ctx, imageKey);
      const jpgBuffer = await sharp(imageBuffer)
        .jpeg({ quality: 90 })
        .toBuffer();
      const jpgKey = imageKey.replace(/\.(png|gif|webp)$/i, '.jpg');
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: jpgKey,
          Body: jpgBuffer,
          ContentType: 'image/jpeg',
        })
      );
      await this.deleteFile(ctx, imageKey);
      return jpgKey;
    } catch (error) {
      console.error(`Image conversion failed (${config.provider}):`, error);
      throw new Error('Failed to convert image to JPG');
    }
  }

  isPngFile(_ctx: Context, key: string): boolean {
    return key.toLowerCase().endsWith('.png');
  }
}
