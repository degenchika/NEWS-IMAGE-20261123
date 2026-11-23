// Driver program the harness runs with Node 22: it copies the entry image
// to $MAKEFUN_OUTPUT_DIR/entry.png and sanity-checks the result.
//
// The output directory is only ever created with mkdir, never removed: the
// grader mounts the output directory as a volume, and removing the mount
// point itself (rmSync on the directory) throws EBUSY "Device or resource
// busy" even with force:true, which would fail the run. So the only
// directory operation here is mkdirSync(outDir, { recursive: true }).

import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? "./out";
const SRC = new URL("./entry.png", import.meta.url);

if (!existsSync(SRC)) {
  console.error("entry.png is missing from the repository");
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });
const dest = join(OUT_DIR, "entry.png");
copyFileSync(SRC, dest);

// Verify the copy landed byte-for-byte: read both files back and compare.
// A partial or stale write must fail loudly instead of silently shipping
// a truncated image to the judge.
const srcBytes = readFileSync(SRC);
const destBytes = readFileSync(dest);
if (!srcBytes.equals(destBytes)) {
  console.error("entry.png copy mismatch: destination bytes differ from source");
  process.exit(1);
}

// Sanity checks: the file must be a whole PNG or JPEG, at most 1 MiB.
const size = statSync(dest).size;
if (size > 1048576) {
  console.error(`entry.png is ${size} bytes, over the 1 MiB limit`);
  process.exit(1);
}
const head = readFileSync(dest).subarray(0, 4);
const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
if (!isPng && !isJpeg) {
  console.error("entry.png has neither PNG nor JPEG magic bytes");
  process.exit(1);
}
console.log(`wrote ${dest} (${size} bytes)`);
