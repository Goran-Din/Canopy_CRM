import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env.js';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: env.R2_ENDPOINT,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = env.R2_BUCKET_NAME;

/**
 * Generate presigned upload URL (10-minute expiry).
 */
export async function getPresignedUploadUrl(r2Key: string, mimeType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: r2Key,
    ContentType: mimeType,
  });
  return getSignedUrl(r2Client, command, { expiresIn: 600 });
}

/**
 * Generate presigned download URL (1-hour expiry).
 */
export async function getPresignedDownloadUrl(r2Key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: r2Key,
  });
  return getSignedUrl(r2Client, command, { expiresIn: 3600 });
}

/**
 * Direct upload for system-generated files (PDFs, signatures).
 */
export async function uploadBuffer(r2Key: string, buffer: Buffer, mimeType: string): Promise<void> {
  await r2Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: r2Key,
    Body: buffer,
    ContentType: mimeType,
  }));
}

/**
 * Delete object from R2 (used for cleanup only).
 */
export async function deleteObject(r2Key: string): Promise<void> {
  await r2Client.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: r2Key,
  }));
}
