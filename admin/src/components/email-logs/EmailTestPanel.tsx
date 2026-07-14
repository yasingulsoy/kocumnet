"use client";

import React, { useState } from "react";
import { apiPost } from "@/lib/api";

const DEFAULT_TEST_EMAIL = "yasingulsoy02@gmail.com";

const EmailTestPanel: React.FC = () => {
  const [email, setEmail] = useState(DEFAULT_TEST_EMAIL);
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [smtpMessage, setSmtpMessage] = useState<string | null>(null);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [verifyUrlHint, setVerifyUrlHint] = useState<string | null>(null);

  const handleSmtpTest = async () => {
    setSmtpLoading(true);
    setSmtpMessage(null);
    try {
      const res = await apiPost<{ success?: boolean; message?: string; error?: string }>(
        "/api/admin/test-email"
      );
      if (res?.success) {
        setSmtpMessage(res.message || "SMTP test e-postası gönderildi.");
      } else {
        setSmtpMessage(res?.error || "Gönderilemedi.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Hata oluştu";
      setSmtpMessage(msg);
    } finally {
      setSmtpLoading(false);
    }
  };

  const handleVerificationTest = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setVerificationMessage("E-posta adresi girin.");
      return;
    }

    setVerificationLoading(true);
    setVerificationMessage(null);
    setVerifyUrlHint(null);

    try {
      const res = await apiPost<{
        success?: boolean;
        message?: string;
        error?: string;
        email_sent?: boolean;
        verify_url_hint?: string;
      }>("/api/admin/test-verification-email", { email: trimmed });

      if (res?.success && res.email_sent !== false) {
        setVerificationMessage(
          res.message || "Doğrulama test e-postası gönderildi. Gelen kutusundaki en son maildeki linke tıklayın."
        );
        if (res.verify_url_hint) {
          setVerifyUrlHint(res.verify_url_hint);
        }
      } else {
        setVerificationMessage(res?.error || "Doğrulama e-postası gönderilemedi.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Hata oluştu";
      setVerificationMessage(msg);
    } finally {
      setVerificationLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-5 dark:border-amber-900/50 dark:bg-amber-950/20">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">
        Canlı / SMTP test alanı
      </h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Doğrulama testi, seçilen e-postaya kayıt akışındaki maili gönderir; token veritabanına
        yazılır — linke tıklayınca doğrulama tamamlanır. Canlıda test için bu sayfayı deploy
        sonrası kullanın.
      </p>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label
            htmlFor="verification-test-email"
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Doğrulama test e-postası
          </label>
          <input
            id="verification-test-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={DEFAULT_TEST_EMAIL}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
          <p className="mt-1 text-xs text-gray-500">
            Bu adresle kayıtlı müşteri olmalı. Test için hesabın doğrulanmamış sayılması gerekir
            (buton geçici olarak sıfırlar).
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSmtpTest}
            disabled={smtpLoading || verificationLoading}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
          >
            {smtpLoading ? "Gönderiliyor..." : "SMTP testi"}
          </button>
          <button
            type="button"
            onClick={handleVerificationTest}
            disabled={smtpLoading || verificationLoading}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            {verificationLoading ? "Gönderiliyor..." : "Doğrulama testi gönder"}
          </button>
        </div>
      </div>

      {smtpMessage && (
        <p
          className={`mt-3 text-sm ${
            smtpMessage.includes("başarıyla") || smtpMessage.includes("gönderildi")
              ? "text-green-700 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          SMTP: {smtpMessage}
        </p>
      )}

      {verificationMessage && (
        <p
          className={`mt-3 text-sm ${
            verificationMessage.includes("gönderildi")
              ? "text-green-700 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          Doğrulama: {verificationMessage}
        </p>
      )}

      {verifyUrlHint && (
        <p className="mt-2 break-all text-xs text-gray-500 dark:text-gray-400">
          API linki (maildeki ile aynı olmalı): {verifyUrlHint}
        </p>
      )}
    </div>
  );
};

export default EmailTestPanel;
