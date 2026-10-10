import "server-only";
import { Prisma } from "./generated/client";
import { db } from "./db";
import { isQuestionStatus, type QuestionStatus } from "./format";

/**
 * Soru listesinin süzgeci ve sırası — TEK tanım. Liste sayfası ve soru
 * ekranındaki önceki/sonraki gezinmesi aynı koşul ve sırayı kullanır;
 * "sonraki" listede gördüğün bir sonraki satırdır.
 */

/*
 * Kalite süzgeci — "neyi eksik bıraktık" sorusu. Çözümsüz soru öğrenciye
 * yanlışını öğretemez; hata tipsiz çeldirici teşhise katılmaz; seviyesiz
 * soru seviyeli check-up'a girmez.
 */
export const EKSIK = {
  cozumsuz: { label: "Çözümü yok", where: { solution: { equals: Prisma.DbNull } } },
  hatatipsiz: { label: "Hata tipi eksik şıkkı var", where: { choices: { some: { isCorrect: false, errorType: null } } } },
  seviyesiz: { label: "Seviyesi yok", where: { level: null } },
  kazanimsiz: { label: "Kazanımı yok", where: { objectiveId: null } },
} as const satisfies Record<string, { label: string; where: Prisma.QuestionWhereInput }>;
export type EksikKey = keyof typeof EKSIK;

export interface ListeSuzgeci {
  ara: string;
  konu: string;
  durum: QuestionStatus | "";
  eksik: EksikKey | "";
  kazanim: string;
  /** Toplu içe aktarma (ImportBatch) kimliği: yalnızca o dosyadan gelen sorular. */
  parti: string;
  sayfa: number;
}

/** Kimlik araması: "#a1b2c3" ya da tam kimlik (cuid). Boşluk yoksa ve yeterince uzunsa. */
const KIMLIK = /^#?([a-z0-9]{6,32})$/i;

type Params = Record<string, string | string[] | undefined>;
const tek = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export function listeSuzgeci(sp: Params): ListeSuzgeci {
  const durum = tek(sp.durum);
  return {
    ara: tek(sp.ara).trim().slice(0, 200),
    konu: tek(sp.konu),
    durum: isQuestionStatus(durum) ? durum : "",
    // hasOwn: `in` "toString" gibi prototip adlarını da kabul ederdi.
    eksik: Object.hasOwn(EKSIK, tek(sp.eksik)) ? (tek(sp.eksik) as EksikKey) : "",
    kazanim: tek(sp.kazanim).trim().slice(0, 40),
    // Kimlik biçimi dışındaki değer süzgeç sayılmaz (sorgu yine parametreli).
    parti: /^[a-z0-9]{1,64}$/i.test(tek(sp.parti)) ? tek(sp.parti) : "",
    sayfa: Math.max(1, Math.floor(Number(tek(sp.sayfa) || 1)) || 1),
  };
}

/** Liste sorgusu dizesinden ("durum=REVIEW&sayfa=2") süzgeç. */
export function listeSuzgeciSorgudan(sorgu: string): ListeSuzgeci {
  return listeSuzgeci(Object.fromEntries(new URLSearchParams(sorgu)));
}

export function listeKosulu(s: ListeSuzgeci): Prisma.QuestionWhereInput {
  // Arama: soru metni, kaynak ("2023 TYT / 12") ya da kimlik ("#a1b2c3").
  const kimlik = KIMLIK.exec(s.ara)?.[1]?.toLowerCase();
  const arama: Prisma.QuestionWhereInput | null = s.ara
    ? {
        OR: [
          // stemText tam da bunun için var (PLAN §3): JSONB gövdede arama yapılamaz.
          { stemText: { contains: s.ara, mode: "insensitive" } },
          { sourceRef: { contains: s.ara, mode: "insensitive" } },
          ...(kimlik ? [{ id: kimlik }, { id: { endsWith: kimlik } }] : []),
        ],
      }
    : null;

  return {
    ...(s.konu ? { topic: { slug: s.konu } } : {}),
    ...(s.durum ? { status: s.durum } : {}),
    ...(s.kazanim ? { objective: { code: s.kazanim.toUpperCase() } } : {}),
    ...(s.parti ? { importBatchId: s.parti } : {}),
    ...(s.eksik ? EKSIK[s.eksik].where : {}),
    ...(arama ? { AND: [arama] } : {}),
  };
}

/** Son düzenlenen üstte; eşitlikte kimlik — sayfalama ve komşular kararlı olsun. */
export const LISTE_SIRASI: Prisma.QuestionOrderByWithRelationInput[] = [{ updatedAt: "desc" }, { id: "asc" }];

export interface Komsular {
  onceki: string | null;
  sonraki: string | null;
  /** Sorunun listedeki sırası (1'den); soru süzgece artık uymuyorsa null. */
  sira: number | null;
  toplam: number;
}

/**
 * Süzgeçli listede bu sorunun bir öncesi ve bir sonrası. Liste sırası
 * (updatedAt azalan, id artan) üzerinden imleçle bulunur — tüm listeyi
 * çekmeden, yüzlerce soruda da iki küçük sorgu.
 */
export async function komsular(id: string, s: ListeSuzgeci): Promise<Komsular | null> {
  const cur = await db.question.findUnique({ where: { id }, select: { updatedAt: true } });
  if (!cur) return null;

  const kosul = listeKosulu(s);
  const once: Prisma.QuestionWhereInput = {
    OR: [{ updatedAt: { gt: cur.updatedAt } }, { updatedAt: cur.updatedAt, id: { lt: id } }],
  };
  const sonra: Prisma.QuestionWhereInput = {
    OR: [{ updatedAt: { lt: cur.updatedAt } }, { updatedAt: cur.updatedAt, id: { gt: id } }],
  };

  const [onceki, sonraki, onceSayisi, toplam, icinde] = await Promise.all([
    db.question.findFirst({
      where: { AND: [kosul, once] },
      orderBy: [{ updatedAt: "asc" }, { id: "desc" }],
      select: { id: true },
    }),
    db.question.findFirst({ where: { AND: [kosul, sonra] }, orderBy: LISTE_SIRASI, select: { id: true } }),
    db.question.count({ where: { AND: [kosul, once] } }),
    db.question.count({ where: kosul }),
    db.question.count({ where: { AND: [kosul, { id }] } }),
  ]);

  return {
    onceki: onceki?.id ?? null,
    sonraki: sonraki?.id ?? null,
    sira: icinde ? onceSayisi + 1 : null,
    toplam,
  };
}
