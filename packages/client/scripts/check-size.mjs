import { existsSync, readFileSync } from 'node:fs';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable, Writable } from 'node:stream';

const MAX_GZIP_BYTES = 5120; // 5kb

async function getGzipSize(filePath) {
  const content = readFileSync(filePath);
  let size = 0;
  const readable = Readable.from(content);
  const gzip = createGzip({ level: 9 });
  const counter = new Writable({
    write(chunk, _enc, cb) {
      size += chunk.length;
      cb();
    },
  });
  await pipeline(readable, gzip, counter);
  return size;
}

// tsup names the ESM output index.js when building alongside CJS
const candidates = [
  new URL('../dist/index.mjs', import.meta.url).pathname,
  new URL('../dist/index.js', import.meta.url).pathname,
];
const esmFile = candidates.find((p) => existsSync(p));

if (!esmFile) {
  console.error('check-size: no ESM output found in dist/ — run build first');
  process.exit(1);
}

const gzipSize = await getGzipSize(esmFile);
const kb = (gzipSize / 1024).toFixed(2);

if (gzipSize > MAX_GZIP_BYTES) {
  console.error(`\n❌  @backshift/client bundle too large: ${kb}kb gzipped (limit: 5kb)\n`);
  process.exit(1);
}

console.log(`✓  @backshift/client bundle size: ${kb}kb gzipped (limit: 5kb)`);
