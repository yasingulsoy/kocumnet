"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { LoaderCircle, Search, X } from "lucide-react";
import { Input } from "@/components/tailadmin/form/Input";
import { Select } from "@/components/tailadmin/form/Select";
import { Button } from "@/components/tailadmin/ui/Button";
import { Card } from "@/components/tailadmin/ui/Card";
import { sayiyaCevir, secenekler } from "@/lib/agac-yardimci";
import { sorgu } from "@/lib/bicim";
import type { Agac } from "@/lib/tipler";

/**
 * Soru listesinin süzgeçleri. Durum adres çubuğunda: her değişiklik yeni
 * adrese gider, sayfa sunucuda yeniden okunur. Zincir: sınav → ders → konu →
 * kazanım → alt kazanım; üst değişince altlar sıfırlanır. Arama Enter'la.
 * Bileşen adres değişince yeniden kurulur (key), yerel durum adresle eşleşir.
 */
export function SoruSuzgeci(props: {
  sinavlar: { id: number; ad: string; aktif: boolean }[];
  sinavId: number;
  agac: Agac;
  dersId: number | null;
  konuId: number | null;
  kazanimId: number | null;
  altKazanimId: number | null;
  aktif: string;
  ara: string;
}) {
  const router = useRouter();
  const [bekliyor, gecis] = useTransition();
  const [d, setD] = useState({
    sinav: props.sinavId,
    ders: props.dersId,
    konu: props.konuId,
    kazanim: props.kazanimId,
    altKazanim: props.altKazanimId,
    aktif: props.aktif,
    ara: props.ara,
  });

  const s = secenekler(d.sinav === props.sinavId ? props.agac : null, { dersId: d.ders, konuId: d.konu, kazanimId: d.kazanim });

  function git(y: typeof d) {
    setD(y);
    gecis(() => {
      router.push(
        `/sorular${sorgu({
          sinav: y.sinav,
          ders: y.ders,
          konu: y.konu,
          kazanim: y.kazanim,
          altKazanim: y.altKazanim,
          aktif: y.aktif,
          ara: y.ara.trim(),
        })}`
      );
    });
  }

  function aramaGonder(e: FormEvent) {
    e.preventDefault();
    git(d);
  }

  const suzgecVar = Boolean(d.ders || d.aktif || props.ara);

  return (
    <Card className="p-4 sm:p-5">
      <form onSubmit={aramaGonder} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Soru süzgeçleri">
        <Select
          compact
          aria-label="Sınav"
          value={String(d.sinav)}
          onChange={(e) => git({ sinav: Number(e.target.value), ders: null, konu: null, kazanim: null, altKazanim: null, aktif: d.aktif, ara: "" })}
          options={props.sinavlar.map((x) => ({ value: String(x.id), label: x.aktif ? x.ad : `${x.ad} (pasif)` }))}
        />
        <Select
          compact
          aria-label="Ders"
          value={d.ders ? String(d.ders) : ""}
          onChange={(e) => git({ ...d, ders: sayiyaCevir(e.target.value), konu: null, kazanim: null, altKazanim: null })}
        >
          <option value="">Bütün dersler</option>
          {s.dersler.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select
          compact
          aria-label="Konu"
          disabled={!d.ders}
          value={d.konu ? String(d.konu) : ""}
          onChange={(e) => git({ ...d, konu: sayiyaCevir(e.target.value), kazanim: null, altKazanim: null })}
        >
          <option value="">{d.ders ? "Bütün konular" : "Önce ders seçin"}</option>
          {s.konular.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select
          compact
          aria-label="Kazanım"
          disabled={!d.konu}
          value={d.kazanim ? String(d.kazanim) : ""}
          onChange={(e) => git({ ...d, kazanim: sayiyaCevir(e.target.value), altKazanim: null })}
        >
          <option value="">{d.konu ? "Bütün kazanımlar" : "Önce konu seçin"}</option>
          {s.kazanimlar.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select
          compact
          aria-label="Alt kazanım"
          disabled={!d.kazanim}
          value={d.altKazanim ? String(d.altKazanim) : ""}
          onChange={(e) => git({ ...d, altKazanim: sayiyaCevir(e.target.value) })}
        >
          <option value="">{d.kazanim ? "Bütün alt kazanımlar" : "Önce kazanım seçin"}</option>
          {s.altKazanimlar.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select compact aria-label="Durum" value={d.aktif} onChange={(e) => git({ ...d, aktif: e.target.value })}>
          <option value="">Aktif ve pasif</option>
          <option value="true">Yalnızca aktif</option>
          <option value="false">Yalnızca pasif</option>
        </Select>
        <div className="flex gap-2 md:col-span-2">
          <Input
            compact
            type="search"
            value={d.ara}
            onChange={(e) => setD({ ...d, ara: e.target.value })}
            placeholder="Soru metninde ara…"
            aria-label="Soru metninde ara"
            startIcon={<Search className="size-4" />}
            wrapperClassName="flex-1"
            maxLength={200}
          />
          <Button type="submit" size="xs" variant="outline">
            Ara
          </Button>
          {suzgecVar ? (
            <Button
              size="xs"
              variant="ghost"
              startIcon={<X />}
              onClick={() => git({ sinav: d.sinav, ders: null, konu: null, kazanim: null, altKazanim: null, aktif: "", ara: "" })}
            >
              Temizle
            </Button>
          ) : null}
          {bekliyor ? <LoaderCircle className="size-5 shrink-0 animate-spin self-center text-gray-400" aria-label="Yükleniyor" /> : null}
        </div>
      </form>
    </Card>
  );
}
