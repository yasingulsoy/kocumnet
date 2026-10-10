import type { ReactNode } from "react";

/** Kimlik ekranlarının başlığı — TailAdmin SignInForm'daki ölçüler. */
export function AuthHeading({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return (
    <div className="mb-5 sm:mb-8">
      <h1 className="mb-2 font-display text-title-sm font-semibold text-gray-800 sm:text-title-md">{title}</h1>
      {description ? <p className="text-sm text-gray-500">{description}</p> : null}
    </div>
  );
}
