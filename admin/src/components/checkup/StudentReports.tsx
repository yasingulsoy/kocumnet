"use client";

import Link from "next/link";
import { useTransition } from "react";
import toast from "react-hot-toast";
import { CheckCheck, CircleCheck, Flag, RotateCcw } from "lucide-react";
import { bildirimleriCozAction, notDurumuAction } from "@/lib/checkup/actions/notes";
import { trDate } from "@/lib/checkup/format";
import { damgaAdi } from "@/lib/checkup/question-note";
import { sebepAdi, sebepRengi } from "@/lib/checkup/student-report";
import type { OgrenciBildirimi } from "@/lib/checkup/student-reports";
import { cx } from "@/components/tailadmin/cx";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Button } from "@/components/tailadmin/ui/Button";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { useOnay } from "./Onay";

/**
 * Öğrenci hata bildirimleri — soru ekranındaki bölüm ve bildirim listesinin
 * düğmeleri. Okuma herkese; çözme/yeniden açma içerik rollerinde (sunucu da
 * denetler). Bildireni yalnızca MANAGE rolleri görür: sunucu ötekilere adı
 * hiç göndermiyor (lib/checkup/student-reports.ts).
 */

/** Tek bildirimi çözüldü / yeniden aç. */
export function BildirimDurumDugmesi({ noteId, cozuldu, size = "xs" }: { noteId: string; cozuldu: boolean; size?: "xs" | "sm" }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant={cozuldu ? "ghost" : "outline"}
      size={size}
      loading={pending}
      startIcon={cozuldu ? <RotateCcw /> : <CircleCheck />}
      onClick={() =>
        start(async () => {
          const r = await notDurumuAction(noteId, !cozuldu);
          if (!r.ok) toast.error(r.error);
          else toast.success(cozuldu ? "Bildirim yeniden açıldı." : "Bildirim çözüldü: öğrenci “incelendi” görür.");
        })
      }
    >
      {cozuldu ? "Yeniden aç" : "Çözüldü"}
    </Button>
  );
}

/** Bir sorunun açık bildirimlerinin hepsini çözüldü işaretler (onaylı). */
export function BildirimleriCozDugmesi({ questionId, adet, etiket = "Hepsini çözüldü işaretle" }: { questionId: string; adet: number; etiket?: string }) {
  const [pending, start] = useTransition();
  const onayla = useOnay();
  return (
    <Button
      variant="outline"
      size="xs"
      loading={pending}
      startIcon={<CheckCheck />}
      onClick={async () => {
        const evet = await onayla({
          title: adet + " açık bildirim çözüldü işaretlensin mi?",
          description: "Soruyu düzelttiysen (ya da hata yoksa) işaretle: bildiren öğrenciler “incelendi” görür.",
          confirmLabel: "Çözüldü işaretle",
        });
        if (!evet) return;
        start(async () => {
          const r = await bildirimleriCozAction(questionId);
          if (!r.ok) toast.error(r.error);
          else toast.success(r.count + " bildirim çözüldü.");
        });
      }}
    >
      {etiket}
    </Button>
  );
}

function BildirimSatiri({
  b,
  yazabilir,
  guncelSurum,
}: {
  b: OgrenciBildirimi;
  yazabilir: boolean;
  guncelSurum: number;
}) {
  const cozuldu = b.resolvedAt !== null;
  return (
    <li className={cx("px-5 py-4 sm:px-6", cozuldu && "bg-gray-50")}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-theme-xs text-gray-500">
        <Badge size="sm" color={sebepRengi(b.reason)}>
          {sebepAdi(b.reason)}
        </Badge>
        <Badge size="sm" color={cozuldu ? "success" : "warning"}>
          {cozuldu ? "Çözüldü" : "Açık"}
        </Badge>
        <span>{trDate(b.createdAt, { time: true })}</span>
        {b.bildiren ? (
          <Link href={"/checkup/ogrenciler/" + encodeURIComponent(b.bildiren.id)} className="font-medium text-gray-800 hover:text-brand-500">
            {b.bildiren.ad}
          </Link>
        ) : (
          <span className="font-medium text-gray-700">Bir öğrenci</span>
        )}
        {b.kaynak ? <span>· {b.kaynak}</span> : null}
        {b.surum !== null ? (
          <span
            className={b.surum !== guncelSurum ? "text-brand-700" : undefined}
            title="Öğrencinin gördüğü sürüm (cevap anahtarı değişince sürüm artar)"
          >
            · v{b.surum}
            {b.surum !== guncelSurum ? " (şimdi v" + guncelSurum + ")" : ""}
          </span>
        ) : null}
      </div>
      {b.body ? (
        <p className={cx("mt-1.5 text-sm leading-relaxed break-words whitespace-pre-line", cozuldu ? "text-gray-500" : "text-gray-800")}>
          {b.body}
        </p>
      ) : (
        <p className="mt-1.5 text-theme-sm text-gray-500 italic">Açıklama yazılmamış.</p>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        {cozuldu ? (
          <span className="text-theme-xs text-gray-500" title={b.resolvedByStaff ?? undefined}>
            Çözen {damgaAdi(b.resolvedByStaff)} · {trDate(b.resolvedAt!, { time: true })}
          </span>
        ) : (
          <span />
        )}
        {yazabilir ? <BildirimDurumDugmesi noteId={b.id} cozuldu={cozuldu} /> : null}
      </div>
    </li>
  );
}

/** Soru ekranında, inceleme notlarının yanında. */
export function OgrenciBildirimleri({
  questionId,
  bildirimler,
  yazabilir,
  kisisel,
  guncelSurum,
}: {
  questionId: string;
  bildirimler: OgrenciBildirimi[];
  /** Çözme/yeniden açma (CONTENT). */
  yazabilir: boolean;
  /** Bildireni görme (MANAGE): sunucu ötekilere adı göndermiyor, burada yalnızca not için. */
  kisisel: boolean;
  guncelSurum: number;
}) {
  const acik = bildirimler.filter((b) => b.resolvedAt === null).length;
  return (
    <ComponentCard
      // Listedeki bildirim rozeti ve bildirim listesi buraya iner.
      id="bildirimler"
      className="mb-6 scroll-mt-24"
      title="Öğrenci bildirimleri"
      icon={<Flag />}
      badge={
        acik > 0 ? (
          <Badge size="sm" color="error">
            <span className="tabular">{acik}</span> açık
          </Badge>
        ) : null
      }
      desc="Öğrencilerin “bu soruda hata var” bildirimleri. Çözüldü işaretlenince öğrenci “incelendi” görür."
      actions={yazabilir && acik > 1 ? <BildirimleriCozDugmesi questionId={questionId} adet={acik} /> : null}
      flush
    >
      {bildirimler.length === 0 ? (
        <EmptyState icon={<Flag />} title="Bildirim yok" description="Bu soru için öğrenci bildirimi gelmedi." />
      ) : (
        <ul className="divide-y divide-gray-100 border-t border-gray-100">
          {bildirimler.map((b) => (
            <BildirimSatiri key={b.id} b={b} yazabilir={yazabilir} guncelSurum={guncelSurum} />
          ))}
        </ul>
      )}
      {bildirimler.length > 0 && (!kisisel || !yazabilir) ? (
        <p className="border-t border-gray-100 px-5 py-3 text-theme-xs text-gray-500 sm:px-6">
          {!kisisel ? "Bildiren öğrencinin adını yalnızca yönetici ve müdür görür. " : ""}
          {!yazabilir ? "Çözüldü işaretlemek yönetici, müdür ve editöre açık." : ""}
        </p>
      ) : null}
    </ComponentCard>
  );
}
