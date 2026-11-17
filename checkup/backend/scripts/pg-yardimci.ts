import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

/**
 * Geçici veritabanı yardımcıları (testler ve `npm run db:denetle`).
 * Yalnızca adı "checkup_test_" ile başlayan veritabanları açılır ve silinir:
 * asıl veritabanlarına (kocumnet, kocumnet_checkup, checkup_dev) dokunulamaz.
 * Bağlantı adresleri hiçbir zaman günlüğe yazılmaz (parola içerir).
 */

export const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GECICI_AD = /^checkup_test_[a-z0-9_]{4,40}$/;

export function rastgeleAd(onek = "checkup_test_"): string {
  return `${onek}${randomBytes(5).toString("hex")}`;
}

/** Sunucu adresi: TEST_DATABASE_BASE_URL, yoksa DATABASE_URL'ün sunucusu. */
export function sunucuAdresi(): string {
  const ham = process.env.TEST_DATABASE_BASE_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!ham) throw new Error("TEST_DATABASE_BASE_URL (ya da DATABASE_URL) tanımlı değil.");
  return ham;
}

export function veritabaniAdresi(sunucu: string, ad: string): string {
  const u = new URL(sunucu);
  u.pathname = `/${ad}`;
  return u.toString();
}

function adDenetle(ad: string) {
  if (!GECICI_AD.test(ad)) throw new Error(`Geçici veritabanı adı "checkup_test_" ile başlamalı: ${ad}`);
}

async function bakimBaglantisi<T>(sunucu: string, is: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = new pg.Client({ connectionString: veritabaniAdresi(sunucu, "postgres") });
  await c.connect();
  try {
    return await is(c);
  } finally {
    await c.end();
  }
}

export async function veritabaniAc(sunucu: string, ad: string): Promise<string> {
  adDenetle(ad);
  await bakimBaglantisi(sunucu, (c) => c.query(`CREATE DATABASE "${ad}"`));
  return veritabaniAdresi(sunucu, ad);
}

export async function veritabaniSil(sunucu: string, ad: string): Promise<void> {
  adDenetle(ad);
  await bakimBaglantisi(sunucu, (c) => c.query(`DROP DATABASE IF EXISTS "${ad}" WITH (FORCE)`));
}

export async function veritabaniVarMi(sunucu: string, ad: string): Promise<boolean> {
  return bakimBaglantisi(sunucu, async (c) => (await c.query("SELECT 1 FROM pg_database WHERE datname = $1", [ad])).rowCount === 1);
}

/** prisma CLI'yi bu paketin node_modules'ünden çalıştırır. */
export function prismaCalistir(arglar: string[], ekOrtam: Record<string, string> = {}): Promise<{ kod: number; cikti: string }> {
  const cli = path.join(KOK, "node_modules", "prisma", "build", "index.js");
  return new Promise((coz, reddet) => {
    const p = spawn(process.execPath, [cli, ...arglar], {
      cwd: KOK,
      env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: "1", ...ekOrtam },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let cikti = "";
    p.stdout.on("data", (d) => (cikti += d));
    p.stderr.on("data", (d) => (cikti += d));
    p.on("error", reddet);
    p.on("close", (kod) => coz({ kod: kod ?? 1, cikti }));
  });
}

/** Bağlantı adresi geçebilecek metinlerden parolayı siler (günlüğe yazmadan önce). */
export function adresleriGizle(metin: string): string {
  return metin.replace(/(postgres(?:ql)?:\/\/)[^@\s]*@/gi, "$1***@");
}
