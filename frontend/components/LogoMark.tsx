const TOP_BLUE = "#1a5fb4";

/** KoçumNet — Novaly tarzı çift yaprak işareti */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M26 6c-6 8-14 20-12 32 10 2 18-8 22-18 2-8-4-16-10-14z" fill="#5aadf0" />
      <path d="M26 6c8 10 14 22 10 34-12 4-22-6-26-16 8-12 14-18 16-18z" fill={TOP_BLUE} />
    </svg>
  );
}
