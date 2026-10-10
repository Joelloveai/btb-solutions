/**
 * One-off: copy every photo from local disk (./uploads) into Cloudflare R2.
 *
 *   npm run photos:migrate-to-r2 -- --dry-run          # show what would happen
 *   npm run photos:migrate-to-r2                       # copy and verify
 *   npm run photos:migrate-to-r2 -- --delete-local     # ...and remove each local copy once it is verified in R2
 *
 * Safe to re-run: photos already in R2 are skipped. A local copy is only ever deleted after R2 holds
 * an object of exactly the same size. The database needs no change because an R2 key is derived from
 * each photo's project id, photo id and type (see photoKey in lib/photos.ts).
 */
import { PrismaClient } from "@prisma/client";
import { deleteLocalPhotoFile, photoKey, readLocalPhotoFile } from "../lib/photos";
import { isR2Configured, r2ObjectSize, uploadToR2 } from "../lib/r2-storage";

// tsx does not read .env files by itself; Next.js reads .env.local first, then .env.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    /* file not present */
  }
}

const dryRun = process.argv.includes("--dry-run");
const deleteLocal = process.argv.includes("--delete-local");

async function main() {
  if (!isR2Configured()) {
    console.error("R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET_NAME first.");
    process.exit(1);
  }
  const prisma = new PrismaClient();
  const photos = await prisma.photo.findMany({ orderBy: { createdAt: "asc" } });
  console.log(`${photos.length} photo(s) in the database${dryRun ? " (dry run: nothing will be changed)" : ""}`);

  const tally = { uploaded: 0, alreadyThere: 0, missing: 0, failed: 0, localRemoved: 0 };

  for (const photo of photos) {
    const key = photoKey(photo);
    try {
      let local: Uint8Array | null = null;
      try {
        local = await readLocalPhotoFile(photo.id);
      } catch {
        local = null;
      }
      const remoteSize = await r2ObjectSize(key);

      if (remoteSize !== null) {
        tally.alreadyThere += 1;
        console.log(`= ${key} already in R2`);
      } else if (!local) {
        tally.missing += 1;
        console.error(`! ${key} has no local file and is not in R2: the photo is lost`);
        continue;
      } else if (dryRun) {
        console.log(`+ ${key} would be uploaded (${local.length} bytes)`);
        continue;
      } else {
        await uploadToR2(local, key, photo.mimeType);
        const stored = await r2ObjectSize(key);
        if (stored !== local.length) throw new Error(`size mismatch after upload (local ${local.length}, R2 ${stored})`);
        tally.uploaded += 1;
        console.log(`+ ${key} uploaded and verified (${local.length} bytes)`);
      }

      if (deleteLocal && !dryRun && local) {
        const verified = await r2ObjectSize(key);
        if (verified === local.length) {
          await deleteLocalPhotoFile(photo.id);
          tally.localRemoved += 1;
        }
      }
    } catch (error) {
      tally.failed += 1;
      console.error(`x ${key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`\nDone. uploaded ${tally.uploaded}, already in R2 ${tally.alreadyThere}, missing ${tally.missing}, failed ${tally.failed}, local copies removed ${tally.localRemoved}`);
  await prisma.$disconnect();
  if (tally.failed > 0 || tally.missing > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
