"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Alert } from "@/components/tailadmin/ui/Alert";

/**
 * Kısa bildirimler (başarı/hata) — sağ altta, kit Alert'iyle. Başarı 4 sn,
 * hata 9 sn sonra kendiliğinden kapanır; kapatma düğmesi her zaman var.
 * Alert hata için role="alert", ötekiler role="status": ekran okuyucu duyurur.
 *
 *   const bildir = useBildirim();
 *   bildir.basari("Kaydedildi.");
 *   bildir.hata(sonuc.mesaj);
 */

type Tur = "success" | "error" | "info" | "warning";

interface Kayit {
  id: number;
  tur: Tur;
  baslik?: string;
  mesaj: ReactNode;
}

interface BildirimApi {
  basari: (mesaj: ReactNode, baslik?: string) => void;
  hata: (mesaj: ReactNode, baslik?: string) => void;
  bilgi: (mesaj: ReactNode, baslik?: string) => void;
}

const Baglam = createContext<BildirimApi | null>(null);

export function useBildirim(): BildirimApi {
  const b = useContext(Baglam);
  if (!b) throw new Error("useBildirim, BildirimSaglayici içinde kullanılmalı.");
  return b;
}

export function BildirimSaglayici({ children }: { children: ReactNode }) {
  const [kayitlar, setKayitlar] = useState<Kayit[]>([]);
  const sayac = useRef(0);

  const kapat = useCallback((id: number) => setKayitlar((k) => k.filter((x) => x.id !== id)), []);

  const ekle = useCallback(
    (tur: Tur, mesaj: ReactNode, baslik?: string) => {
      const id = ++sayac.current;
      setKayitlar((k) => [...k.slice(-3), { id, tur, mesaj, baslik }]);
      window.setTimeout(() => kapat(id), tur === "error" ? 9000 : 4000);
    },
    [kapat]
  );

  const api = useMemo<BildirimApi>(
    () => ({
      basari: (m, b) => ekle("success", m, b),
      hata: (m, b) => ekle("error", m, b),
      bilgi: (m, b) => ekle("info", m, b),
    }),
    [ekle]
  );

  return (
    <Baglam.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed end-4 bottom-4 z-99999 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 print:hidden">
        {kayitlar.map((k) => (
          <div key={k.id} className="pointer-events-auto animate-rise rounded-xl bg-white shadow-theme-lg">
            <Alert variant={k.tur} title={k.baslik} compact onClose={() => kapat(k.id)}>
              {k.mesaj}
            </Alert>
          </div>
        ))}
      </div>
    </Baglam.Provider>
  );
}
