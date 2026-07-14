const getApiUrl = () => {
  const url =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.BACKEND_URL ||
    process.env.API_URL;

  const v = (url || '').trim();
  if (!v) {
    throw new Error(
      'Eksik environment degiskeni: NEXT_PUBLIC_BACKEND_URL veya BACKEND_URL. ' +
        "Dokploy/Nixpacks build icin Build Environment Variables'a NEXT_PUBLIC_BACKEND_URL ekleyin (ornek: https://api.example.com)"
    );
  }
  return v;
};

/** Görseller ve mutlak URL gerektiren yerler (img src) */
export const API_URL = getApiUrl();

/**
 * Tarayıcıda API isteği URL’si. Prod: doğrudan backend; dev: Next rewrite (/api-backend).
 * SSR’da tam backend URL kullanılır (çerez genelde yok).
 */
export function getApiFetchUrl(endpoint: string): string {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const isDevBrowser =
    typeof window !== 'undefined' && process.env.NODE_ENV === 'development';
  if (isDevBrowser) {
    return `/api-backend${path}`;
  }
  const base = API_URL.replace(/\/$/, '');
  return `${base}${path}`;
}

const CSRF_MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

let csrfTokenCache: string | null = null;
let csrfInflight: Promise<string> | null = null;

export function clearCsrfTokenCache(): void {
  csrfTokenCache = null;
}

export async function getCsrfToken(): Promise<string> {
  if (typeof window === 'undefined') return '';
  if (csrfTokenCache) return csrfTokenCache;
  if (!csrfInflight) {
    const u = getApiFetchUrl('/api/csrf-token');
    csrfInflight = (async () => {
      const r = await fetch(u, { method: 'GET', credentials: 'include' });
      if (!r.ok) throw new Error(`CSRF token alınamadı (${r.status})`);
      const j = (await r.json()) as { csrfToken?: string };
      const t = j?.csrfToken;
      if (!t || typeof t !== 'string') throw new Error('Geçersiz CSRF yanıtı');
      return t;
    })();
  }
  try {
    const tok = await csrfInflight;
    csrfTokenCache = tok;
    return tok;
  } finally {
    csrfInflight = null;
  }
}

export async function mergeCsrfInit(init: RequestInit = {}): Promise<RequestInit> {
  if (typeof window === 'undefined') return init;
  const method = (init.method || 'GET').toUpperCase();
  if (!CSRF_MUTATING.has(method)) return init;
  const token = await getCsrfToken();
  const headers = new Headers(init.headers as HeadersInit);
  headers.set('X-CSRF-Token', token);
  return { ...init, headers };
}

const readErrorMessage = async (response: Response): Promise<string> => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      const data: any = await response.json();
      return (
        data?.message ||
        data?.error ||
        data?.details?.message ||
        JSON.stringify(data)
      );
    } catch {
      // fallthrough
    }
  }

  try {
    const text = await response.text();
    return text ? text.slice(0, 500) : `${response.status} ${response.statusText}`;
  } catch {
    return `${response.status} ${response.statusText}`;
  }
};

/** Eski admin_token anahtarını ve oturum önbelleğini temizler (JWT artık HttpOnly çerezde) */
export const clearAdminClientSession = (): void => {
  if (typeof window === 'undefined') return;
  clearCsrfTokenCache();
  try {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    sessionStorage.removeItem('admin_user');
  } catch {
    // ignore
  }
};

/** @deprecated JWT artık HttpOnly çerezde; uyumluluk için null */
export const getAuthToken = (): string | null => null;

export const removeAuthToken = clearAdminClientSession;

export const getCurrentUser = (): any | null => {
  if (typeof window === 'undefined') return null;
  const userStr =
    sessionStorage.getItem('admin_user') || localStorage.getItem('admin_user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};

export const setCurrentUser = (user: any): void => {
  if (typeof window === 'undefined') return;
  const s = JSON.stringify(user);
  sessionStorage.setItem('admin_user', s);
  localStorage.setItem('admin_user', s);
};

export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const url = getApiFetchUrl(endpoint.startsWith('/') ? endpoint : `/${endpoint}`);

  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
    ...options,
  };

  const merged = { ...defaultOptions };
  const method = (merged.method || 'GET').toUpperCase();
  const headers = new Headers(merged.headers as HeadersInit);
  if (typeof window !== 'undefined' && CSRF_MUTATING.has(method) && !headers.has('X-CSRF-Token')) {
    headers.set('X-CSRF-Token', await getCsrfToken());
  }

  return fetch(url, { ...merged, headers });
};

export const apiGet = async <T = any>(endpoint: string): Promise<T> => {
  const response = await apiRequest(endpoint, { method: 'GET' });

  if (!response.ok) {
    if (response.status === 401) {
      clearAdminClientSession();
      window.location.href = '/signin';
      throw new Error('Unauthorized');
    }
    const message = await readErrorMessage(response);
    throw new Error(
      `[${response.status}] ${endpoint} - ${message}${
        response.status === 404 ? ` (API_URL: ${API_URL})` : ''
      }`
    );
  }

  return response.json();
};

export const apiPost = async <T = any>(endpoint: string, data?: any): Promise<T> => {
  const response = await apiRequest(endpoint, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearAdminClientSession();
      window.location.href = '/signin';
      throw new Error('Unauthorized');
    }
    const message = await readErrorMessage(response);
    throw new Error(
      `[${response.status}] ${endpoint} - ${message}${
        response.status === 404 ? ` (API_URL: ${API_URL})` : ''
      }`
    );
  }

  return response.json();
};

export const apiPut = async <T = any>(endpoint: string, data?: any): Promise<T> => {
  const response = await apiRequest(endpoint, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearAdminClientSession();
      window.location.href = '/signin';
      throw new Error('Unauthorized');
    }
    const message = await readErrorMessage(response);
    throw new Error(
      `[${response.status}] ${endpoint} - ${message}${
        response.status === 404 ? ` (API_URL: ${API_URL})` : ''
      }`
    );
  }

  return response.json();
};

export const apiPatch = async <T = any>(endpoint: string, data?: any): Promise<T> => {
  const response = await apiRequest(endpoint, {
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearAdminClientSession();
      window.location.href = '/signin';
      throw new Error('Unauthorized');
    }
    const message = await readErrorMessage(response);
    throw new Error(
      `[${response.status}] ${endpoint} - ${message}${
        response.status === 404 ? ` (API_URL: ${API_URL})` : ''
      }`
    );
  }

  return response.json();
};

export const apiDelete = async <T = any>(endpoint: string, data?: any): Promise<T> => {
  const response = await apiRequest(endpoint, {
    method: 'DELETE',
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearAdminClientSession();
      window.location.href = '/signin';
      throw new Error('Unauthorized');
    }
    const message = await readErrorMessage(response);
    throw new Error(
      `[${response.status}] ${endpoint} - ${message}${
        response.status === 404 ? ` (API_URL: ${API_URL})` : ''
      }`
    );
  }

  return response.json();
};

export const apiDeleteBatch = async (paths: string[]): Promise<{
  success: boolean;
  deleted: number;
  failed: { path: string; error: string }[];
  message?: string;
}> => {
  return apiDelete('/api/files/delete-batch', { paths });
};

export const apiUploadFiles = async (
  folder: string,
  files: File[]
): Promise<{ success: boolean; data: { path: string; name: string }[] }> => {
  return apiUploadFilesWithProgress(folder, files);
};

function buildFilesFormData(files: File[]): FormData {
  const formData = new FormData();
  files.forEach((f) => {
    const rp = (f as File & { webkitRelativePath?: string }).webkitRelativePath;
    const multipartName =
      typeof rp === 'string' && rp.trim().length > 0
        ? rp.replace(/\\/g, '/').trim()
        : f.name;
    formData.append('files', f, multipartName);
  });
  return formData;
}

/** XMLHttpRequest ile FormData yükleme; yüzde için upload ilerlemesi bildirilir. */
export async function apiUploadFilesWithProgress(
  folder: string,
  files: File[],
  onProgress?: (ev: { loaded: number; total: number; lengthComputable: boolean }) => void
): Promise<{ success: boolean; data: { path: string; name: string }[] }> {
  const token = typeof window !== 'undefined' ? await getCsrfToken() : '';

  const formData = buildFilesFormData(files);

  const q = folder ? `?folder=${encodeURIComponent(folder)}` : '';
  const url = `${getApiFetchUrl('/api/files/upload')}${q}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open('POST', url);
    xhr.withCredentials = true;
    xhr.setRequestHeader('X-CSRF-Token', token);

    xhr.upload.onprogress = (e) => {
      onProgress?.({
        loaded: e.loaded,
        total: e.total,
        lengthComputable: e.lengthComputable,
      });
    };

    xhr.onerror = () => reject(new Error('Ağ hatası'));

    xhr.onload = () => {
      if (xhr.status === 401) {
        clearAdminClientSession();
        window.location.href = '/signin';
        reject(new Error('Unauthorized'));
        return;
      }

      let message = xhr.responseText.slice(0, 500);

      try {
        const ct = xhr.getResponseHeader('content-type') || '';
        if (ct.includes('application/json')) {
          const parsed = JSON.parse(xhr.responseText) as Record<string, unknown>;
          message =
            (typeof parsed.error === 'string' && parsed.error) ||
            (typeof parsed.message === 'string' && parsed.message) ||
            message;

          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(parsed as { success: boolean; data: { path: string; name: string }[] });
            return;
          }
        } else if (xhr.status >= 200 && xhr.status < 300) {
          reject(new Error('Geçersiz sunucu yanıtı'));
          return;
        }
      } catch {
        //
      }

      reject(
        new Error(
          `[${xhr.status}] /api/files/upload - ${message || xhr.statusText || 'Yükleme başarısız'}${
            xhr.status === 404 ? ` (API_URL: ${API_URL})` : ''
          }`
        )
      );
    };

    xhr.send(formData);
  });
}

export const apiDownloadFile = async (relativePath: string): Promise<void> => {
  const url = `${getApiFetchUrl('/api/files/download')}?path=${encodeURIComponent(relativePath)}`;
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearAdminClientSession();
      window.location.href = '/signin';
      throw new Error('Unauthorized');
    }
    const message = await readErrorMessage(response);
    throw new Error(message);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition');
  let filename = relativePath.split('/').pop() || 'indirilen-dosya';
  if (disposition) {
    const mStar = /filename\*=UTF-8''([^;\n]+)/i.exec(disposition);
    const mQuoted = /filename="([^"]+)"/i.exec(disposition);
    if (mStar) {
      try {
        filename = decodeURIComponent(mStar[1].trim());
      } catch {
        filename = mStar[1].trim();
      }
    } else if (mQuoted) {
      filename = mQuoted[1];
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
};

/** Klasörü ZIP olarak indirir (yetkili admin). */
export const apiDownloadFolderZip = async (relativePath: string): Promise<void> => {
  const url = `${getApiFetchUrl('/api/files/download-zip')}?path=${encodeURIComponent(relativePath)}`;
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearAdminClientSession();
      window.location.href = '/signin';
      throw new Error('Unauthorized');
    }
    const message = await readErrorMessage(response);
    throw new Error(message);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition');
  let filename = `${relativePath.split('/').filter(Boolean).pop() || 'klasor'}.zip`;
  if (disposition) {
    const mStar = /filename\*=UTF-8''([^;\n]+)/i.exec(disposition);
    const mQuoted = /filename="([^"]+)"/i.exec(disposition);
    if (mStar) {
      try {
        filename = decodeURIComponent(mStar[1].trim());
      } catch {
        filename = mStar[1].trim();
      }
    } else if (mQuoted) {
      filename = mQuoted[1];
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
};
