"use client";

import { useState, type FormEvent } from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function HeroContactForm({ dict }: { dict: Dictionary }) {
  const [sent, setSent] = useState(false);
  const c = dict.contact;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-md border border-neutral-200 bg-white p-6 shadow-[0_8px_40px_-12px_rgba(26,95,180,0.15)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1a5fb4]">
          {dict.nav.contact}
        </p>
        <p className="mt-4 text-sm leading-relaxed text-[#444]">{c.quickThanks}</p>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-md border border-neutral-300 bg-[#fafbff] px-3 py-2.5 text-sm text-[#151a33] placeholder:text-neutral-400 outline-none transition focus:border-[#1a5fb4] focus:bg-white focus:ring-1 focus:ring-[#1a5fb4]/25";

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-6 shadow-[0_8px_40px_-12px_rgba(26,95,180,0.15)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1a5fb4]">
        {c.quickTitle}
      </p>
      <p className="font-display mt-2 text-lg font-semibold tracking-tight text-[#151a33]">
        {c.quickSubtitle}
      </p>
      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="hero-name" className="sr-only">
            {c.formName}
          </label>
          <input
            id="hero-name"
            name="name"
            type="text"
            required
            autoComplete="name"
            placeholder={c.formNamePlaceholder}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="hero-email" className="sr-only">
            {c.formEmail}
          </label>
          <input
            id="hero-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder={c.formEmailPlaceholder}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="hero-msg" className="sr-only">
            {c.formMessage}
          </label>
          <textarea
            id="hero-msg"
            name="message"
            rows={3}
            required
            placeholder={c.quickMessagePlaceholder}
            className={`${inputClass} resize-none`}
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-[5px] bg-[#1a5fb4] py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[#154a94]"
        >
          {c.formSend}
        </button>
      </form>
    </div>
  );
}
