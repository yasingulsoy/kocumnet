"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button } from "@/components/tailadmin/ui/Button";
import { girisYap } from "@/lib/eylemler/oturum";

/**
 * Giriş formu. Alanlar denetimli (useState) ve eylem elle çağrılır: yanlış
 * parolada e-posta silinmesin (React 19 form eylemi formu sıfırlıyor).
 */
export function GirisFormu({ sonraki }: { sonraki?: string }) {
  const [eposta, setEposta] = useState("");
  const [parola, setParola] = useState("");
  const [goster, setGoster] = useState(false);
  const [hata, setHata] = useState<{ mesaj: string; alanlar?: Record<string, string> } | null>(null);
  const [bekliyor, gecis] = useTransition();

  function gonder(e: FormEvent) {
    e.preventDefault();
    setHata(null);
    gecis(async () => {
      const s = await girisYap(eposta, parola, sonraki ?? null);
      // Başarıda eylem yönlendirir; buraya yalnızca hata gelir.
      if (s && !s.ok) {
        setHata({ mesaj: s.mesaj, alanlar: s.alanlar });
        setParola("");
      }
    });
  }

  return (
    <form method="post" onSubmit={gonder} className="space-y-6" noValidate>
      {hata ? <Alert variant="error">{hata.mesaj}</Alert> : null}

      <Field label="E-posta" required error={hata?.alanlar?.eposta}>
        <Input
          type="email"
          autoComplete="username"
          required
          autoFocus
          value={eposta}
          onChange={(e) => setEposta(e.target.value)}
          placeholder="ad@kocum.net"
        />
      </Field>

      <Field label="Parola" required error={hata?.alanlar?.parola}>
        <Input
          type={goster ? "text" : "password"}
          autoComplete="current-password"
          required
          value={parola}
          onChange={(e) => setParola(e.target.value)}
          placeholder="••••••••"
          endSlot={
            <button
              type="button"
              onClick={() => setGoster((v) => !v)}
              aria-label={goster ? "Parolayı gizle" : "Parolayı göster"}
              aria-pressed={goster}
              className="flex h-full w-12 cursor-pointer items-center justify-center text-gray-500 transition hover:text-gray-700"
            >
              {goster ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
            </button>
          }
        />
      </Field>

      <Button type="submit" block loading={bekliyor} disabled={!eposta || !parola}>
        {bekliyor ? "Giriş yapılıyor…" : "Giriş yap"}
      </Button>
    </form>
  );
}
