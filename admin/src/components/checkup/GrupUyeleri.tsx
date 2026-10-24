"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import toast from "react-hot-toast";
import { ListPlus, Search, UserMinus, UserPlus } from "lucide-react";
import {
  ogrenciAraAction,
  topluUyeEkleAction,
  uyeCikarAction,
  uyeEkleAction,
  type AramaSonucu,
  type TopluEklemeSonucu,
} from "@/lib/checkup/actions/gruplar";
import { examLabel, gradeLabel } from "@/lib/checkup/format";
import { ARAMA_EN_AZ, TOPLU_EKLEME_SINIRI, TOPLU_METIN_SINIRI } from "@/lib/checkup/grup-kurallari";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { TextArea } from "@/components/tailadmin/form/TextArea";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Avatar } from "@/components/tailadmin/ui/Avatar";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Button } from "@/components/tailadmin/ui/Button";
import { Modal, useModal } from "@/components/tailadmin/ui/Modal";
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

/**
 * Toplu ekleme: e-posta listesini yapıştır (satır, virgül ya da boşlukla
 * ayrılmış). Kayıtlı öğrenciler eklenir; sonuçta sayılar ve kayıtlı olmayan
 * e-postalar görünür, koç onlara davet bağlantısını gönderir. Ayrıştırma ve
 * sınır sunucuda yeniden yapılır (grup-kurallari.ts epostaListesiAyristir).
 */
export function TopluUyeEkle({ groupId }: { groupId: string }) {
  const { isOpen, openModal, closeModal } = useModal();
  const [metin, setMetin] = useState("");
  const [sonuc, setSonuc] = useState<TopluEklemeSonucu | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const kapat = () => {
    closeModal();
    setSonuc(null);
    setHata(null);
  };

  const gonder = (e: FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await topluUyeEkleAction(groupId, metin);
      if (!r.ok) {
        setHata(r.error);
        setSonuc(null);
        return;
      }
      setHata(null);
      setSonuc(r);
      // Eklenmeyenler kalsın: koç kayıt olmayanları kopyalayıp davet gönderebilsin.
      setMetin(r.kayitYok.join("\n"));
      if (r.eklendi > 0) toast.success(r.eklendi + " öğrenci gruba eklendi.");
    });
  };

  return (
    <>
      <Button variant="ghost" size="xs" startIcon={<ListPlus />} onClick={openModal}>
        E-posta listesiyle ekle
      </Button>
      <Modal isOpen={isOpen} onClose={kapat} title="E-posta listesiyle ekle" size="md">
        <form onSubmit={gonder} className="space-y-4">
          {hata ? (
            <Alert variant="error" compact>
              {hata}
            </Alert>
          ) : null}
          {sonuc ? (
            <Alert variant={sonuc.kayitYok.length || sonuc.gecersiz.length ? "warning" : "success"} compact title="Sonuç">
              <ul className="tabular space-y-0.5">
                <li>Eklendi: {sonuc.eklendi}</li>
                <li>Zaten üye: {sonuc.zatenUye}</li>
                <li>Kayıt yok: {sonuc.kayitYok.length}</li>
                {sonuc.gecersiz.length ? <li>E-posta değil: {sonuc.gecersiz.join(", ")}</li> : null}
              </ul>
              {sonuc.kayitYok.length ? (
                <p className="mt-2">Kayıtlı olmayanlar aşağıda kaldı. Onlara grubun davet bağlantısını gönder; kayıt olunca gruba kendileri katılır.</p>
              ) : null}
            </Alert>
          ) : null}
          <Field
            label="E-postalar"
            hint={`Her satıra bir e-posta, ya da virgülle ayır. Bir seferde en çok ${TOPLU_EKLEME_SINIRI}. Yalnızca kayıtlı öğrenciler eklenir.`}
          >
            <TextArea
              rows={8}
              value={metin}
              onChange={(e) => setMetin(e.target.value)}
              maxLength={TOPLU_METIN_SINIRI}
              placeholder={"ayse@ornek.com\nmehmet@ornek.com"}
              spellCheck={false}
              className="font-mono text-theme-xs"
            />
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="xs" onClick={kapat} disabled={pending}>
              Kapat
            </Button>
            <Button type="submit" size="xs" loading={pending} startIcon={<UserPlus />} disabled={!metin.trim()}>
              {pending ? "Ekleniyor…" : "Ekle"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
