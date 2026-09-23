"use client";
import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import {
  ChevronDownIcon,
  GridIcon,
  HorizontaLDots,
  PageIcon,
  TaskIcon,
  UserCircleIcon,
} from "../icons/index";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  /** exact: yalnızca birebir adreste vurgulanır (alt sayfaları olan özet sayfası için). */
  subItems?: { name: string; path: string; exact?: boolean }[];
};

const navItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Dashboard",
    path: "/",
  },
  {
    icon: <PageIcon />,
    name: "Blog",
    subItems: [
      { name: "Tüm Blog Yazıları", path: "/blogs" },
      { name: "Yeni Blog Yazısı", path: "/blogs/new" },
    ],
  },
  {
    icon: <TaskIcon />,
    name: "Check-up",
    subItems: [
      { name: "Genel bakış", path: "/checkup", exact: true },
      { name: "Sorular", path: "/checkup/sorular" },
      { name: "Havuz durumu", path: "/checkup/havuz" },
      { name: "Öğrenciler", path: "/checkup/ogrenciler" },
      { name: "Paketler", path: "/checkup/paketler" },
    ],
  },
];

const othersItems: NavItem[] = [
  {
    icon: <UserCircleIcon />,
    name: "Kullanıcılar",
    path: "/users",
  },
];

/** Menü öğesi bulunulan adrese denk geliyor mu? */
function yolAktif(pathname: string | null, path: string, exact = false) {
  if (path === pathname) return true;
  if (!exact && pathname?.startsWith(path + "/")) return true;
  return false;
}

/** Bulunulan adrese göre hangi açılır menü açık olmalı. */
function adreseGoreAcikMenu(pathname: string | null) {
  const gruplar = [
    { type: "main" as const, items: navItems },
    { type: "others" as const, items: othersItems },
  ];
  for (const grup of gruplar) {
    const index = grup.items.findIndex((nav) =>
      nav.subItems?.some((s) => yolAktif(pathname, s.path, s.exact))
    );
    if (index !== -1) return { type: grup.type, index };
  }
  return null;
}

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();

  const renderMenuItems = (items: NavItem[], menuType: "main" | "others") => (
    <ul className="flex flex-col gap-4">
      {items.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              aria-expanded={openSubmenu?.type === menuType && openSubmenu?.index === index}
              className={`menu-item group ${
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "menu-item-active"
                  : "menu-item-inactive"
              } cursor-pointer ${
                !isExpanded && !isHovered ? "lg:justify-center" : "lg:justify-start"
              }`}
            >
              <span
                className={`${
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className="menu-item-text">{nav.name}</span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && (
                <ChevronDownIcon
                  className={`ml-auto w-5 h-5 transition-transform duration-200 ${
                    openSubmenu?.type === menuType && openSubmenu?.index === index
                      ? "rotate-180 text-brand-500"
                      : ""
                  }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                href={nav.path}
                className={`menu-item group ${
                  isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                }`}
              >
                <span
                  className={`${
                    isActive(nav.path)
                      ? "menu-item-icon-active"
                      : "menu-item-icon-inactive"
                  }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className="menu-item-text">{nav.name}</span>
                )}
              </Link>
            )
          )}
          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            /*
             * Açılır menü yüksekliği CSS ile: grid satırı 0fr → 1fr.
             * Eskiden scrollHeight ölçülüp efektte state'e yazılıyordu; ölçüm
             * her açılışta bir fazladan çizim demekti ve React 19'un
             * "efekt içinde setState" kuralına takılıyordu.
             *
             * inert: kapalıyken içerideki bağlantılar sekmeyle gezilemez —
             * görünmeyen bağlantıya odaklanmak klavye kullanıcısını kaybeder.
             */
            <div
              inert={!(openSubmenu?.type === menuType && openSubmenu?.index === index)}
              className={`grid overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out ${
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "grid-rows-[1fr]"
                  : "grid-rows-[0fr]"
              }`}
            >
              <ul className="mt-2 ml-9 min-h-0 space-y-1 overflow-hidden">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.name}>
                    <Link
                      href={subItem.path}
                      className={`menu-dropdown-item ${
                        isActive(subItem.path, subItem.exact)
                          ? "menu-dropdown-item-active"
                          : "menu-dropdown-item-inactive"
                      }`}
                    >
                      {subItem.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  const isActive = (path: string, exact = false) => yolAktif(pathname, path, exact);

  const pathSubmenu = adreseGoreAcikMenu(pathname);

  /*
   * Menü durumu iki kaynaktan geliyor: adres (yukarıdaki türetme) ve
   * kullanıcının elle açıp kapaması. Adres değiştiğinde elle yapılan seçim
   * bırakılıp adrese dönülüyor — bu ayar ÇİZİM SIRASINDA yapılıyor (React'in
   * önerdiği desen). Efekte koymak fazladan bir çizim turu demek ve
   * "efekt içinde setState" kuralına takılıyor.
   */
  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "main" | "others";
    index: number;
  } | null>(pathSubmenu);
  const [sonAdres, setSonAdres] = useState(pathname);

  if (sonAdres !== pathname) {
    setSonAdres(pathname);
    setOpenSubmenu(pathSubmenu);
  }

  const handleSubmenuToggle = (index: number, menuType: "main" | "others") => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        return null;
      }
      return { type: menuType, index };
    });
  };

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 dark:text-gray-100 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
        ${
          isExpanded || isMobileOpen
            ? "w-[260px] lg:w-[290px]"
            : isHovered
            ? "w-[260px] lg:w-[290px]"
            : "w-[72px] lg:w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`py-8 flex ${
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
        }`}
      >
        <Link href="/">
          {isExpanded || isHovered || isMobileOpen ? (
            <span className="text-xl font-bold text-gray-800 dark:text-white/90">
              KOCUMNET
            </span>
          ) : (
            <span className="text-lg font-bold text-gray-800 dark:text-white/90">
              kn
            </span>
          )}
        </Link>
      </div>
      <div className="flex flex-col flex-1 overflow-y-auto duration-300 ease-linear no-scrollbar min-h-0">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? "Menü" : <HorizontaLDots />}
              </h2>
              {renderMenuItems(navItems, "main")}
            </div>

            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? "Diğer" : <HorizontaLDots />}
              </h2>
              {renderMenuItems(othersItems, "others")}
            </div>
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;
