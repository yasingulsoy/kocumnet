"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { KeyRound } from "lucide-react";
import { sifirlamaBaglantisiAction } from "@/lib/checkup/actions/students";
import { trDate } from "@/lib/checkup/format";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button } from "@/components/tailadmin/ui/Button";
import { Modal } from "@/components/tailadmin/ui/Modal";
import { KopyalaAlani } from "./KopyalaAlani";
import { useOnay } from "./Onay";

/*
 * Öğrenci ayrıntısında "Parola sıfırlama bağlantısı üret". E-posta altyapısı
 * yokken parolasını unutan öğrenciye koç bağlantıyı WhatsApp'tan iletir.
 * Yetki ve sınır sunucuda (actions/students.ts, yalnızca yönetici ve müdür).
 *
 * Bağlantı YALNIZCA BİR KEZ, bu pencerede görünür: tabloda yalnızca özeti
 * duruyor, sayfa yeniden çizilince de gelmez. Pencere kapanınca durum
 * silinir; kaybolursa yeni bağlantı üretilir (eskisi geçersiz olur).
 * Uyarı metni sunucudan (lib/checkup/sifirlama.ts SIFIRLAMA_UYARISI) gelir.
 */
export function SifirlamaBaglantisi({ userId, ad, uyari }: { userId: string; ad: string; uyari: string }) {
  const [pending, start] = useTransition();
  const [sonuc, setSonuc] = useState<{ baglanti: string; gecerlilik: Date } | null>(null);
  const onayla = useOnay();

  return (
    <>
      <Button
        variant="outline"
        size="xs"
        startIcon={<KeyRound />}
        loading={pending}
        onClick={async () => {
          const evet = await onayla({
            title: "Parola sıfırlama bağlantısı üretilsin mi?",
            description:
              ad + " için 24 saat geçerli, tek kullanımlık bir bağlantı üretilir. Öğrencinin önceki sıfırlama bağlantıları çalışmaz olur.",
            confirmLabel: "Bağlantı üret",
            tone: "warning",
          });
          if (!evet) return;
          start(async () => {
            const r = await sifirlamaBaglantisiAction(userId);
            if (!r.ok) {
              toast.error(r.error);
              return;
            }
            setSonuc({ baglanti: r.baglanti, gecerlilik: r.gecerlilik });
          });
        }}
      >
        Parola sıfırlama bağlantısı üret
      </Button>
      <Modal
        isOpen={sonuc !== null}
        onClose={() => setSonuc(null)}
        title="Parola sıfırlama bağlantısı"
        description={ad}
        size="md"
      >
        {sonuc ? (
          <div className="space-y-4">
            <Alert variant="warning" compact>
              {uyari}
            </Alert>
            <KopyalaAlani
              etiket="Bağlantı"
              deger={sonuc.baglanti}
              ipucu={"Tek kullanımlık; " + trDate(sonuc.gecerlilik, { time: true }) + " tarihine kadar geçerli."}
            />
            <p className="text-theme-xs text-gray-500">
              Bağlantı yalnızca şimdi görünür; pencereyi kapatınca bir daha gösterilmez. Kaybolursa yenisini üret.
            </p>
            <div className="flex justify-end">
              <Button size="xs" onClick={() => setSonuc(null)}>
                Kopyaladım, kapat
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
