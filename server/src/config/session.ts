
import session from "express-session";
import MongoStore from "connect-mongo";
import MemoryStoreFactory from "memorystore";

const MemoryStore = MemoryStoreFactory(session);

const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error(
    "SESSION_SECRET must contain at least 32 characters."
  );
}

let sessionStore: session.Store;

if (process.env.NODE_ENV === "test") {
  sessionStore = new MemoryStore({
    checkPeriod: 86400000,
  });
} else {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error(
      "MONGODB_URI is missing from environment configuration."
    );
  }

  sessionStore = MongoStore.create({
    mongoUrl: mongoUri,
    collectionName: "sessions",
    ttl: 7 * 24 * 60 * 60,
  });
}

const sessionMiddleware = session({
  name: "supplysense.sid",
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
});

export default sessionMiddleware;
