"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  apiGet,
  apiPost,
  apiDelete,
  apiDeleteBatch,
  apiUploadFilesWithProgress,
  apiDownloadFile,
  apiDownloadFolderZip,
} from "@/lib/api";
import {
  FolderIcon,
  FileIcon,
  TrashBinIcon,
  PlusIcon,
  ChevronLeftIcon,
  ArrowRightIcon,
  EyeIcon,
  DownloadIcon,
} from "@/icons";
import { API_URL } from "@/lib/api";
import toast from "react-hot-toast";
import { sortRowData, toggleSortState } from "@/lib/tableSort";
import { SortableTableTh } from "@/components/common/SortableTableTh";

interface FileItem {
  name: string;
  type: "file" | "directory";
  size: number | null;
  modified: string;
  path: string;
}

interface FileListResponse {
  success: boolean;
  data: {
    items: FileItem[];
    currentPath: string;
    basePath: string;
  };
}

function parentFolderPath(itemPath: string): string {
  const idx = itemPath.lastIndexOf("/");
  if (idx <= 0) return "";
  return itemPath.slice(0, idx);
}

type FileSortKey = "name" | "type" | "size" | "modified";

/** backend/routes/files.js içindeki FILES_UPLOAD_MAX_COUNT ile uyumlu kalsın */
const FILES_UPLOAD_BATCH = 2000;

/** Sunucu ile aynı: yalnızca bu uzantılar yüklenir */
function isAllowedUploadFileName(fileName: string): boolean {
  return /\.(jpe?g|png|gif|webp)$/i.test(fileName);
}

function fileIdentityKey(file: File): string {
  const rp = (
    (file as File & { webkitRelativePath?: string }).webkitRelativePath || ""
  ).replace(/\\/g, "/");
  return `${rp}\0${file.name}\0${file.size}\0${file.lastModified}`;
}

function countDistinctRootFolders(files: File[]): number {
  const roots = new Set<string>();
  for (const f of files) {
    const rp = (
      (f as File & { webkitRelativePath?: string }).webkitRelativePath || ""
    )
      .replace(/\\/g, "/")
      .trim();
    if (!rp) continue;
    const first = rp.split("/").filter(Boolean)[0];
    if (first) roots.add(first);
  }
  return roots.size;
}

async function readAllDirectoryEntries(
  reader: FileSystemDirectoryReader
): Promise<FileSystemEntry[]> {
  const acc: FileSystemEntry[] = [];
  await new Promise<void>((resolve, reject) => {
    const readChunk = (): void => {
      reader.readEntries(
        (entries) => {
          if (entries.length === 0) {
            resolve();
            return;
          }
          acc.push(...entries);
          readChunk();
        },
        (err) => reject(err ?? new Error("Klasör okunamadı"))
      );
    };
    readChunk();
  });
  return acc;
}

async function collectFromEntry(
  entry: FileSystemEntry,
  pathPrefix: string,
  out: File[]
): Promise<void> {
  if (entry.isFile) {
    await new Promise<void>((resolve, reject) => {
      (entry as FileSystemFileEntry).file(
        (file) => {
          const normalizedPrefix = pathPrefix.replace(/\/$/, "");
          const rel =
            normalizedPrefix.length > 0 ? `${normalizedPrefix}/${file.name}` : file.name;
          Object.defineProperty(file, "webkitRelativePath", {
            value: rel.replace(/\\/g, "/"),
            configurable: true,
            enumerable: true,
          });
          out.push(file);
          resolve();
        },
        () => reject(new Error("Dosya okunamadı"))
      );
    });
    return;
  }

  const dirEntry = entry as FileSystemDirectoryEntry;
  const normalizedPrefix = pathPrefix.replace(/\/$/, "");
  const nextPrefix =
    normalizedPrefix.length > 0
      ? `${normalizedPrefix}/${dirEntry.name}`
      : dirEntry.name;

  const reader = dirEntry.createReader();
  const children = await readAllDirectoryEntries(reader);
  for (const child of children) {
    await collectFromEntry(child, nextPrefix, out);
  }
}

async function collectFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
  const out: File[] = [];
  const items = dataTransfer.items;
  const tasks: Promise<void>[] = [];

  for (let i = 0; i < items.length; i++) {
    const dtItem = items[i];
    if (dtItem.kind !== "file") continue;

    const entry =
      typeof dtItem.webkitGetAsEntry === "function" ? dtItem.webkitGetAsEntry() : null;

    if (entry) {
      tasks.push(collectFromEntry(entry, "", out));
      continue;
    }

    const f = dtItem.getAsFile();
    if (f) out.push(f);
  }

  await Promise.all(tasks);
  return out;
}

const fileTh =
  "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400";

const FileManager: React.FC = () => {
  const [items, setItems] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [showNewFolderModal, setShowNewFolderModal] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<File[]>([]);
  const [uploadBar, setUploadBar] = useState<null | { percent: number; label: string }>(null);
  const [dropActive, setDropActive] = useState(false);
  const [moveItem, setMoveItem] = useState<FileItem | null>(null);
  const [moveDestFolder, setMoveDestFolder] = useState("");
  const [moveNewName, setMoveNewName] = useState("");
  const [moving, setMoving] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [sort, setSort] = useState<{ key: FileSortKey; dir: "asc" | "desc" } | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const atRoot = currentPath === "" || currentPath === "/";

  const queueRootFolderCount = useMemo(
    () => countDistinctRootFolders(uploadQueue),
    [uploadQueue]
  );

  useEffect(() => {
    setSort(null);
    setSelectedPaths(new Set());
  }, [currentPath]);

  const requestSort = useCallback((key: FileSortKey) => {
    setSort((prev) => toggleSortState(prev, key));
  }, []);

  const sortedItems = useMemo(
    () =>
      sortRowData(items, sort, {
        name: (i) => i.name,
        type: (i) => (i.type === "directory" ? 0 : 1),
        size: (i) => i.size ?? 0,
        modified: (i) => new Date(i.modified).getTime(),
      }),
    [items, sort]
  );

  const selectablePaths = useMemo(() => sortedItems.map((i) => i.path), [sortedItems]);
  const selectedCount = selectedPaths.size;
  const allSelected =
    selectablePaths.length > 0 && selectablePaths.every((p) => selectedPaths.has(p));
  const someSelected = selectablePaths.some((p) => selectedPaths.has(p));

  useEffect(() => {
    const existing = new Set(items.map((i) => i.path));
    setSelectedPaths((prev) => {
      let removed = false;
      const next = new Set<string>();
      prev.forEach((p) => {
        if (existing.has(p)) next.add(p);
        else removed = true;
      });
      return removed ? next : prev;
    });
  }, [items]);

  const toggleSelectPath = useCallback((path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedPaths((prev) => {
      if (selectablePaths.length === 0) return new Set();
      const allOn = selectablePaths.every((p) => prev.has(p));
      if (allOn) return new Set();
      return new Set(selectablePaths);
    });
  }, [selectablePaths]);

  const clearSelection = useCallback(() => setSelectedPaths(new Set()), []);

  useEffect(() => {
    const el = selectAllRef.current;
    if (el) el.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  const loadFiles = async (path: string = "") => {
    try {
      setLoading(true);
      setError("");

      const cleanPath = path.replace(/[<>:"|?*\x00-\x1f]/g, "").trim();

      const response = await apiGet<FileListResponse>(
        `/api/files/list?folder=${encodeURIComponent(cleanPath)}`
      );
      if (response.success) {
        setItems(response.data.items);
        const cleanCurrentPath = response.data.currentPath
          .replace(/[<>:"|?*\x00-\x1f]/g, "")
          .trim();
        setCurrentPath(cleanCurrentPath === "/" ? "" : cleanCurrentPath);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Dosyalar yüklenemedi";
      setError(message);
      setCurrentPath("");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    const paths = Array.from(selectedPaths);
    if (paths.length === 0) return;
    if (
      !confirm(
        `${paths.length} öğeyi kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`
      )
    ) {
      return;
    }
    try {
      setBulkDeleting(true);
      const result = await apiDeleteBatch(paths);
      await loadFiles(currentPath);
      clearSelection();
      if (result.failed?.length) {
        toast.error(`${result.deleted} silindi, ${result.failed.length} başarısız`);
      } else {
        toast.success(result.message || `${result.deleted} öğe silindi`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Toplu silme başarısız";
      toast.error(message);
    } finally {
      setBulkDeleting(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const handleFolderClick = (item: FileItem) => {
    if (item.type === "directory") {
      const newPath =
        atRoot ? item.name : `${currentPath}/${item.name}`;
      loadFiles(newPath);
    }
  };

  const handleBack = () => {
    if (atRoot) return;
    const pathParts = currentPath.split("/").filter(Boolean);
    pathParts.pop();
    const newPath = pathParts.length > 0 ? pathParts.join("/") : "";
    loadFiles(newPath);
  };

  const handleDelete = async (item: FileItem) => {
    if (
      !confirm(
        `${item.name} ${item.type === "directory" ? "klasörünü" : "dosyasını"} silmek istediğinize emin misiniz?`
      )
    ) {
      return;
    }

    try {
      setDeleting(item.path);
      await apiDelete(`/api/files/delete`, { path: item.path });
      setSelectedPaths((prev) => {
        if (!prev.has(item.path)) return prev;
        const next = new Set(prev);
        next.delete(item.path);
        return next;
      });
      await loadFiles(currentPath);
      toast.success("Silindi");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Silme işlemi başarısız";
      toast.error(message);
    } finally {
      setDeleting(null);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error("Klasör adı gerekli");
      return;
    }

    try {
      await apiPost(`/api/files/mkdir`, {
        path: atRoot ? "" : currentPath,
        name: newFolderName.trim(),
      });
      setShowNewFolderModal(false);
      setNewFolderName("");
      await loadFiles(currentPath);
      toast.success("Klasör oluşturuldu");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Klasör oluşturulamadı";
      toast.error(message);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFolderUploadClick = () => {
    folderInputRef.current?.click();
  };

  const addIncomingToQueue = useCallback((incoming: File[]) => {
    const allowed = incoming.filter((f) => isAllowedUploadFileName(f.name));
    const skipped = incoming.length - allowed.length;
    if (skipped > 0) {
      toast.error(
        `${skipped} dosya atlandı — yalnızca JPG, PNG, GIF ve WebP yüklenebilir.`
      );
    }
    if (allowed.length === 0) return;

    let appended = 0;
    setUploadQueue((prev) => {
      const m = new Map<string, File>();
      prev.forEach((f) => m.set(fileIdentityKey(f), f));
      for (const f of allowed) {
        const k = fileIdentityKey(f);
        if (!m.has(k)) appended += 1;
        m.set(k, f);
      }
      return Array.from(m.values());
    });

    if (appended > 0) {
      toast.success(`${appended} yeni dosya kuyruğa eklendi`);
    } else {
      toast.success("Seçilen dosyalar zaten kuyrukta");
    }
  }, []);

  const clearUploadQueue = useCallback(() => {
    setUploadQueue([]);
    toast.success("Kuyruk temizlendi");
  }, []);

  const executeUploadQueue = async () => {
    if (uploadQueue.length === 0) return;
    const fileArr = uploadQueue;
    const folder = atRoot ? "" : currentPath;
    const batches: File[][] = [];
    for (let i = 0; i < fileArr.length; i += FILES_UPLOAD_BATCH) {
      batches.push(fileArr.slice(i, i + FILES_UPLOAD_BATCH));
    }

    setUploading(true);
    setUploadBar({
      percent: 0,
      label: batches.length ? `Parti 1 / ${batches.length} · %0` : "%0",
    });

    try {
      for (let b = 0; b < batches.length; b++) {
        const slice = batches[b];
        await apiUploadFilesWithProgress(folder, slice, ({ loaded, total, lengthComputable }) => {
          let inner = 0.45;
          if (lengthComputable && total > 0) inner = loaded / total;
          const overall = batches.length ? (b + inner) / batches.length : 1;
          const pct = Math.min(99, Math.round(overall * 100));
          setUploadBar({
            percent: pct,
            label: `Parti ${b + 1} / ${batches.length} · %${pct}`,
          });
        });
      }

      setUploadBar({
        percent: 100,
        label: batches.length ? `Tamam · ${batches.length} parti` : "Tamam",
      });

      setUploadQueue([]);
      await loadFiles(currentPath);
      toast.success(`${fileArr.length} dosya yüklendi`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Yükleme başarısız";
      toast.error(message);
    } finally {
      setUploading(false);
      setUploadBar(null);
    }
  };

  const handleFilePickChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    const arr = list?.length ? Array.from(list) : [];
    e.target.value = "";
    if (arr.length === 0) return;
    addIncomingToQueue(arr);
  };

  const handleFolderPickChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    const arr = list?.length ? Array.from(list) : [];
    e.target.value = "";
    if (arr.length === 0) return;
    addIncomingToQueue(arr);
  };

  const onDragOverUpload = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDragEnterUpload = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!uploading) setDropActive(true);
    },
    [uploading]
  );

  const onDragLeaveUpload = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const related = e.relatedTarget as Node | null;
    if (!e.currentTarget.contains(related)) {
      setDropActive(false);
    }
  }, []);

  const onDropUpload = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropActive(false);
    if (uploading) return;

    try {
      const collected = await collectFilesFromDataTransfer(e.dataTransfer);
      if (collected.length === 0) {
        toast.error("Yüklenecek dosya bulunamadı");
        return;
      }
      addIncomingToQueue(collected);
    } catch {
      toast.error("Sürüklenen öğeler okunamadı");
    }
  };

  const openMoveModal = (item: FileItem) => {
    setMoveItem(item);
    setMoveDestFolder(parentFolderPath(item.path));
    setMoveNewName(item.name);
  };

  const handleMoveSubmit = async () => {
    if (!moveItem) return;
    const dest = moveDestFolder.trim().replace(/^\/+|\/+$/g, "");
    const nameTrim = moveNewName.trim();
    if (!nameTrim) {
      toast.error("Ad boş olamaz");
      return;
    }

    try {
      setMoving(true);
      await apiPost(`/api/files/move`, {
        sourcePath: moveItem.path,
        destinationFolder: dest,
        newName: nameTrim !== moveItem.name ? nameTrim : undefined,
      });
      setMoveItem(null);
      await loadFiles(currentPath);
      toast.success("Taşındı");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Taşıma başarısız";
      toast.error(message);
    } finally {
      setMoving(false);
    }
  };

  const handleDownload = async (item: FileItem) => {
    try {
      await apiDownloadFile(item.path);
      toast.success("İndirme başladı");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "İndirilemedi";
      toast.error(message);
    }
  };

  const handleDownloadFolderZip = async (item: FileItem) => {
    if (item.type !== "directory") return;
    try {
      setDownloadingZip(item.path);
      await apiDownloadFolderZip(item.path);
      toast.success("ZIP indirme başladı");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Klasör indirilemedi";
      toast.error(message);
    } finally {
      setDownloadingZip(null);
    }
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return "-";
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("tr-TR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getFileIcon = (item: FileItem) => {
    if (item.type === "directory") {
      return <FolderIcon className="h-6 w-6 text-yellow-500" />;
    }
    return <FileIcon className="h-6 w-6 text-gray-500" />;
  };

  const isImageFile = (fileName: string): boolean => {
    const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico"];
    const lowerFileName = fileName.toLowerCase();
    return imageExtensions.some((ext) => lowerFileName.endsWith(ext));
  };

  const handleViewImage = (item: FileItem) => {
    const imageUrl = `${API_URL}/uploads/${item.path}`;
    window.open(imageUrl, "_blank");
  };

  return (
    <div
      className={`rounded-2xl border bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6 ${dropActive && !uploading ? "border-brand-500 ring-2 ring-brand-500/35" : "border-gray-200"}`}
      onDragOver={onDragOverUpload}
      onDragEnter={onDragEnterUpload}
      onDragLeave={onDragLeaveUpload}
      onDrop={onDropUpload}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
        className="hidden"
        onChange={handleFilePickChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
        accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
        className="hidden"
        onChange={handleFolderPickChange}
      />

      {/* Toolbar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {!atRoot && (
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <ChevronLeftIcon className="h-4 w-4" />
              Geri
            </button>
          )}
          <button
            type="button"
            onClick={() => loadFiles(currentPath)}
            disabled={uploading}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Yenile
          </button>
          <button
            type="button"
            onClick={handleUploadClick}
            disabled={uploading}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            title="Seçilenleri kuyruğa ekler; yüklemek için alttaki „Kuyruğu yükle”"
          >
            Dosya ekle (kuyruğa)
          </button>
          <button
            type="button"
            onClick={handleFolderUploadClick}
            disabled={uploading}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            title="Her tıklamada bir klasör ağacı — birden çok kez ekleyebilirsiniz"
          >
            Klasör ekle (kuyruğa)
          </button>
        </div>
        <button
          type="button"
          onClick={() => setShowNewFolderModal(true)}
          disabled={uploading}
          className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-gray-200"
        >
          <PlusIcon className="h-4 w-4" />
          Yeni klasör
        </button>
      </div>

      {/* Path Display */}
      <div className="mb-4 rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium">Yol:</span> /uploads
          {currentPath ? `/${currentPath.replace(/^\/+/, "")}` : ""}
        </p>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
          Birden fazla klasör: &quot;Klasör ekle&quot; ile tekrar tekrar ekleyin veya masaüstünden birden fazla klasörü buraya sürükleyin. Yüklemeden önce kuyruğu kontrol edin.
        </p>
      </div>

      {uploading && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/50">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
              {uploadBar?.label ?? "Yükleniyor…"}
            </span>
            <span className="text-xs tabular-nums text-gray-600 dark:text-gray-400">
              {uploadBar?.percent ?? 0}%
            </span>
          </div>
          <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
            role="progressbar"
            aria-valuenow={uploadBar?.percent ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-black transition-[width] duration-150 ease-out dark:bg-white"
              style={{ width: `${Math.min(100, uploadBar?.percent ?? 0)}%` }}
            />
          </div>
        </div>
      )}

      {uploadQueue.length > 0 && !uploading && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-4 dark:border-amber-900/40 dark:bg-amber-950/35 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-amber-950 dark:text-amber-100">
            <p className="font-semibold">
              Yükleme kuyruğu: {uploadQueue.length.toLocaleString("tr-TR")} dosya
              {queueRootFolderCount > 0 && (
                <span className="font-normal text-amber-800/90 dark:text-amber-200/90">
                  {" "}
                  · {queueRootFolderCount.toLocaleString("tr-TR")} üst klasör ağacından
                </span>
              )}
            </p>
            <p className="mt-1 text-xs text-amber-900/85 dark:text-amber-200/80">
              Mevcut hedef klasöre yüklenecek. Kuyruk boşalana kadar tekrar dosya veya klasör ekleyebilirsiniz.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={executeUploadQueue}
              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 dark:bg-white dark:text-black dark:hover:bg-gray-200"
            >
              Kuyruğu yükle
            </button>
            <button
              type="button"
              onClick={clearUploadQueue}
              className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/60"
            >
              Kuyruğu temizle
            </button>
          </div>
        </div>
      )}

      {!loading && selectedCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/90 px-4 py-3 dark:border-blue-900/40 dark:bg-blue-950/40">
          <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
            {selectedCount} seçili
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-900 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900/50 dark:text-blue-100 dark:hover:bg-blue-900"
            >
              {allSelected ? "Seçimi kaldır" : "Bu sayfadakilerin tümünü seç"}
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Seçimi temizle
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {bulkDeleting ? "Siliniyor…" : "Toplu sil"}
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-black dark:border-gray-600 dark:border-t-white"></div>
        </div>
      )}

      {/* File List */}
      {!loading && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className={`${fileTh} w-12 whitespace-nowrap align-middle`}>
                  <label className="flex cursor-pointer items-center justify-start gap-0">
                    <span className="sr-only">Bu klasördeki tüm öğeleri seç</span>
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allSelected && selectablePaths.length > 0}
                      onChange={toggleSelectAll}
                      disabled={selectablePaths.length === 0}
                      className="h-4 w-4 rounded border-gray-300 text-black focus:ring-gray-900 disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:ring-white"
                    />
                  </label>
                </th>
                <SortableTableTh
                  columnKey="name"
                  sort={sort}
                  onSort={requestSort}
                  thClassName={fileTh}
                >
                  Ad
                </SortableTableTh>
                <SortableTableTh
                  columnKey="type"
                  sort={sort}
                  onSort={requestSort}
                  thClassName={fileTh}
                >
                  Tür
                </SortableTableTh>
                <SortableTableTh
                  columnKey="size"
                  sort={sort}
                  onSort={requestSort}
                  thClassName={fileTh}
                >
                  Boyut
                </SortableTableTh>
                <SortableTableTh
                  columnKey="modified"
                  sort={sort}
                  onSort={requestSort}
                  thClassName={fileTh}
                >
                  Değiştirilme
                </SortableTableTh>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortedItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    Klasör boş
                  </td>
                </tr>
              ) : (
                sortedItems.map((item) => (
                  <tr key={item.path} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="w-12 px-4 py-3 align-middle">
                      <label className="flex cursor-pointer items-center">
                        <span className="sr-only">{item.name} seç</span>
                        <input
                          type="checkbox"
                          checked={selectedPaths.has(item.path)}
                          onChange={() => toggleSelectPath(item.path)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded border-gray-300 text-black focus:ring-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:ring-white"
                        />
                      </label>
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className="flex items-center gap-3"
                        onClick={() => handleFolderClick(item)}
                        style={{ cursor: item.type === "directory" ? "pointer" : "default" }}
                        role={item.type === "directory" ? "button" : undefined}
                      >
                        {getFileIcon(item)}
                        <span className="font-medium text-gray-900 dark:text-white">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {item.type === "directory" ? "Klasör" : "Dosya"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {formatFileSize(item.size)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(item.modified)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 sm:gap-2">
                        {item.type === "file" && isImageFile(item.name) && (
                          <button
                            type="button"
                            onClick={() => handleViewImage(item)}
                            className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                            title="Önizle"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </button>
                        )}
                        {item.type === "file" && (
                          <button
                            type="button"
                            onClick={() => handleDownload(item)}
                            className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                            title="İndir"
                          >
                            <DownloadIcon className="h-5 w-5" />
                          </button>
                        )}
                        {item.type === "directory" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadFolderZip(item);
                            }}
                            disabled={downloadingZip === item.path}
                            className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                            title="Klasörü ZIP olarak indir"
                          >
                            <DownloadIcon className="h-5 w-5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openMoveModal(item)}
                          className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                          title="Taşı / yeniden adlandır"
                        >
                          <ArrowRightIcon className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          disabled={deleting === item.path}
                          className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/20"
                          title="Sil"
                        >
                          <TrashBinIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Yeni klasör</h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Klasör adı"
              className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-700 dark:bg-gray-700 dark:text-white"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreateFolder();
                }
              }}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowNewFolderModal(false);
                  setNewFolderName("");
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleCreateFolder}
                className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
              >
                Oluştur
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move / rename modal */}
      {moveItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
            <h3 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">Taşı / yeniden adlandır</h3>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Hedef, <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">uploads</code> altındaki klasör yoludur (ör.{" "}
              <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">urunler/yeni</code>). Boş bırakırsanız kök dizin.
            </p>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Hedef klasör</label>
            <input
              type="text"
              value={moveDestFolder}
              onChange={(e) => setMoveDestFolder(e.target.value)}
              placeholder="ör. alt-klasör veya boş"
              className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-700 dark:bg-gray-700 dark:text-white"
            />
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Ad</label>
            <input
              type="text"
              value={moveNewName}
              onChange={(e) => setMoveNewName(e.target.value)}
              className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-700 dark:bg-gray-700 dark:text-white"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMoveItem(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                İptal
              </button>
              <button
                type="button"
                disabled={moving}
                onClick={handleMoveSubmit}
                className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-gray-200"
              >
                {moving ? "Kaydediliyor…" : "Uygula"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileManager;
