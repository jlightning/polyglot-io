import assert from 'node:assert/strict';
import test from 'node:test';
import { loadObjectStorageConfig } from './objectStorageConfig';

test('loads legacy AWS S3 configuration by default', () => {
  const config = loadObjectStorageConfig({
    AWS_REGION: 'ap-southeast-1',
    AWS_S3_BUCKET_NAME: 'legacy-bucket',
    AWS_ACCESS_KEY_ID: 'legacy-id',
    AWS_SECRET_ACCESS_KEY: 'legacy-secret',
  });
  assert.equal(config.provider, 'aws_s3');
  assert.equal(config.bucket, 'legacy-bucket');
  assert.equal(config.uploadUrlTtlSeconds, 600);
});

test('loads Cloudflare R2 configuration with region auto', () => {
  const config = loadObjectStorageConfig({
    OBJECT_STORAGE_PROVIDER: 'r2',
    OBJECT_STORAGE_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
    OBJECT_STORAGE_BUCKET: 'polyglot-r2',
    OBJECT_STORAGE_ACCESS_KEY_ID: 'r2-id',
    OBJECT_STORAGE_SECRET_ACCESS_KEY: 'r2-secret',
  });
  assert.equal(config.provider, 'r2');
  assert.equal(config.region, 'auto');
  assert.equal(config.endpoint, 'https://account.r2.cloudflarestorage.com');
});

test('rejects R2 without an HTTPS endpoint', () => {
  assert.throws(
    () =>
      loadObjectStorageConfig({
        OBJECT_STORAGE_PROVIDER: 'r2',
        OBJECT_STORAGE_ENDPOINT: 'http://account.r2.cloudflarestorage.com',
        OBJECT_STORAGE_BUCKET: 'polyglot-r2',
        OBJECT_STORAGE_ACCESS_KEY_ID: 'r2-id',
        OBJECT_STORAGE_SECRET_ACCESS_KEY: 'r2-secret',
      }),
    /must use HTTPS/
  );
});

test('does not reuse legacy AWS credentials for R2', () => {
  assert.throws(
    () =>
      loadObjectStorageConfig({
        OBJECT_STORAGE_PROVIDER: 'r2',
        OBJECT_STORAGE_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
        AWS_S3_BUCKET_NAME: 'aws-bucket',
        AWS_ACCESS_KEY_ID: 'aws-id',
        AWS_SECRET_ACCESS_KEY: 'aws-secret',
      }),
    /OBJECT_STORAGE_BUCKET is required/
  );
});
