import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// R2 is mocked: no network and no Cloudflare account are needed. `sent` records every command.
const sent: { type: string; input: Record<string, unknown> }[] = [];
const clients: { config: Record<string, unknown> }[] = [];
let respond: (command: { type: string; input: Record<string, unknown> }) => unknown = () => ({});

vi.mock("@aws-sdk/client-s3", () => {
  const command = (type: string) =>
    class {
      type = type;
      constructor(public input: Record<string, unknown>) {}
    };
  class S3Client {
    constructor(public config: Record<string, unknown>) {
      clients.push(this);
    }
    async send(c: { type: string; input: Record<string, unknown> }) {
      sent.push(c);
      return respond(c);
    }
  }
  return {
    S3Client,
    PutObjectCommand: command("put"),
    GetObjectCommand: command("get"),
    DeleteObjectCommand: command("delete"),
    HeadObjectCommand: command("head"),
  };
});
const getSignedUrl = vi.fn(async (..._args: unknown[]) => "https://signed.example/photo?sig=1");
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl }));

const FULL = { R2_ACCOUNT_ID: "acct123", R2_ACCESS_KEY_ID: "key", R2_SECRET_ACCESS_KEY: "secret", R2_BUCKET_NAME: "btb-photos" };
const noSuchKey = Object.assign(new Error("nope"), { name: "NoSuchKey", $metadata: { httpStatusCode: 404 } });

function env(vars: Record<string, string>) {
  for (const name of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_ENDPOINT"]) vi.stubEnv(name, vars[name] ?? "");
}

let dir: string;
beforeEach(async () => {
  sent.length = 0;
  clients.length = 0;
  respond = () => ({});
  getSignedUrl.mockClear();
  vi.resetModules();
  dir = await mkdtemp(path.join(os.tmpdir(), "btb-photos-"));
  vi.stubEnv("UPLOAD_DIR", dir);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

describe("R2 configuration", () => {
  it("is off when no R2 variable is set, so development needs no Cloudflare account", async () => {
    env({});
    const { isR2Configured } = await import("@/lib/r2-storage");
    expect(isR2Configured()).toBe(false);
  });

  it("refuses a partial configuration instead of silently writing to a disk that can vanish", async () => {
    env({ R2_ACCOUNT_ID: "acct123", R2_BUCKET_NAME: "btb-photos" });
    const { r2Config } = await import("@/lib/r2-storage");
    expect(() => r2Config()).toThrow(/R2_ACCESS_KEY_ID.*R2_SECRET_ACCESS_KEY/);
  });

  it("derives the endpoint from the account id, and honours an explicit one", async () => {
    env(FULL);
    let mod = await import("@/lib/r2-storage");
    expect(mod.r2Config()?.endpoint).toBe("https://acct123.r2.cloudflarestorage.com");
    env({ ...FULL, R2_ENDPOINT: "https://custom.example" });
    vi.resetModules();
    mod = await import("@/lib/r2-storage");
    expect(mod.r2Config()?.endpoint).toBe("https://custom.example");
  });
});

describe("r2-storage operations", () => {
  it("uploads with the bucket, key and content type, and returns the key", async () => {
    env(FULL);
    const { uploadToR2 } = await import("@/lib/r2-storage");
    const body = new Uint8Array([1, 2, 3]);
    expect(await uploadToR2(body, "projects/p/x.png", "image/png")).toBe("projects/p/x.png");
    expect(sent).toEqual([{ type: "put", input: { Bucket: "btb-photos", Key: "projects/p/x.png", Body: body, ContentType: "image/png" } }]);
  });

  it("builds an R2 client with region auto and checksums only when required (R2 rejects the SDK's default CRC32 header)", async () => {
    env(FULL);
    const { uploadToR2 } = await import("@/lib/r2-storage");
    await uploadToR2(new Uint8Array([1]), "k", "image/png");
    expect(clients[0]?.config).toMatchObject({
      region: "auto",
      endpoint: "https://acct123.r2.cloudflarestorage.com",
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  });

  it("presigns a download link that lasts one hour by default", async () => {
    env(FULL);
    const { getPresignedUrl } = await import("@/lib/r2-storage");
    expect(await getPresignedUrl("projects/p/x.png")).toBe("https://signed.example/photo?sig=1");
    expect(getSignedUrl).toHaveBeenCalledOnce();
    expect(getSignedUrl.mock.calls[0]?.[2]).toEqual({ expiresIn: 3600 });
  });

  it("deletes by key", async () => {
    env(FULL);
    const { deleteFromR2 } = await import("@/lib/r2-storage");
    await deleteFromR2("projects/p/x.png");
    expect(sent[0]).toMatchObject({ type: "delete", input: { Bucket: "btb-photos", Key: "projects/p/x.png" } });
  });

  it("reads bytes back, and returns null for a missing object", async () => {
    env(FULL);
    const { downloadFromR2 } = await import("@/lib/r2-storage");
    respond = () => ({ Body: { transformToByteArray: async () => new Uint8Array([9, 8]) } });
    expect(await downloadFromR2("k")).toEqual(new Uint8Array([9, 8]));
    respond = () => {
      throw noSuchKey;
    };
    expect(await downloadFromR2("k")).toBeNull();
  });
});

describe("photo storage switch", () => {
  const photo = { id: "ckphoto0001abc", projectId: "ckproject0001", mimeType: "image/png" };
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5]);

  it("names each photo projects/{projectId}/{photoId}.{ext}", async () => {
    const { photoKey } = await import("@/lib/photos");
    expect(photoKey(photo)).toBe("projects/ckproject0001/ckphoto0001abc.png");
    expect(photoKey({ ...photo, mimeType: "image/jpeg" })).toMatch(/\.jpg$/);
    expect(photoKey({ ...photo, mimeType: "image/webp" })).toMatch(/\.webp$/);
  });

  it("uses R2 when configured, and writes nothing to local disk", async () => {
    env(FULL);
    const { savePhotoFile } = await import("@/lib/photos");
    await savePhotoFile(photo, bytes);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ type: "put", input: { Key: "projects/ckproject0001/ckphoto0001abc.png", ContentType: "image/png" } });
    await expect(readFile(path.join(dir, "photos", photo.id))).rejects.toThrow();
  });

  it("falls back to local disk when R2 is not configured", async () => {
    env({});
    const { savePhotoFile, readPhotoFile } = await import("@/lib/photos");
    await savePhotoFile(photo, bytes);
    expect(sent).toHaveLength(0);
    expect(new Uint8Array(await readPhotoFile(photo))).toEqual(bytes);
  });

  it("still finds a photo that is on local disk but not yet in R2 (before the migration script has run)", async () => {
    env({});
    const { savePhotoFile } = await import("@/lib/photos");
    await savePhotoFile(photo, bytes); // saved locally, as before R2 existed
    env(FULL);
    vi.resetModules();
    respond = () => {
      throw noSuchKey;
    };
    const { readPhotoFile } = await import("@/lib/photos");
    expect(new Uint8Array(await readPhotoFile(photo))).toEqual(bytes);
  });

  it("deletes from R2 and clears any leftover local copy", async () => {
    env(FULL);
    const { deletePhotoFile } = await import("@/lib/photos");
    await deletePhotoFile(photo);
    expect(sent[0]).toMatchObject({ type: "delete", input: { Key: "projects/ckproject0001/ckphoto0001abc.png" } });
  });

  it("refuses an id that could escape the upload directory", async () => {
    env({});
    const { savePhotoFile } = await import("@/lib/photos");
    await expect(savePhotoFile({ ...photo, id: "../../etc/passwd" }, bytes)).rejects.toThrow(/Bad photo id/);
  });
});
