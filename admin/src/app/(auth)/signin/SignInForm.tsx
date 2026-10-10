"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { loginRequest } from "@/lib/api";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Button } from "@/components/tailadmin/ui/Button";

export function SignInForm({ forgotHref }: { forgotHref: string }) {
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
    <form onSubmit={gonder} className="space-y-6" noValidate>
      {hata ? <Alert variant="error">{hata}</Alert> : null}

      <Field label="E-posta veya kullanıcı adı" required>
        <Input
          name="kimlik"
          type="text"
          autoComplete="username"
          required
          autoFocus
          disabled={bekliyor}
          placeholder="ad@kocum.net"
        />
      </Field>

      <Field
        label="Parola"
        required
        labelAction={
          <a href={forgotHref} className="text-brand-500 hover:text-brand-600">
            Parolamı unuttum
          </a>
        }
      >
        <Input
          name="parola"
          type={goster ? "text" : "password"}
          autoComplete="current-password"
          required
          disabled={bekliyor}
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

      <Button type="submit" block loading={bekliyor}>
        {bekliyor ? "Giriş yapılıyor…" : "Giriş yap"}
      </Button>
    </form>
  );
}
