"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { api } from "@/lib/backend";
import { KAYNAK_CEREZI, KAYNAK_ETIKETLERI, OTURUM_CEREZI, cerezAyarlari } from "@/lib/cerezler";
import { guvenliDonus } from "@/lib/donus";
import type { FormDurumu, OturumYaniti } from "@/lib/tipler";

/*
 * Hesap eylemleri: kayıt, giriş, çıkış, parola sıfırlama.
 *
 * "use server" dosyasından YALNIZCA async fonksiyon ihraç edilir (sabit ya da
 * nesne istemciye boş gider). Formlar sayfada onSubmit ile gönderilir
 * (components/form-eylemi.ts): React'in otomatik form sıfırlaması çalışmaz,
 * hata dönünce yazılanlar yerinde kalır; parolalar sunucudan geri yollanmaz.
 */

function metin(form: FormData, ad: string): string {
  const d = form.get(ad);
  return typeof d === "string" ? d.trim() : "";
}

/** Parola boşlukları kırpılmaz: kullanıcı ne yazdıysa o. */
function parola(form: FormData, ad: string): string {
  const d = form.get(ad);
  return typeof d === "string" ? d : "";
}

const EPOSTA_DESENI = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function oturumuAc(jeton: string) {
  (await cookies()).set(OTURUM_CEREZI, jeton, cerezAyarlari());
}

export async function kayitOl(_onceki: FormDurumu, form: FormData): Promise<FormDurumu> {
  const adSoyad = metin(form, "adSoyad");
  const eposta = metin(form, "eposta");
  const yeniParola = parola(form, "parola");
  const kvkkOnay = form.get("kvkkOnay") === "on";

  const alanlar: Record<string, string> = {};
  if (adSoyad.length < 2 || adSoyad.length > 80) alanlar.adSoyad = "Ad soyad 2 ile 80 karakter arasında olmalı.";
  if (!EPOSTA_DESENI.test(eposta)) alanlar.eposta = "Geçerli bir e-posta yaz.";
  if (yeniParola.length < 8) alanlar.parola = "Parola en az 8 karakter olmalı.";
  if (!kvkkOnay) alanlar.kvkkOnay = "Devam etmek için aydınlatma metnini okuduğunu onayla.";
  if (Object.keys(alanlar).length) return { hata: "Lütfen işaretli alanları düzelt.", alanlar };

  const cerezler = await cookies();
  const kaynak = cerezler.get(KAYNAK_CEREZI)?.value;

  const sonuc = await api<OturumYaniti>("/ogrenci/kayit", {
    method: "POST",
    oturum: false,
    govde: {
      adSoyad,
      eposta,
      parola: yeniParola,
      kvkkOnay: true,
      ...(kaynak && KAYNAK_ETIKETLERI.has(kaynak) ? { kaynak } : {}),
    },
  });
  if (!sonuc.ok) return { hata: sonuc.hata.mesaj, alanlar: sonuc.hata.alanlar };

  await oturumuAc(sonuc.veri.jeton);
  cerezler.delete(KAYNAK_CEREZI);
  redirect("/sinav-sec");
}

export async function girisYap(_onceki: FormDurumu, form: FormData): Promise<FormDurumu> {
  const eposta = metin(form, "eposta");
  const girilenParola = parola(form, "parola");
  const donus = guvenliDonus(metin(form, "donus"));

  const alanlar: Record<string, string> = {};
  if (!EPOSTA_DESENI.test(eposta)) alanlar.eposta = "Geçerli bir e-posta yaz.";
  if (!girilenParola) alanlar.parola = "Parolanı yaz.";
  if (Object.keys(alanlar).length) return { hata: "Lütfen işaretli alanları düzelt.", alanlar };

  const sonuc = await api<OturumYaniti>("/ogrenci/giris", {
    method: "POST",
    oturum: false,
    govde: { eposta, parola: girilenParola },
  });
  if (!sonuc.ok) return { hata: sonuc.hata.mesaj, alanlar: sonuc.hata.alanlar };

  await oturumuAc(sonuc.veri.jeton);
  redirect(donus);
}

export async function cikisYap(): Promise<void> {
  const cerezler = await cookies();
  if (cerezler.has(OTURUM_CEREZI)) {
    // Backend'deki oturumu da kapat. Hata olsa da çerezi sileriz: kullanıcı çıkmak istiyor.
    await api("/ogrenci/cikis", { method: "POST", sessiz: true });
  }
  cerezler.delete(OTURUM_CEREZI);
  redirect("/giris?cikis=1");
}

export async function parolaSifirlamaIste(_onceki: FormDurumu, form: FormData): Promise<FormDurumu> {
  const eposta = metin(form, "eposta");
  if (!EPOSTA_DESENI.test(eposta)) return { alanlar: { eposta: "Geçerli bir e-posta yaz." } };

  const sonuc = await api("/ogrenci/parola-sifirla/istek", {
    method: "POST",
    oturum: false,
    govde: { eposta },
  });
  if (!sonuc.ok) return { hata: sonuc.hata.mesaj, alanlar: sonuc.hata.alanlar };

  // Hesap olsa da olmasa da aynı cevap (API.md): e-postanın kayıtlı olup olmadığı belli olmasın.
  return {
    basari: "Bu e-postayla bir hesap varsa, parolanı yenileme bağlantısını gönderdik. Bağlantı 1 saat geçerli. Gelen kutunu ve gereksiz klasörünü kontrol et.",
  };
}

export async function parolaSifirla(jeton: string, _onceki: FormDurumu, form: FormData): Promise<FormDurumu> {
  const yeniParola = parola(form, "yeniParola");
  const tekrar = parola(form, "yeniParolaTekrar");

  const alanlar: Record<string, string> = {};
  if (yeniParola.length < 8) alanlar.yeniParola = "Parola en az 8 karakter olmalı.";
  else if (yeniParola !== tekrar) alanlar.yeniParolaTekrar = "İki parola aynı değil.";
  if (Object.keys(alanlar).length) return { hata: "Lütfen işaretli alanları düzelt.", alanlar };
  if (typeof jeton !== "string" || !jeton || jeton.length > 512) return { hata: "Bu bağlantı geçersiz. Yeni bir bağlantı iste." };

  const sonuc = await api("/ogrenci/parola-sifirla", {
    method: "POST",
    oturum: false,
    govde: { jeton, yeniParola },
  });
  if (!sonuc.ok) return { hata: sonuc.hata.mesaj, alanlar: sonuc.hata.alanlar };

  // Backend bütün oturumları sildi; bu tarayıcıdaki eski çerez de gitsin.
  (await cookies()).delete(OTURUM_CEREZI);
  redirect("/giris?sifirlandi=1");
}
