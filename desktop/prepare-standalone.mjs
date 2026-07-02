// Copies the assets Next's standalone server.js doesn't bundle on its own
// (public/ and .next/static/) into .next/standalone/ after `next build`.
// See: node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md
import { cpSync, existsSync } from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');
const standaloneDir = path.join(root, '.next', 'standalone');

if (!existsSync(standaloneDir)) {
  console.error(`Missing ${standaloneDir} — run "next build" first.`);
  process.exit(1);
}

cpSync(path.join(root, 'public'), path.join(standaloneDir, 'public'), { recursive: true });
cpSync(path.join(root, '.next', 'static'), path.join(standaloneDir, '.next', 'static'), { recursive: true });

console.log('Copied public/ and .next/static/ into .next/standalone/');
