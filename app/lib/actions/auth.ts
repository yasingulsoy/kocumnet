"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSession, destroySession, hesapAc } from "@/lib/auth";
import { sendWelcomeMail } from "@/lib/mailer";
import { denemeYaz, sinirAsildi, sinirDolu, sinirSifirla } from "@/lib/rate-limit";
import { guvenliSonra } from "@/lib/hesap-kurallari";
import { DAVET_HATA_PENCERESI_MS, DAVET_HATA_SINIRI_IP, kodGecerliMi, kodNormalize } from "@/lib/grup-katilim";

export interface FormState {
  error?: string;
  /** Alan bazlı hatalar: { email: "…" } */
  fields?: Record<string, string>;
  /**
   * Gönderilen değerler (PAROLA HARİÇ). React 19 form eylemi bitince formu
   * sıfırlıyor: yanlış parola yazan öğrencinin e-postası, "bu e-posta kayıtlı"
   * uyarısı alanın bütün kayıt formu siliniyordu. Alanlar bunları
   * defaultValue olarak geri yazar.
   */
  values?: Record<string, string>;
}

/** Hata dönüşlerinde forma geri yazılacak değerler — parola ASLA dönmez. */
function geriDon(formData: FormData, alanlar: string[]): Record<string, string> {
  return Object.fromEntries(alanlar.map((a) => [a, String(formData.get(a) ?? "").slice(0, 200)]));
}

const emailSchema = z
  .string()
  .trim()
  .min(1, "E-posta gerekli.")
  .email("Geçerli bir e-posta yazın.")
  .transform((v) => v.toLowerCase());

const registerSchema = z.object({
  name: z.string().trim().min(2, "Adınızı yazın.").max(80),
  email: emailSchema,
  password: z.string().min(8, "Parola en az 8 karakter olmalı.").max(200, "Parola çok uzun."),
  grade: z.enum(["GRADE_9", "GRADE_10", "GRADE_11", "GRADE_12", "GRADUATE"]).optional(),
});

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

/*
 * Kayıt sınırı (IP başına, saatte). Sınıfta tek Wi-Fi'dan 30 öğrenci aynı
 * saatte kaydolabilmeli: eskiden 10'du ve "bu e-posta zaten var" denemeleri
 * de sayılıyordu, sınıfın üçte biri kayıt ekranında kalıyordu.
 *  - Açılan hesap: saatte 40. Her kayıt scrypt çalıştırır ve posta gönderir;
 *    bir saldırgan tek IP'den saatte en fazla 40 sahte hesap açar.
 *  - Başarısız deneme (e-posta zaten kayıtlı): ayrıca saatte 20. Bu cevap
 *    "bu adres kayıtlı mı" sorusunu yanıtladığı için tarama sınırlı kalsın;
 *    sınıfta e-postasını iki kez deneyen birkaç öğrenciye yeter.
 * Biçim hatası (eksik ad, kısa parola, onay kutusu) sayılmaz: sunucuya
 * yük bindirmez, bir şey de açığa çıkarmaz.
 */
const KAYIT_SINIRI_IP = 40;
const KAYIT_HATA_SINIRI_IP = 20;
const KAYIT_PENCERESI_MS = 60 * 60_000;
const SINIR_MESAJI = "Çok fazla deneme yapıldı. Lütfen bir saat sonra tekrar dene.";

/** Zamanlama saldırısına karşı sahte özet — gerçek bir özetle aynı maliyette. */
const DUMMY_HASH =
  "scrypt$65536$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

// ─────────────────────────────────────────────────────────────

export async function registerAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    grade: formData.get("grade") || undefined,
  });

  const values = geriDon(formData, ["name", "email", "kvkk"]);

  if (!parsed.success) return { fields: fieldErrors(parsed.error), values };

  // Sayaçlara önce BAKILIR; yalnızca açılan hesap ve "zaten kayıtlı" sayılır.
  if ((await sinirDolu("kayit-hata", KAYIT_HATA_SINIRI_IP)) || (await sinirDolu("kayit", KAYIT_SINIRI_IP))) {
    return { error: SINIR_MESAJI, values };
  }

  // Onay kutusu tarayıcıda "required" ama bu atlatılabilir; asıl denetim burada.
  if (formData.get("kvkk") !== "on") {
    return { error: "Devam etmek için aydınlatma metnini onaylaman gerekiyor.", values };
  }

  const { name, email, password, grade } = parsed.data;
  // Gizli alanlar (kayıt sayfası adresten taşır): hepsi yeniden süzülür.
  const sonra = guvenliSonra(formData.get("sonra"));
  const grupKodu = kodNormalize(formData.get("grup"));
  const davetli = kodGecerliMi(grupKodu);

  /*
   * Davet bağlantısından geldiyse hesap açılınca gruba katılır (hesapAc).
   * Yanlış kod davet sayfasındaki tahmin sınırına sayılır; sınır doluysa hiç
   * denenmez: kayıt formu kod tahmininin arka kapısı olmasın.
   */
  const grupDene = davetli && !(await sinirDolu("davet-hata", DAVET_HATA_SINIRI_IP));
  const acilis = await hesapAc({
    name,
    email,
    password,
    grade,
    kaynak: formData.get("k"),
    grupKodu: grupDene ? grupKodu : null,
  });
  if (acilis.durum === "VAR") {
    await denemeYaz("kayit-hata", KAYIT_PENCERESI_MS);
    return { fields: { email: "Bu e-posta ile bir hesap zaten var." }, values };
  }
  await denemeYaz("kayit", KAYIT_PENCERESI_MS);
  if (acilis.katilim?.sonuc === "GECERSIZ") await denemeYaz("davet-hata", DAVET_HATA_PENCERESI_MS);
  const user = { id: acilis.userId };

  // Hoş geldin postası akışı BEKLETMEZ: SMTP yavaşsa kayıt yavaşlamasın.
  void sendWelcomeMail({ to: email, name });

  const h = await headers();
  await createSession(user.id, h.get("user-agent") ?? undefined);

  // redirect() özel bir hata fırlatarak çalışır — try/catch İÇİNE ALINMAZ,
  // yoksa yönlendirme yutulur ve sayfa olduğu yerde kalır. Davetle gelen
  // öğrenci katılım sayfasına döner: gruba girdiğini orada görür.
  redirect(davetli ? `/katil/${grupKodu}` : (sonra ?? "/panel"));
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ email: emailSchema, password: z.string().min(1, "Parola gerekli.") })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });

  const values = geriDon(formData, ["email"]);

  if (!parsed.success) return { fields: fieldErrors(parsed.error), values };

  const { email, password } = parsed.data;

  if (await sinirAsildi(`giris:${email}`, 8, 10 * 60_000)) {
    return { error: "Çok fazla deneme yapıldı. Lütfen 10 dakika sonra tekrar deneyin.", values };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  // Kullanıcı yoksa da bir özetleme yapıyoruz: aksi halde yanıt süresi
  // "bu e-posta kayıtlı mı" sorusunu ele verir.
  const ok = user
    ? await verifyPassword(password, user.passwordHash)
    : await verifyPassword(password, DUMMY_HASH);

  if (!user || !ok) {
    // Hangisinin yanlış olduğunu SÖYLEMİYORUZ.
    return { error: "E-posta veya parola hatalı.", values };
  }

  const simdi = new Date();
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: simdi, lastSeenAt: simdi } });
  await sinirSifirla(`giris:${email}`);

  const h = await headers();
  await createSession(user.id, h.get("user-agent") ?? undefined);

  // Giriş isteyen sayfadan gelindiyse oraya (gizli alan; lib/hesap-kurallari.ts
  // guvenliSonra yalnızca bu sitedeki göreli yolu kabul eder).
  redirect(guvenliSonra(formData.get("sonra")) ?? "/panel");
}

export async function logoutAction() {
  await destroySession();
  redirect("/giris");
}
