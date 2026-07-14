"use client";

import { useLayoutEffect, useState } from "react";
import {
  getStorefrontOriginFromAdminSubdomain,
  getStorefrontOriginFromEnv,
} from "@/lib/storefrontUrl";

/**
 * Vitrin kök origin (ürünü sitede aç). Önce env (admin URL ise düzeltilir);
 * yoksa client’ta admin.* host adından türetilir.
 */
export function useStorefrontOrigin(): string {
  const [base, setBase] = useState(getStorefrontOriginFromEnv);

  useLayoutEffect(() => {
    const env = getStorefrontOriginFromEnv();
    if (env) {
      setBase(env);
      return;
    }
    const derived = getStorefrontOriginFromAdminSubdomain();
    if (derived) setBase(derived);
  }, []);

  return base;
}
