import { Field } from "@/components/tailadmin/form/Field";
import { Select } from "@/components/tailadmin/form/Select";
import { Button } from "@/components/tailadmin/ui/Button";

/*
 * Grup süzgeci (?grup=<id>): Riskli öğrenciler ve Bu hafta. Düz GET formu,
 * sunucu bileşeni: süzgeç adreste durur, bağlantı paylaşılınca aynı liste
 * açılır. Öbür süzgeçler (`gizli`) gizli alanla taşınır.
 */
export function GrupSuzgeci({
  action,
  gruplar,
  secili,
  gizli = {},
}: {
  action: string;
  gruplar: { id: string; name: string; _count: { members: number } }[];
  secili: string | null;
  gizli?: Record<string, string | undefined>;
}) {
  if (gruplar.length === 0) return null;
  return (
    <form method="get" action={action} className="flex flex-wrap items-end gap-2">
      {Object.entries(gizli).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <Field label="Grup" className="min-w-48">
        <Select
          name="grup"
          defaultValue={secili ?? ""}
          compact
          options={[
            { value: "", label: "Bütün öğrenciler" },
            ...gruplar.map((g) => ({ value: g.id, label: g.name + " (" + g._count.members + ")" })),
          ]}
        />
      </Field>
      <Button type="submit" variant="outline" size="xs">
        Uygula
      </Button>
    </form>
  );
}
