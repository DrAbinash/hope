import { Router, type Request, type Response, type NextFunction } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { employeesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

declare module "express-session" {
  interface SessionData {
    landingPath?: string;
  }
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again in 15 minutes." },
});

router.post("/auth/login", loginLimiter, async (req, res) => {
  try {
    const { username, pin } = req.body;
    if (!username) {
      res.status(400).json({ error: "Username required" });
      return;
    }

    const [user] = await db.select().from(employeesTable).where(eq(employeesTable.username, username));
    if (!user || !user.isActive) {
      // Constant-time delay even on not-found to prevent user enumeration
      await new Promise((r) => setTimeout(r, 300));
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // PIN verification.
    // If the account has a pinHash set, the provided PIN must match.
    // If pinHash is null (account not yet secured), login is allowed but a
    // warning is emitted. Admins should set PINs for all accounts via the
    // Employee settings page.
    if (user.pinHash) {
      if (!pin) {
        res.status(401).json({ error: "PIN required" });
        return;
      }
      const pinOk = await bcrypt.compare(String(pin), user.pinHash);
      if (!pinOk) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }
    } else {
      req.log.warn({ userId: user.id, username: user.username }, "Login without PIN — account has no PIN set");
    }

    req.session.userId = user.id;
    req.session.username = user.username || undefined;
    req.session.role = user.role;
    req.session.name = user.name;
    req.session.entityId = user.entityId;
    req.session.landingPath = user.landingPath || undefined;

    res.json({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      entityId: user.entityId,
      department: user.department,
      designation: user.designation,
      landingPath: user.landingPath,
    });
  } catch (err) {
    req.log.error({ err }, "Login failed");
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: "Logout failed" });
      return;
    }
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

router.get("/auth/me", (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json({
    id: req.session.userId,
    username: req.session.username,
    name: req.session.name,
    role: req.session.role,
    entityId: req.session.entityId,
    landingPath: req.session.landingPath,
  });
});

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session.userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (!roles.includes(req.session.role || "")) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

export default router;
