"use client";

import { useTransition } from "react";
import toast from "react-hot-toast";
import { Link2, Link2Off, RefreshCw } from "lucide-react";
import { davetAction } from "@/lib/checkup/actions/gruplar";
import { davetKoduOkunur } from "@/lib/checkup/davet";
import { Button } from "@/components/tailadmin/ui/Button";
import { KopyalaAlani } from "./KopyalaAlani";
import { useOnay } from "./Onay";

/*
 * Grup davet bağlantısı: oluştur, yenile, kapat. Kural ve biçim
 * lib/checkup/davet.ts'te; yetki sunucuda (actions/gruplar.ts davetAction,
 * yalnızca yönetici ve müdür).
 *
 * Bağlantı ve kod sunucudan (sayfa) gelir; eylemden sonra sayfa yenilenir
 * ve bileşen yeni değerle çizilir (sayfa `key`'i koda bağlı). Kod büyük
 * harfle ve ikiye bölünmüş gösterilir: sınıfta tahtaya yazılabilsin.
 */
export function GrupDavet({
  groupId,
  kod,
  baglanti,
  arsivde,
}: {
  groupId: string;
  kod: string | null;
  baglanti: string | null;
  arsivde: boolean;
}) {
  const [pending, start] = useTransition();
  const onayla = useOnay();

  const calistir = (islem: "olustur" | "yenile" | "kapat", basari: string) =>
    start(async () => {
      const r = await davetAction(groupId, islem);
      if (r.ok) toast.success(basari);
      else toast.error(r.error);
    });

  if (arsivde) {
    return <p className="text-theme-sm text-gray-500">Arşivdeki grubun daveti kapalı. Arşivden alınca yeni bağlantı oluşturabilirsin.</p>;
  }

  if (!kod || !baglanti) {
    return (
      <div className="space-y-3">
        <p className="text-theme-sm text-gray-500">
          Davet kapalı. Bağlantı oluşturursan öğrenciler bağlantıyı açıp kayıt olunca ya da giriş yapınca gruba kendileri katılır.
        </p>
        <Button size="xs" startIcon={<Link2 />} loading={pending} onClick={() => calistir("olustur", "Davet bağlantısı oluşturuldu.")}>
          Davet bağlantısı oluştur
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <KopyalaAlani etiket="Davet bağlantısı" deger={baglanti} ipucu="WhatsApp grubuna ya da sınıf duyurusuna yapıştır." />
      <div>
        <p className="text-theme-xs font-medium text-gray-500">Davet kodu</p>
        <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.2em] text-gray-800 select-all" aria-label={"Davet kodu " + kod.split("").join(" ")}>
          {davetKoduOkunur(kod)}
        </p>
        <p className="mt-1 text-theme-xs text-gray-500">Tahtaya yazmak için: harfler büyük, 0/O ve 1/I karışmasın diye kullanılmıyor.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="xs"
          startIcon={<RefreshCw />}
          loading={pending}
          onClick={async () => {
            const evet = await onayla({
              title: "Davet bağlantısı yenilensin mi?",
              description: "Eski bağlantı ve kod artık çalışmaz; yenisini öğrencilere yeniden göndermen gerekir. Gruba katılmış öğrenciler üye kalır.",
              confirmLabel: "Yenile",
              tone: "warning",
            });
            if (evet) calistir("yenile", "Yeni davet bağlantısı oluşturuldu; eskisi artık çalışmıyor.");
          }}
        >
          Yenile
        </Button>
        <Button
          variant="ghost"
          size="xs"
          startIcon={<Link2Off />}
          loading={pending}
          onClick={async () => {
            const evet = await onayla({
              title: "Davet kapatılsın mı?",
              description: "Bağlantı ve kod artık çalışmaz; yeni öğrenci kendiliğinden katılamaz. Üyeler gruptan çıkmaz.",
              confirmLabel: "Daveti kapat",
              tone: "warning",
            });
            if (evet) calistir("kapat", "Davet kapatıldı.");
          }}
        >
          Kapat
        </Button>
      </div>
    </div>
  );
}
