import type { ReactNode } from "react";
import { net } from "@/lib/bicim";
import { BasariCubugu } from "@/components/BasariCubugu";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/tailadmin/ui/Table";

export interface GrupSatiri {
  anahtar: string | number;
  ad: ReactNode;
  /** Adın altında küçük satır (konunun dersi, kazanımın konusu). */
  alt?: ReactNode;
  soru: number;
  dogru: number;
  yanlis: number;
  bos: number;
  net: number;
  basari: number;
}

/**
 * Rapor satırları (ders, konu, kazanım). Telefonda doğru/yanlış/boş
 * sütunları adın altına iner: tablo yana kaymadan okunur.
 */
export function GrupTablosu({ baslik, satirlar }: { baslik: string; satirlar: GrupSatiri[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableCell isHeader>{baslik}</TableCell>
          <TableCell isHeader align="end" className="max-sm:hidden">
            Soru
          </TableCell>
          <TableCell isHeader align="end" className="max-sm:hidden">
            Doğru
          </TableCell>
          <TableCell isHeader align="end" className="max-sm:hidden">
            Yanlış
          </TableCell>
          <TableCell isHeader align="end" className="max-sm:hidden">
            Boş
          </TableCell>
          <TableCell isHeader align="end">
            Net
          </TableCell>
          <TableCell isHeader className="w-36 sm:w-44">
            Başarı
          </TableCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {satirlar.map((s) => (
          <TableRow key={s.anahtar}>
            <TableCell className="min-w-40">
              <span className="block font-medium text-gray-800">{s.ad}</span>
              {s.alt ? <span className="mt-0.5 block text-theme-xs text-gray-500">{s.alt}</span> : null}
              <span className="tabular mt-0.5 block text-theme-xs text-gray-500 sm:hidden">
                {s.soru} soru: {s.dogru} doğru, {s.yanlis} yanlış, {s.bos} boş
              </span>
            </TableCell>
            <TableCell align="end" className="tabular max-sm:hidden">
              {s.soru}
            </TableCell>
            <TableCell align="end" className="tabular max-sm:hidden">
              {s.dogru}
            </TableCell>
            <TableCell align="end" className="tabular max-sm:hidden">
              {s.yanlis}
            </TableCell>
            <TableCell align="end" className="tabular max-sm:hidden">
              {s.bos}
            </TableCell>
            <TableCell align="end" className="tabular">
              <span className="font-semibold text-gray-800">{net(s.net)}</span>
            </TableCell>
            <TableCell>
              <BasariCubugu yuzde={s.basari} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
