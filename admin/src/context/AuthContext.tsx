"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import {
  removeAuthToken,
  setCurrentUser,
  getApiFetchUrl,
  clearAdminClientSession,
  mergeCsrfInit,
} from "@/lib/api";

const AUTO_LOGOUT_INTERVAL = 6 * 60 * 60 * 1000;
const LOGIN_TIME_KEY = "admin_login_time";

interface User {
  id: number;
  username?: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: "admin" | "manager" | "editor" | "viewer";
  is_active: boolean;
  avatar_url?: string | null;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (requiredRole: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const autoLogoutTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleAutoLogout = React.useCallback(() => {
    if (typeof window === "undefined") return;

    clearAdminClientSession();
    localStorage.removeItem(LOGIN_TIME_KEY);
    setUser(null);

    mergeCsrfInit({ method: "POST", credentials: "include" })
      .then((init) => fetch(getApiFetchUrl("/api/admin/auth/logout"), init))
      .catch(() => {});

    if (window.location.pathname && !window.location.pathname.includes("/signin")) {
      window.location.href = "/signin";
    }
  }, []);

  const scheduleAutoLogout = React.useCallback(
    (delay: number) => {
      if (autoLogoutTimerRef.current) {
        clearTimeout(autoLogoutTimerRef.current);
      }
      autoLogoutTimerRef.current = setTimeout(() => {
        handleAutoLogout();
      }, delay);
    },
    [handleAutoLogout]
  );

  const checkAutoLogout = React.useCallback(() => {
    if (typeof window === "undefined") return;

    const loginTimeStr = localStorage.getItem(LOGIN_TIME_KEY);
    if (!loginTimeStr) return;

    const loginTime = parseInt(loginTimeStr, 10);
    const now = Date.now();
    const timeElapsed = now - loginTime;

    if (timeElapsed >= AUTO_LOGOUT_INTERVAL) {
      handleAutoLogout();
    } else {
      const remainingTime = AUTO_LOGOUT_INTERVAL - timeElapsed;
      scheduleAutoLogout(remainingTime);
    }
  }, [handleAutoLogout, scheduleAutoLogout]);

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function bootstrap() {
      try {
        const res = await fetch(getApiFetchUrl("/api/admin/auth/verify"), {
          method: "GET",
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.success || !data.user) {
          clearAdminClientSession();
          localStorage.removeItem(LOGIN_TIME_KEY);
          if (!cancelled) setUser(null);
          return;
        }

        const userData = { ...data.user, username: data.user.email } as User;
        if (!cancelled) {
          setCurrentUser(userData);
          setUser(userData);
          checkAutoLogout();
          intervalId = setInterval(() => checkAutoLogout(), 60000);
        }
      } catch {
        clearAdminClientSession();
        localStorage.removeItem(LOGIN_TIME_KEY);
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
      if (autoLogoutTimerRef.current) clearTimeout(autoLogoutTimerRef.current);
      if (intervalId) clearInterval(intervalId);
    };
  }, [checkAutoLogout]);

  const login = React.useCallback(
    async (usernameOrEmail: string, password: string) => {
      const response = await fetch(
        getApiFetchUrl("/api/admin/auth/login"),
        await mergeCsrfInit({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ usernameOrEmail, password }),
        })
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Giriş başarısız");
      }

      if (data.success && data.user) {
        const userData = { ...data.user, username: data.user.email } as User;
        setCurrentUser(userData);
        setUser(userData);
        if (typeof window !== "undefined") {
          localStorage.setItem(LOGIN_TIME_KEY, Date.now().toString());
        }
        scheduleAutoLogout(AUTO_LOGOUT_INTERVAL);
      } else {
        throw new Error(data.error || data.message || "Giriş başarısız");
      }
    },
    [scheduleAutoLogout]
  );

  const logout = React.useCallback(async () => {
    if (autoLogoutTimerRef.current) {
      clearTimeout(autoLogoutTimerRef.current);
    }
    try {
      await fetch(
        getApiFetchUrl("/api/admin/auth/logout"),
        await mergeCsrfInit({
          method: "POST",
          credentials: "include",
        })
      );
    } catch {
      // ignore
    }
    removeAuthToken();
    if (typeof window !== "undefined") {
      localStorage.removeItem(LOGIN_TIME_KEY);
    }
    setUser(null);
    if (typeof window !== "undefined") {
      window.location.href = "/signin";
    }
  }, []);

  const hasPermission = (requiredRoles: string[]): boolean => {
    if (!user) return false;
    if (user.role === "admin") return true;
    return requiredRoles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
