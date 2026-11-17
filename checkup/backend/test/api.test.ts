/**
 * API testleri: tek süreçte tek geçici veritabanı (checkup_test_<rastgele>).
 * Kurulum ve silme test/yardimci/ortam.ts'te; veritabanı hata olsa da silinir.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { adminTestleri } from "./api/admin.js";
import { checkupTestleri } from "./api/checkup.js";
import { hesapTestleri } from "./api/hesap.js";
import { istemci, kurucu } from "./yardimci/istemci.js";
import { testOrtamiKur, type TestOrtami } from "./yardimci/ortam.js";

let ortam: TestOrtami | undefined;
const o = (): TestOrtami => {
  if (!ortam) throw new Error("Test ortamı kurulamadı.");
  return ortam;
};
const h = istemci(o);
const k = kurucu(o, h);

before(async () => {
  ortam = await testOrtamiKur();
});

after(async () => {
  await ortam?.kapat();
});

describe("hesaplar", () => hesapTestleri(o, h, k));
describe("check-up", () => checkupTestleri(o, h, k));
describe("admin", () => adminTestleri(o, h, k));

describe("sunucu", () => {
  it("testler boyunca beklenmeyen sunucu hatası (500) olmadı", () => {
    assert.equal(o().beklenmeyenHatalar.length, 0);
  });
});
