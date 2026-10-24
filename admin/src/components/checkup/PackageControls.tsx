"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { setPackageFreeAction, setPackageStatusAction } from "@/lib/checkup/actions/packages";
import { QUESTION_STATUS_LABEL, QUESTION_STATUSES } from "@/lib/checkup/format";
import { Select } from "@/components/tailadmin/form/Select";
import { Switch } from "@/components/tailadmin/form/Switch";
import { useOnay } from "./Onay";

/**
 * Paket yayından kalkınca ne bozulur — onaydan önce söylenir. Her tür
 * öğrenci akışının bir parçası; katalogda tek satır gibi görünmeleri
 * yanıltmasın. Eskiden yalnızca gizli sistem paketleri soruluyordu: katalog
 * testi ya da deneme tek tıkla, açık ödevleri sessizce bozarak kalkıyordu.
 */
const YAYINDAN_KALKINCA: Record<string, string> = {
  STANDARD: "Test katalogdan kalkar; öğrenciler yeni test başlatamaz. Tamamlanmış sonuçlar durur.",
  INTRO: "Tanışma testi katalogdan kalkar; yeni öğrenciler ilk check-up'larını başlatamaz. Tamamlanmış sonuçlar durur.",
  MOCK: "Deneme katalogdan kalkar; öğrenciler yeni deneme başlatamaz. Tamamlanmış sonuçlar durur.",
  RETEST:
    "Bu sınavın öğrencileri çalışma planlarındaki kontrol testlerini başlatamaz (plan adımı kapanmaz).",
  LEVEL:
    "Seviyeli check-up katalogdan kalkar; yarım koşusu olan öğrenciler bir sonraki seviyeyi açamaz.",
};

/** "Bu paket 3 açık ödevde kullanılıyor: …" — sayı paketler sayfasında hesaplanır. */
function odevNotu(acikOdev: number, etki: string): string {
  return acikOdev > 0 ? ` Bu paket ${acikOdev} açık ödevde kullanılıyor: ${etki}` : "";
}

/** Paketin yayın durumu. Sunucu reddederse (havuz yetersiz) eski değere döner. */
export function PackageStatusSelect({
  id,
  status,
  name,
  kind = "STANDARD",
  acikOdev = 0,
}: {
  id: string;
  status: string;
  name: string;
  kind?: string;
  /** Bu paketi veren, son tarihi geçmemiş, iptal edilmemiş ödev sayısı (arşivdeki gruplar hariç). */
  acikOdev?: number;
}) {
  const [value, setValue] = useState(status);
  const [pending, start] = useTransition();
  const onayla = useOnay();

  return (
    <Select
      aria-label={name + " yayın durumu"}
      compact
      wrapperClassName="w-36"
      value={value}
      disabled={pending}
      onChange={async (e) => {
        const onceki = value;
        const sonraki = e.target.value;
        const uyari = YAYINDAN_KALKINCA[kind];
        if (onceki === "PUBLISHED" && sonraki !== "PUBLISHED" && (uyari || acikOdev > 0)) {
          // Denetimli select: değer değişmediği sürece ekranda eskisi kalır.
          const evet = await onayla({
            title: `"${name}" yayından kaldırılsın mı?`,
            description:
              (uyari ?? "") + odevNotu(acikOdev, "ödevdeki öğrenciler testi başlatamaz, ödev tamamlanamaz. Önce ödevleri iptal etmek ya da süresini beklemek daha iyi."),
            confirmLabel: "Yayından kaldır",
            tone: "warning",
          });
          if (!evet) return;
        }
        setValue(sonraki);
        start(async () => {
          const res = await setPackageStatusAction(id, sonraki);
          if (res.ok) {
            toast.success(name + ": " + QUESTION_STATUS_LABEL[sonraki]);
          } else {
            setValue(onceki);
            toast.error(res.error ?? "Durum değiştirilemedi.", { duration: 6000 });
          }
        });
      }}
      options={QUESTION_STATUSES.map((s) => ({ value: s, label: QUESTION_STATUS_LABEL[s] }))}
    />
  );
}

/** Ücretsiz / ücretli anahtarı (kitin Switch'i; açık = ücretli). */
export function PackageFreeToggle({
  id,
  isFree,
  name,
  acikOdev = 0,
}: {
  id: string;
  isFree: boolean;
  name: string;
  /** Bu paketi veren açık ödev sayısı (PackageStatusSelect ile aynı sayım). */
  acikOdev?: number;
}) {
  const [value, setValue] = useState(isFree);
  const [pending, start] = useTransition();
  const onayla = useOnay();

  const degistir = async () => {
    const sonraki = !value;
    if (
      !sonraki &&
      !(await onayla({
        title: `"${name}" ücretli yapılsın mı?`,
        description:
          "Erişim hakkı olmayan öğrenciler bu paketle yeni test başlatamaz. Tamamlanmış sonuçları durur." +
          // Ödev erişim hakkı vermez: ödevi alan ama hakkı olmayan öğrenci kilit görür.
          odevNotu(acikOdev, "erişim hakkı olmayan öğrenci ödevini yapamaz (ödev hak vermez)."),
        confirmLabel: "Ücretli yap",
        tone: "warning",
      }))
    ) {
      return;
    }
    setValue(sonraki);
    start(async () => {
      const res = await setPackageFreeAction(id, sonraki);
      if (res.ok) {
        toast.success(name + (sonraki ? " artık ücretsiz." : " artık ücretli."));
      } else {
        setValue(!sonraki);
        toast.error(res.error ?? "Değiştirilemedi.");
      }
    });
  };

  return (
    <Switch
      checked={!value}
      onChange={() => void degistir()}
      disabled={pending}
      aria-label={name + " ücretli"}
      label={<span className="text-theme-xs">{value ? "Ücretsiz" : "Ücretli"}</span>}
      wrapperClassName="whitespace-nowrap"
    />
  );
}
