import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

async function startServer() {
  // Initialize SQLite + seed demo data before serving
  const { getDb } = await import("../db");
  await getDb();
  console.log("[SQLite] Database ready at data/bseva.sqlite");

  const app = express();
  // Railway / Render terminate TLS; honor X-Forwarded-Proto for secure cookies
  app.set("trust proxy", 1);
  const server = createServer(app);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Health check for Railway / Render
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "bseva" });
  });

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Cloud hosts (Railway/Render) require the exact PORT and 0.0.0.0
  const port = parseInt(process.env.PORT || "3000", 10);
  const host = process.env.HOST || "0.0.0.0";

  server.listen(port, host, () => {
    console.log(`Server running on http://${host}:${port}/`);
    console.log(
      "Demo logins: admin@bseva.com | customer@bseva.com | pujari@bseva.com  (password: password123)"
    );
  });
}

startServer().catch(console.error);
