import session from "express-session";
import connectPgSimple from "connect-pg-simple";

const PgStore = connectPgSimple(session);

export const sessionMiddleware = session({
  store: new PgStore({
    conString: process.env.DATABASE_URL,
    tableName: "user_sessions",
    createTableIfMissing: false,
  }),
  secret: process.env.SESSION_SECRET || "dev-secret-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    // INSECURE_COOKIES=1 is for LAN/intranet HTTP deployments (e.g. Windows local server) where TLS isn't available.
    secure: process.env.INSECURE_COOKIES === "1" ? false : process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 12, // 12 hours
  },
});

declare module "express-session" {
  interface SessionData {
    userId?: number;
    username?: string;
    role?: string;
    name?: string;
    entityId?: number | null;
  }
}
