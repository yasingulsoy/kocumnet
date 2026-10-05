"use client";

import toast from "react-hot-toast";
import { Copy } from "lucide-react";
import { MONO, buttonClass } from "./ui";

/**
 * Soru kimliğini panoya kopyalar. "Şu soru" diye konuşurken ekran görüntüsü
 * yerine kimlik paylaşılsın: listede "#a1b2c3" ile aranabiliyor.
 */
export function CopyIdButton({ id }: { id: string }) {
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(id);
          toast.success("Kimlik kopyalandı: #" + id.slice(-6));
        } catch {
          // Pano izni yoksa (http, eski tarayıcı) kimliği göster; elle kopyalansın.
          window.prompt("Soru kimliği", id);
        }
      }}
      className={buttonClass("ghost", "sm")}
      title={"Kimliği kopyala: " + id}
    >
      <Copy aria-hidden />
      <span className={MONO}>#{id.slice(-6)}</span>
      <span className="sr-only">— soru kimliğini kopyala</span>
    </button>
  );
}
