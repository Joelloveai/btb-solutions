import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 (S3-compatible) storage for photos.
 *
 * Configured by environment variables; when none are set the app keeps using local disk
 * (see lib/photos.ts), so development works without any Cloudflare account.
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME,
 *   R2_ENDPOINT (optional: defaults to https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com)
 */

export type R2Config = { endpoint: string; accessKeyId: string; secretAccessKey: string; bucket: string };

const read = (name: string) => process.env[name]?.trim() || undefined;

/**
 * Returns the R2 settings, or null when R2 is not configured at all.
 * A PARTLY configured R2 is an error, not a silent fallback: quietly writing photos to a
 * disk that disappears on restart is exactly the failure this storage exists to prevent.
 */
export function r2Config(): R2Config | null {
  const accountId = read("R2_ACCOUNT_ID");
  const accessKeyId = read("R2_ACCESS_KEY_ID");
  const secretAccessKey = read("R2_SECRET_ACCESS_KEY");
  const bucket = read("R2_BUCKET_NAME");
  const endpoint = read("R2_ENDPOINT") ?? (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);

  if (!accountId && !accessKeyId && !secretAccessKey && !bucket && !read("R2_ENDPOINT")) return null;

  const missing = [
    !endpoint && "R2_ACCOUNT_ID (or R2_ENDPOINT)",
    !accessKeyId && "R2_ACCESS_KEY_ID",
    !secretAccessKey && "R2_SECRET_ACCESS_KEY",
    !bucket && "R2_BUCKET_NAME",
  ].filter(Boolean);
  if (missing.length > 0) throw new Error(`Cloudflare R2 is only partly configured. Missing: ${missing.join(", ")}`);

  return { endpoint: endpoint!, accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey!, bucket: bucket! };
}

export const isR2Configured = () => r2Config() !== null;

let cached: { signature: string; client: S3Client } | null = null;

function connect(): { client: S3Client; bucket: string } {
  const config = r2Config();
  if (!config) throw new Error("Cloudflare R2 is not configured");
  const signature = `${config.endpoint}|${config.accessKeyId}|${config.bucket}`;
  if (!cached || cached.signature !== signature) {
    cached = {
      signature,
      client: new S3Client({
        region: "auto", // R2 has no regions
        endpoint: config.endpoint,
        credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
        // Newer AWS SDKs add CRC32 checksum headers by default, which R2 rejects on uploads.
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
      }),
    };
  }
  return { client: cached.client, bucket: config.bucket };
}

const isMissing = (error: unknown) => {
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === "NoSuchKey" || e?.name === "NotFound" || e?.$metadata?.httpStatusCode === 404;
};

/** Store an object and return its key. */
export async function uploadToR2(buffer: Uint8Array, key: string, contentType: string): Promise<string> {
  const { client, bucket } = connect();
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType }));
  return key;
}

/** Read an object into memory, or null when it does not exist. */
export async function downloadFromR2(key: string): Promise<Uint8Array | null> {
  const { client, bucket } = connect();
  try {
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return response.Body ? await response.Body.transformToByteArray() : null;
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

/** A link that works without signing in for `expiresIn` seconds (default 1 hour). Anyone holding it can read the object. */
export async function getPresignedUrl(key: string, expiresIn = 60 * 60): Promise<string> {
  const { client, bucket } = connect();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn });
}

export async function deleteFromR2(key: string): Promise<void> {
  const { client, bucket } = connect();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** Size in bytes of a stored object, or null when it does not exist. */
export async function r2ObjectSize(key: string): Promise<number | null> {
  const { client, bucket } = connect();
  try {
    const response = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return response.ContentLength ?? 0;
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}
