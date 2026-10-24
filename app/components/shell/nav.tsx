import {
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  MessageCircleQuestion,
  NotebookPen,
  TrendingUp,
  UserRound,
} from "lucide-react";
import type { NavItem, NavSection } from "@/components/tailadmin/layout/nav";

/*
 * Öğrenci menüsü — kenar çubuğu ve telefondaki alt sekme çubuğu AYNI beş
 * adres. Etkin öğe kitin kuralıyla: adrese en uzun eşleşen bağlantı.
 * Menüde kendi öğesi olmayan sayfalar `match` ile bir sekmeyi yakar:
 * sonuç ekranı gelişimin parçası, seviyeli check-up da bir test (girişi
 * "Testler"de).
 */

const TESTLER = { href: "/paketler", icon: <ClipboardList />, match: ["/seviyeli", "/seviye"] };
const GELISIM = { href: "/gelisim", icon: <TrendingUp />, match: ["/sonuc"] };

export const menu: NavSection[] = [
  {
    title: "Menü",
    items: [
      { href: "/panel", label: "Ana sayfa", icon: <LayoutDashboard /> },
      { ...TESTLER, label: "Testler" },
      // Yanlış defteri: her gün dönülen yer (aralıklı tekrar), bu yüzden menüde.
      { href: "/defter", label: "Yanlış defteri", icon: <NotebookPen /> },
      { ...GELISIM, label: "Gelişim" },
    ],
  },
  // Koçla olan işler. Telefonda alt çubukta kendi sekmeleri yok (beş sekme
  // sığıyor): ana sayfada "Ödevlerin" satırı ve koçun cevabı kartı, profilde
  // "Koçum" bölümü var; bu sayfalarda "Profil" sekmesi yanar.
  {
    title: "Koçum",
    items: [
      { href: "/odevler", label: "Ödevler", icon: <ClipboardCheck /> },
      { href: "/sorularim", label: "Koça sorularım", icon: <MessageCircleQuestion /> },
    ],
  },
  { title: "Hesap", items: [{ href: "/profil", label: "Profil", icon: <UserRound /> }] },
];

/**
 * Telefonda alt sekmeler: kısa adlar (beş sekme 375 piksele sığsın). Altıncı
 * sekme yok: ödevler ve koça sorular profildeki "Koçum" bölümünden açılıyor,
 * o sayfalardayken "Profil" sekmesi yanıyor (öğrenci nerede olduğunu bilsin).
 */
export const altMenu: NavItem[] = [
  { href: "/panel", label: "Ana sayfa", icon: <LayoutDashboard /> },
  { ...TESTLER, label: "Testler" },
  { href: "/defter", label: "Defter", icon: <NotebookPen /> },
  { ...GELISIM, label: "Gelişim" },
  { href: "/profil", label: "Profil", icon: <UserRound />, match: ["/odevler", "/sorularim"] },
];
