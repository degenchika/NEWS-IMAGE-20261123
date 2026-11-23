// News-image entry driver: publishes entry.png into the harness output
// folder so the judge can look at it.
//
// The grader hands us the output folder as a mounted volume, so this
// program only ever *creates* directories. Deleting the folder (or its
// parent) would try to remove the mount point itself and crash with
// EBUSY, so there is no removal call anywhere in this file.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ONE_MIB = 1024 * 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

// Where the harness wants the image. Falls back to a local folder when
// the variable is unset (handy for a quick manual run).
function resolveOutputDir(): string {
  const fromEnv = process.env.MAKEFUN_OUTPUT_DIR;
  return fromEnv !== undefined && fromEnv !== "" ? fromEnv : "./out";
}

// Absolute path of the image sitting next to this script.
function resolveEntryPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "entry.png");
}

// Read the entry image into memory, bailing out if it is not there.
function loadEntryImage(entryPath: string): Buffer {
  if (!existsSync(entryPath)) {
    console.error(`cannot find entry image at ${entryPath}`);
    process.exit(1);
  }
  return readFileSync(entryPath);
}

// The bounty wants one whole PNG or JPEG of at most 1 MiB. Check the
// bytes we are about to ship before anything is written.
function checkImage(bytes: Buffer): void {
  if (bytes.length > ONE_MIB) {
    console.error(`entry image is ${bytes.length} bytes, over the 1 MiB limit`);
    process.exit(1);
  }
  const head = bytes.subarray(0, 4);
  const looksPng = PNG_SIGNATURE.every((byte, i) => head[i] === byte);
  const looksJpeg = JPEG_SIGNATURE.every((byte, i) => head[i] === byte);
  if (!looksPng && !looksJpeg) {
    console.error("entry image starts with neither PNG nor JPEG magic bytes");
    process.exit(1);
  }
}

// Make sure the destination folder exists, then write the image there.
// The write is atomic: bytes go to a temporary file in the same folder
// and are renamed over the target, so a reader never sees a half-written
// entry.png if the process dies mid-write.
function publishImage(bytes: Buffer, outDir: string): string {
  mkdirSync(outDir, { recursive: true });
  const target = join(outDir, "entry.png");
  const temp = join(outDir, "entry.png.tmp");
  writeFileSync(temp, bytes);
  renameSync(temp, target);
  return target;
}

// Read the written file back and make sure it matches the source bytes
// exactly. A short or stale write must fail here, never reach the judge.
function verifyCopy(sourceBytes: Buffer, target: string): void {
  const written = readFileSync(target);
  if (!written.equals(sourceBytes)) {
    console.error(`written copy at ${target} differs from the entry image`);
    process.exit(1);
  }
}

function main(): void {
  const entryPath = resolveEntryPath();
  const image = loadEntryImage(entryPath);
  checkImage(image);
  const outDir = resolveOutputDir();
  const target = publishImage(image, outDir);
  verifyCopy(image, target);
  console.log(`wrote ${target} (${image.length} bytes)`);
}

main();
