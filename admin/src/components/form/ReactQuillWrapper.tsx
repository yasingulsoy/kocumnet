"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import dynamic from "next/dynamic";

// react-quill-new kullan (React 19 uyumlu)
// react-quill yerine react-quill-new kullanıyoruz çünkü React 19'da findDOMNode kaldırıldı
const ReactQuill = dynamic(() => import("react-quill-new"), { 
  ssr: false,
  loading: () => <div className="h-[400px] bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
});

import "react-quill-new/dist/quill.snow.css";

interface ReactQuillWrapperProps {
  value: string;
  onChange: (value: string) => void;
  modules?: any;
  formats?: string[];
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  enableImageDeleteOverlay?: boolean;
}

const ReactQuillWrapper: React.FC<ReactQuillWrapperProps> = ({
  value,
  onChange,
  modules,
  formats,
  placeholder,
  className,
  style,
  enableImageDeleteOverlay = true,
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredImgSrc, setHoveredImgSrc] = useState<string | null>(null);
  const [overlayPos, setOverlayPos] = useState<{ top: number; left: number } | null>(null);
  const hoveringOverlayRef = useRef(false);
  const [linkTooltip, setLinkTooltip] = useState<{
    href: string;
    top: number;
    left: number;
  } | null>(null);

  const removeImageFromHtml = useMemo(() => {
    return (html: string, srcToRemove: string) => {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html || "", "text/html");
        const imgs = Array.from(doc.querySelectorAll("img"));
        const target = imgs.find((img) => img.getAttribute("src") === srcToRemove);
        if (target) target.remove();
        return doc.body.innerHTML;
      } catch (_) {
        // Fallback: basit bir regex (src eşleşen ilk img tag'ini sil)
        const esc = srcToRemove.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp(`<img\\b[^>]*\\bsrc\\s*=\\s*(['"])${esc}\\1[^>]*>`, "i");
        return (html || "").replace(re, "");
      }
    };
  }, []);

  useEffect(() => {
    // Client-side'da mount olduktan sonra ReactQuill'i render et
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    if (!enableImageDeleteOverlay) return;

    const container = containerRef.current;
    if (!container) return;

    const editorEl = container.querySelector(".ql-editor") as HTMLElement | null;
    if (!editorEl) return;

    const updateOverlayForImg = (imgEl: HTMLImageElement) => {
      const src = imgEl.getAttribute("src");
      if (!src) return;

      const imgRect = imgEl.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Butonu img'nin sağ üstüne koy
      const top = imgRect.top - containerRect.top + 8; // 8px padding
      const left = imgRect.right - containerRect.left - 44; // buton genişliği ~36 + padding

      setHoveredImgSrc(src);
      setOverlayPos({ top, left: Math.max(8, left) });
    };

    const onMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Overlay üstündeyken editor hareketi overlay'i kapatmasın
      if (hoveringOverlayRef.current) return;

      const img = target.closest("img") as HTMLImageElement | null;
      if (img && editorEl.contains(img)) {
        setLinkTooltip(null);
        updateOverlayForImg(img);
        return;
      }

      setHoveredImgSrc(null);
      setOverlayPos(null);

      const anchor = target.closest("a") as HTMLAnchorElement | null;
      if (anchor && editorEl.contains(anchor)) {
        const href = anchor.getAttribute("href")?.trim();
        if (href && !href.toLowerCase().startsWith("javascript:")) {
          const linkRect = anchor.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const top = linkRect.top - containerRect.top - 6;
          const left = linkRect.left - containerRect.left + linkRect.width / 2;
          setLinkTooltip({ href, top, left });
          return;
        }
      }
      setLinkTooltip(null);
    };

    const onMouseLeave = () => {
      // Overlay'e geçişte anlık kaybolmasın
      setTimeout(() => {
        if (!hoveringOverlayRef.current) {
          setHoveredImgSrc(null);
          setOverlayPos(null);
          setLinkTooltip(null);
        }
      }, 120);
    };

    editorEl.addEventListener("mousemove", onMouseMove);
    editorEl.addEventListener("mouseleave", onMouseLeave);

    return () => {
      editorEl.removeEventListener("mousemove", onMouseMove);
      editorEl.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [isMounted, enableImageDeleteOverlay]);

  if (!isMounted) {
    return (
      <div 
        className={`bg-white dark:bg-gray-800 rounded-lg ${className || ""}`}
        style={{ minHeight: "400px", ...style }}
      >
        <div className="h-full bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className || ""}`} style={style}>
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        className="bg-white dark:bg-gray-800"
      />
      {linkTooltip && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-[60] max-w-[min(90vw,22rem)] rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs leading-snug text-gray-800 shadow-theme-md dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          style={{
            top: linkTooltip.top,
            left: linkTooltip.left,
            transform: "translate(-50%, -100%)",
          }}
        >
          <span className="block break-all font-mono text-[11px]">{linkTooltip.href}</span>
        </div>
      )}
      {enableImageDeleteOverlay && hoveredImgSrc && overlayPos && (
        <button
          type="button"
          onMouseEnter={() => {
            hoveringOverlayRef.current = true;
          }}
          onMouseLeave={() => {
            hoveringOverlayRef.current = false;
            setHoveredImgSrc(null);
            setOverlayPos(null);
          }}
          onClick={() => {
            if (!hoveredImgSrc) return;
            const next = removeImageFromHtml(value, hoveredImgSrc);
            onChange(next);
            setHoveredImgSrc(null);
            setOverlayPos(null);
          }}
          className="absolute z-[55] bg-red-600 text-white text-xs font-medium px-2 py-1 rounded-md shadow hover:bg-red-700"
          style={{ top: overlayPos.top, left: overlayPos.left }}
          aria-label="Görseli sil"
          title="Görseli sil"
        >
          Sil
        </button>
      )}
    </div>
  );
};

export default ReactQuillWrapper;
