#!/usr/bin/env node
/**
 * design/tokens.css → üç projeye kopyalar; --check ile eşitliği doğrular.
 *
 *   node design/sync.mjs          kopyala
 *   node design/sync.mjs --check  farklıysa 1 ile çık (build öncesi)
 *
 * Aynı desen Prisma şeması için admin/scripts/checkup-sync.mjs'te var.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const KAYNAK = join(here, "tokens.css");
const HEDEFLER = [
  join(root, "frontend", "app", "tokens.css"),
  join(root, "app", "app", "tokens.css"),
  join(root, "admin", "src", "app", "tokens.css"),
];

const check = process.argv.includes("--check");
const kaynak = readFileSync(KAYNAK, "utf8");

let farkli = 0;
for (const hedef of HEDEFLER) {
  const ad = relative(root, hedef).replaceAll("\\", "/");
  if (check) {
    if (!existsSync(hedef)) {
      console.error(`✗ ${ad} yok`);
      farkli++;
    } else if (readFileSync(hedef, "utf8") !== kaynak) {
      console.error(`✗ ${ad} design/tokens.css'ten farklı — \`node design/sync.mjs\` çalıştır`);
      farkli++;
    } else {
      console.log(`✓ ${ad}`);
    }
    continue;
  }
  mkdirSync(dirname(hedef), { recursive: true });
  copyFileSync(KAYNAK, hedef);
  console.log(`→ ${ad}`);
}

if (check && farkli) process.exit(1);
