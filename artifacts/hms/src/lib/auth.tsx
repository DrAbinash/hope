import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ALL_MODULE_KEYS } from "./permissions-catalog";

export interface AuthUser {
  id: number;
  username: string;
  name: string;
  role: string;
  entityId: number | null;
  landingPath?: string | null;
  allowedModules?: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchEffective(): Promise<string[]> {
  try {
    const r = await fetch("/api/permissions/me", { credentials: "include" });
    if (!r.ok) return [];
    const j = await r.json();
    return j.allowedModules || [];
  } catch {
    return [];
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrate = async (u: AuthUser | null) => {
    if (!u) {
      setUser(null);
      return;
    }
    const allowedModules = await fetchEffective();
    setUser({ ...u, allowedModules });
  };

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => hydrate(u))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Login failed");
    const u = await r.json();
    await hydrate(u);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
  };

  const refreshPermissions = async () => {
    if (!user) return;
    const allowedModules = await fetchEffective();
    setUser({ ...user, allowedModules });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshPermissions }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

export const ROLE_DEFAULT_LANDING: Record<string, string> = {
  admin: "/",
  doctor: "/doctor",
  nurse: "/ipd",
  receptionist: "/patients",
  cashier: "/billing",
  pharmacist: "/pharmacy",
  lab_tech: "/diagnostics",
  radiology_tech: "/diagnostics",
  house_keeping: "/",
};

export function getLandingPath(user: AuthUser | null | undefined) {
  const override = user?.landingPath?.trim();
  if (override) return override;
  return ROLE_DEFAULT_LANDING[user?.role || ""] || "/";
}

/**
 * canAccess(user, path)
 * - Admins always allowed.
 * - Otherwise resolve the most specific module key matching the path
 *   from the catalog and check if the user has it allowed.
 * - Paths not covered by any module are allowed (no guard).
 */
export function canAccess(userOrRole: AuthUser | string | null | undefined, path: string): boolean {
  const user = typeof userOrRole === "string" || !userOrRole ? null : (userOrRole as AuthUser);
  const role = typeof userOrRole === "string" ? userOrRole : userOrRole?.role;
  if (!role) return false;
  if (role === "admin") return true;

  const matching = ALL_MODULE_KEYS.filter(
    (k) => path === k || (k !== "/" && path.startsWith(k + "/")) || (k !== "/" && path === k),
  );
  if (matching.length === 0) return true;
  matching.sort((a, b) => b.length - a.length);
  const best = matching[0];

  const allowed = user?.allowedModules;
  if (!allowed) return false;
  return allowed.includes(best);
}
