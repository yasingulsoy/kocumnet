"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { loginRequest } from "@/lib/api";
import { Field, INPUT_CLASS, Notice, buttonClass } from "@/components/checkup/ui";

export function SignInForm() {
  const router = useRouter();
  const [goster, setGoster] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  async function gonder(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setHata(null);
    setBekliyor(true);
    const fd = new FormData(e.currentTarget);
    const res = await loginRequest(String(fd.get("kimlik") ?? ""), String(fd.get("parola") ?? ""));
    if (!res.ok) {
      setHata(res.error ?? "Giriş başarısız.");
      setBekliyor(false);
      return;
    }
    // Çerez geldi; sunucu bileşenleri görsün diye tam yenileme.
    router.push("/checkup");
    router.refresh();
  }

  return (
    <form onSubmit={gonder} className="space-y-5" noValidate>
      {hata ? <Notice tone="bad">{hata}</Notice> : null}

      <Field label="E-posta veya kullanıcı adı" htmlFor="kimlik">
        <input
          id="kimlik"
          name="kimlik"
          type="text"
          autoComplete="username"
          required
          autoFocus
          disabled={bekliyor}
          className={INPUT_CLASS}
          placeholder="ad@kocum.net"
        />
      </Field>

      <Field label="Parola" htmlFor="parola">
        <div className="relative">
          <input
            id="parola"
            name="parola"
            type={goster ? "text" : "password"}
            autoComplete="current-password"
            required
            disabled={bekliyor}
            className={INPUT_CLASS + " pe-12"}
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setGoster((v) => !v)}
            aria-label={goster ? "Parolayı gizle" : "Parolayı göster"}
            aria-pressed={goster}
            className="absolute inset-y-0 end-0 flex w-12 items-center justify-center text-ink-faint transition hover:text-ink"
          >
            {goster ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        </div>
      </Field>

      <button type="submit" disabled={bekliyor} className={buttonClass("primary", "md") + " w-full"}>
        {bekliyor ? <Loader2 className="animate-spin" /> : null}
        {bekliyor ? "Giriş yapılıyor…" : "Giriş yap"}
      </button>
    </form>
  );
}
