export type ObjectStorageProvider = 'aws_s3' | 'r2';

export interface ObjectStorageConfig {
  provider: ObjectStorageProvider;
  region: string;
  bucket: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  uploadUrlTtlSeconds: number;
  downloadUrlTtlSeconds: number;
}

function required(value: string | undefined, variable: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${variable} is required`);
  return normalized;
}

function ttl(value: string | undefined, fallback: number, variable: string) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 60 || parsed > 86_400) {
    throw new Error(`${variable} must be between 60 and 86400 seconds`);
  }
  return parsed;
}

export function loadObjectStorageConfig(
  env: NodeJS.ProcessEnv = process.env
): ObjectStorageConfig {
  const provider = (env['OBJECT_STORAGE_PROVIDER'] || 'aws_s3')
    .trim()
    .toLowerCase();
  if (provider !== 'aws_s3' && provider !== 'r2') {
    throw new Error('OBJECT_STORAGE_PROVIDER must be aws_s3 or r2');
  }

  const bucket = required(
    provider === 'r2'
      ? env['OBJECT_STORAGE_BUCKET']
      : env['OBJECT_STORAGE_BUCKET'] || env['AWS_S3_BUCKET_NAME'],
    provider === 'aws_s3'
      ? 'OBJECT_STORAGE_BUCKET or AWS_S3_BUCKET_NAME'
      : 'OBJECT_STORAGE_BUCKET'
  );
  const accessKeyId = required(
    provider === 'r2'
      ? env['OBJECT_STORAGE_ACCESS_KEY_ID']
      : env['OBJECT_STORAGE_ACCESS_KEY_ID'] || env['AWS_ACCESS_KEY_ID'],
    provider === 'aws_s3'
      ? 'OBJECT_STORAGE_ACCESS_KEY_ID or AWS_ACCESS_KEY_ID'
      : 'OBJECT_STORAGE_ACCESS_KEY_ID'
  );
  const secretAccessKey = required(
    provider === 'r2'
      ? env['OBJECT_STORAGE_SECRET_ACCESS_KEY']
      : env['OBJECT_STORAGE_SECRET_ACCESS_KEY'] || env['AWS_SECRET_ACCESS_KEY'],
    provider === 'aws_s3'
      ? 'OBJECT_STORAGE_SECRET_ACCESS_KEY or AWS_SECRET_ACCESS_KEY'
      : 'OBJECT_STORAGE_SECRET_ACCESS_KEY'
  );

  let endpoint = env['OBJECT_STORAGE_ENDPOINT']?.trim();
  if (provider === 'r2') {
    endpoint = required(endpoint, 'OBJECT_STORAGE_ENDPOINT');
    let url: URL;
    try {
      url = new URL(endpoint);
    } catch {
      throw new Error('OBJECT_STORAGE_ENDPOINT must be a valid HTTPS URL');
    }
    if (url.protocol !== 'https:') {
      throw new Error('OBJECT_STORAGE_ENDPOINT must use HTTPS');
    }
  }

  return {
    provider,
    region:
      provider === 'r2'
        ? env['OBJECT_STORAGE_REGION']?.trim() || 'auto'
        : required(
            env['OBJECT_STORAGE_REGION'] || env['AWS_REGION'],
            'OBJECT_STORAGE_REGION or AWS_REGION'
          ),
    bucket,
    ...(endpoint ? { endpoint } : {}),
    accessKeyId,
    secretAccessKey,
    uploadUrlTtlSeconds: ttl(
      env['OBJECT_STORAGE_UPLOAD_URL_TTL_SECONDS'],
      600,
      'OBJECT_STORAGE_UPLOAD_URL_TTL_SECONDS'
    ),
    downloadUrlTtlSeconds: ttl(
      env['OBJECT_STORAGE_DOWNLOAD_URL_TTL_SECONDS'],
      3600,
      'OBJECT_STORAGE_DOWNLOAD_URL_TTL_SECONDS'
    ),
  };
}
