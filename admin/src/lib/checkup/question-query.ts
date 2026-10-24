import "server-only";
import { Prisma } from "./generated/client";
import { db } from "./db";
import { QUESTION_LEVELS, isQuestionStatus, type QuestionStatus } from "./format";
import type { EksikKodu } from "./shared/question-readiness";

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
  // Yayın kapısının "kazanım" maddesi yalnızca seviye 1'i ister (seviye 2-3 kazanımsız olabilir).
  l1kazanimsiz: { label: "Seviye 1, kazanımı yok", where: { level: "L1_TEMEL", objectiveId: null } },
} as const satisfies Record<string, { label: string; where: Prisma.QuestionWhereInput }>;
export type EksikKey = keyof typeof EKSIK;

/**
 * "Yayına hazır mı" eksiklerinin listedeki karşılığı: toplu yayın sonucundaki
 * "çözüm yok (2)" bağlantısı bu süzgeci açar. Formül, şık ve şık sayısı
 * eksiklerinin sorgu karşılığı yok (içerik çözümlenmeden bilinmez); onlar
 * soru soru listelenir.
 */
export const EKSIK_SUZGECI: Partial<Record<EksikKodu, EksikKey>> = {
  cozum: "cozumsuz",
  hata_tipi: "hatatipsiz",
  seviye: "seviyesiz",
  kazanim: "l1kazanimsiz",
};

/*
 * Ek içerik süzgeci — ipucu, video, adımlı çözüm. Tek seçim kutusu: listenin
 * süzgeç satırı zaten kalabalık. "Yok" seçenekleri içerik ekibinin "hangi
 * soruya ipucu yazmadık" sorusu için.
 *
 * İpucu: kayıt yolları ipucusuz soruya null yazıyor; elle düzenlenmiş bir
 * satırda boş dizi de "ipucu yok" sayılsın. Adımlı çözüm: çözümün blok
 * dizisinde en az bir `step_break` (jsonb @> ile).
 */
const IPUCU_YOK: Prisma.QuestionWhereInput[] = [{ hints: { equals: Prisma.AnyNull } }, { hints: { equals: [] } }];
export const ICERIK = {
  ipucu: { label: "İpucu var", where: { NOT: IPUCU_YOK } },
  ipucusuz: { label: "İpucu yok", where: { OR: IPUCU_YOK } },
  video: { label: "Video çözüm var", where: { videoUrl: { not: null } } },
  videosuz: { label: "Video çözüm yok", where: { videoUrl: null } },
  adimli: { label: "Adımlı çözüm", where: { solution: { path: ["blocks"], array_contains: [{ type: "step_break" }] } } },
} as const satisfies Record<string, { label: string; where: Prisma.QuestionWhereInput }>;
export type IcerikKey = keyof typeof ICERIK;

/** Açık öğrenci bildirimi (QuestionNote, STUDENT_REPORT). */
const ACIK_BILDIRIM: Prisma.QuestionNoteWhereInput = { kind: "STUDENT_REPORT", resolvedAt: null };

export interface ListeSuzgeci {
  ara: string;
  konu: string;
  durum: QuestionStatus | "";
  eksik: EksikKey | "";
  kazanim: string;
  /** Toplu içe aktarma (ImportBatch) kimliği: yalnızca o dosyadan gelen sorular. */
  parti: string;
  /** "acik": çözülmemiş inceleme notu YA DA öğrenci bildirimi olan sorular (ikisi de QuestionNote). */
  not: "acik" | "";
  /** "acik": çözülmemiş öğrenci bildirimi olan sorular. */
  bildirim: "acik" | "";
  icerik: IcerikKey | "";
  /**
   * Yazan personelin kimliği (backend users.id, damganın "(#12)" kısmı).
   * Adreste e-posta değil kimlik durur; "Benim sorularım" kendi kimliğin.
   */
  yazan: string;
  /** Seviye (L1_TEMEL, L2_ORTA, L3_ANALIZ); seviyesizler için "Eksik" süzgeci. */
  seviye: string;
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
    not: tek(sp.not) === "acik" ? "acik" : "",
    bildirim: tek(sp.bildirim) === "acik" ? "acik" : "",
    icerik: Object.hasOwn(ICERIK, tek(sp.icerik)) ? (tek(sp.icerik) as IcerikKey) : "",
    yazan: /^\d{1,10}$/.test(tek(sp.yazan)) ? tek(sp.yazan) : "",
    seviye: (QUESTION_LEVELS as readonly string[]).includes(tek(sp.seviye)) ? tek(sp.seviye) : "",
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

  // Koşullar AND listesinde: aynı alana bakan iki süzgeç (çözümsüz + adımlı
  // çözüm, açık not + açık bildirim) nesneye yayılınca biri ötekini EZERDİ.
  const kosullar: Prisma.QuestionWhereInput[] = [
    ...(s.konu ? [{ topic: { slug: s.konu } }] : []),
    ...(s.durum ? [{ status: s.durum }] : []),
    ...(s.kazanim ? [{ objective: { code: s.kazanim.toUpperCase() } }] : []),
    ...(s.parti ? [{ importBatchId: s.parti }] : []),
    // Personel notu ya da öğrenci bildirimi: ikisi de "bakılacak" demek.
    ...(s.not ? [{ notes: { some: { resolvedAt: null } } }] : []),
    ...(s.bildirim ? [{ notes: { some: ACIK_BILDIRIM } }] : []),
    ...(s.eksik ? [EKSIK[s.eksik].where] : []),
    ...(s.icerik ? [ICERIK[s.icerik].where] : []),
    ...(s.yazan ? [yazanKosulu(s.yazan)] : []),
    ...(s.seviye ? [{ level: s.seviye as Prisma.QuestionWhereInput["level"] }] : []),
    ...(arama ? [arama] : []),
  ];
  return kosullar.length ? { AND: kosullar } : {};
}

/**
 * Yazan personel: damga "e-posta (#kimlik)" biçiminde, kimlik değişmez.
 * Parantez de aranır: "(#12)" "(#112)" ile karışmasın.
 */
export function yazanKosulu(kimlik: string): Prisma.QuestionWhereInput {
  return { createdByStaff: { endsWith: "(#" + kimlik + ")" } };
}

/** Listede ve kuyrukta "Yazan" seçenekleri: soru yazmış personel, en çok yazan üstte. */
export async function yazanlar(): Promise<{ kimlik: string; ad: string; sayi: number }[]> {
  const satirlar = await db.question.groupBy({
    by: ["createdByStaff"],
    where: { createdByStaff: { not: null } },
    _count: { _all: true },
  });
  const kisiler = new Map<string, { kimlik: string; ad: string; sayi: number }>();
  for (const r of satirlar) {
    const m = r.createdByStaff?.match(/^(.*)\s*\(#(\d+)\)$/);
    if (!m) continue;
    // Aynı kişinin e-postası değiştiyse iki damga olur: kimlikte birleşir.
    const onceki = kisiler.get(m[2]);
    kisiler.set(m[2], { kimlik: m[2], ad: onceki?.ad ?? m[1].trim(), sayi: (onceki?.sayi ?? 0) + r._count._all });
  }
  return [...kisiler.values()].sort((a, b) => b.sayi - a.sayi || a.ad.localeCompare(b.ad, "tr"));
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
