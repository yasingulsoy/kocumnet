"use client";

import { useEffect, useState } from "react";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:5000";

export function BlogViewCounter({
  slug,
  initialCount,
  label,
}: {
  slug: string;
  initialCount: number;
  label?: string;
}) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/blogs/slug/${encodeURIComponent(slug)}/view`, {
      method: "POST",
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setCount(data.data.view_count);
      })
      .catch(() => {});
  }, [slug]);

  return (
    <span className="inline-flex items-center gap-1">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      {count}
      {label ? <span className="ms-0.5">{label}</span> : null}
    </span>
  );
}
