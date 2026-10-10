/**
 * Checks your R2 credentials end to end: uploads a tiny test object, reads it back, makes a
 * presigned link, then deletes it.   npm run r2:check
 */
import { deleteFromR2, downloadFromR2, getPresignedUrl, isR2Configured, r2ObjectSize, uploadToR2 } from "../lib/r2-storage";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    /* file not present */
  }
}

async function main() {
  if (!isR2Configured()) {
    console.error("R2 is not configured. Fill in R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET_NAME in .env.");
    process.exit(1);
  }
  const key = `healthcheck/${Date.now()}.txt`;
  const body = new TextEncoder().encode("btb r2 check");
  await uploadToR2(body, key, "text/plain");
  console.log("ok  uploaded", key);
  const size = await r2ObjectSize(key);
  console.log(size === body.length ? "ok  size matches" : `FAIL size is ${size}`);
  const back = await downloadFromR2(key);
  console.log(back && new TextDecoder().decode(back) === "btb r2 check" ? "ok  read back" : "FAIL read back");
  const url = await getPresignedUrl(key, 60);
  const fetched = await fetch(url);
  console.log(fetched.ok ? "ok  presigned link works" : `FAIL presigned link: HTTP ${fetched.status}`);
  await deleteFromR2(key);
  console.log((await r2ObjectSize(key)) === null ? "ok  deleted" : "FAIL still present after delete");
}

main().catch((error) => {
  console.error("FAIL", error instanceof Error ? error.message : error);
  process.exit(1);
});
