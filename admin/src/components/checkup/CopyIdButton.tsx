"use client";

import toast from "react-hot-toast";
import { Copy } from "lucide-react";
import { Button } from "@/components/tailadmin/ui/Button";
import { usePrompt } from "@/components/tailadmin/ui/Dialogs";
import { MONO } from "./ui";

/**
 * Soru kimliğini panoya kopyalar. "Şu soru" diye konuşurken ekran görüntüsü
 * yerine kimlik paylaşılsın: listede "#a1b2c3" ile aranabiliyor.
 *
 * Pano izni yoksa (http, eski tarayıcı) kimlik kitin soru penceresindeki
 * alanda gösterilir; elle kopyalanır (eskiden window.prompt).
 */
export function CopyIdButton({ id }: { id: string }) {
  const [pencere, sor] = usePrompt();
  return (
    <>
      {pencere}
      <Button
        variant="ghost"
        size="xs"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(id);
            toast.success("Kimlik kopyalandı: #" + id.slice(-6));
          } catch {
            await sor({
              title: "Soru kimliği",
              description: "Tarayıcı panoya kopyalamaya izin vermedi; kimliği alandan seçip kopyala.",
              label: "Kimlik",
              defaultValue: id,
              confirmLabel: "Tamam",
              cancelLabel: "Kapat",
              allowEmpty: true,
            });
          }
        }}
        title={"Kimliği kopyala: " + id}
        startIcon={<Copy />}
      >
        <span className={MONO}>#{id.slice(-6)}</span>
        <span className="sr-only">— soru kimliğini kopyala</span>
      </Button>
    </>
  );
}
