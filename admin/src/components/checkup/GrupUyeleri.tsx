"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Search, UserMinus, UserPlus } from "lucide-react";
import { ogrenciAraAction, uyeCikarAction, uyeEkleAction, type AramaSonucu } from "@/lib/checkup/actions/gruplar";
import { examLabel, gradeLabel } from "@/lib/checkup/format";
import { ARAMA_EN_AZ } from "@/lib/checkup/grup-kurallari";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Avatar } from "@/components/tailadmin/ui/Avatar";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Button } from "@/components/tailadmin/ui/Button";
import { useOnay } from "./Onay";

/*
 * Grup üyeleri: e-postayla ya da adla öğrenci ara, ekle, çıkar. Arama da
 * bir sunucu eylemi (actions/gruplar.ts ogrenciAraAction): öğrenci listesi
 * kişisel veri, yalnızca yönetici ve müdür sorabilir; tarayıcıya bütün
 * liste değil, en çok 10 eşleşme gelir.
 *
 * Gruba eklenen öğrenciye bildirim gitmez; ödevini kendi ekranında görür.
 */

function Sonuc({ s, groupId, eklendi }: { s: AramaSonucu; groupId: string; eklendi: (id: string) => void }) {
  const [pending, start] = useTransition();
  const ayrinti = [gradeLabel(s.grade), s.targetExam ? examLabel(s.targetExam) : null].filter(Boolean).join(" · ");
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Avatar name={s.name} size="small" decorative />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-theme-sm font-medium text-gray-800">{s.name}</span>
        <span className="block truncate text-theme-xs text-gray-500">
          {s.email}
          {ayrinti ? " · " + ayrinti : ""}
        </span>
      </span>
      {s.uye ? (
        <Badge size="sm" color="light">
          Üye
        </Badge>
      ) : (
        <Button
          variant="soft"
          size="xs"
          loading={pending}
          startIcon={<UserPlus />}
          aria-label={`${s.name} gruba eklensin`}
          onClick={() =>
            start(async () => {
              const r = await uyeEkleAction(groupId, s.id);
              if (!r.ok) {
                toast.error(r.error);
                return;
              }
              eklendi(s.id);
              toast.success(s.name + " gruba eklendi.");
            })
          }
        >
          Ekle
        </Button>
      )}
    </li>
  );
}

export function UyeEkle({ groupId }: { groupId: string }) {
  const [q, setQ] = useState("");
  const [sonuclar, setSonuclar] = useState<AramaSonucu[] | null>(null);
  const [araniyor, setAraniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Yavaş dönen eski arama yeni sonucun üstüne yazmasın.
  const sonIstek = useRef(0);

  useEffect(() => () => clearTimeout(zamanlayici.current), []);

  const ara = async (metin: string) => {
    const no = ++sonIstek.current;
    setAraniyor(true);
    const r = await ogrenciAraAction(groupId, metin);
    if (no !== sonIstek.current) return;
    setAraniyor(false);
    if (r.ok) {
      setSonuclar(r.sonuclar);
      setHata(null);
    } else {
      setHata(r.error);
    }
  };

  const degisti = (v: string) => {
    setQ(v);
    clearTimeout(zamanlayici.current);
    const metin = v.trim();
    if (metin.length < ARAMA_EN_AZ) {
      sonIstek.current += 1;
      setSonuclar(null);
      setAraniyor(false);
      setHata(null);
      return;
    }
    zamanlayici.current = setTimeout(() => void ara(metin), 300);
  };

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        clearTimeout(zamanlayici.current);
        if (q.trim().length >= ARAMA_EN_AZ) void ara(q.trim());
      }}
    >
      <Field
        label="Öğrenci ekle"
        error={hata ?? undefined}
        hint={`Ad ya da e-postanın en az ${ARAMA_EN_AZ} harfi. Bir öğrenci birden çok grupta olabilir.`}
      >
        <Input
          type="search"
          value={q}
          onChange={(e) => degisti(e.target.value)}
          placeholder="Ad veya e-posta…"
          compact
          startIcon={<Search />}
          autoComplete="off"
        />
      </Field>
      <div aria-live="polite" className="mt-1">
        {araniyor ? <p className="py-2 text-theme-xs text-gray-500">Aranıyor…</p> : null}
        {!araniyor && sonuclar !== null ? (
          sonuclar.length === 0 ? (
            <p className="py-2 text-theme-xs text-gray-500">Eşleşen öğrenci yok.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {sonuclar.map((s) => (
                <Sonuc
                  key={s.id}
                  s={s}
                  groupId={groupId}
                  eklendi={(id) => setSonuclar((l) => l?.map((x) => (x.id === id ? { ...x, uye: true } : x)) ?? null)}
                />
              ))}
            </ul>
          )
        ) : null}
      </div>
    </form>
  );
}

export function UyeCikarDugmesi({ groupId, userId, ad }: { groupId: string; userId: string; ad: string }) {
  const [pending, start] = useTransition();
  const onayla = useOnay();
  return (
    <Button
      variant="ghost"
      size="xs"
      loading={pending}
      startIcon={<UserMinus />}
      aria-label={`${ad} gruptan çıkarılsın`}
      className="relative z-1"
      onClick={async () => {
        const evet = await onayla({
          title: `${ad} gruptan çıkarılsın mı?`,
          description: "Grubun ödevlerini artık görmez. Testleri ve sonuçları silinmez; yeniden eklenirse ilerlemesi geri gelir.",
          confirmLabel: "Çıkar",
          tone: "warning",
        });
        if (!evet) return;
        start(async () => {
          const r = await uyeCikarAction(groupId, userId);
          if (r.ok) toast.success(ad + " gruptan çıkarıldı.");
          else toast.error(r.error);
        });
      }}
    >
      Çıkar
    </Button>
  );
}
