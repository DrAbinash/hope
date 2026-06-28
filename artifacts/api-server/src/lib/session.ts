import session from "express-session";
import connectPgSimple from "connect-pg-simple";

const PgStore = connectPgSimple(session);

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  // Fail fast at startup — a missing secret means all sessions are forgeable.
  // Set SESSION_SECRET in your .env file (minimum 32 random characters).
  throw new Error(
    "FATAL: SESSION_SECRET environment variable is not set. " +
    "Set it in your .env file before starting the server."
  );
}

export const sessionMiddleware = session({
  store: new PgStore({
    conString: process.env.DATABASE_URL,
    tableName: "user_sessions",
    createTableIfMissing: false,
  }),
  secret: SESSION_SECRET,
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
