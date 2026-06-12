import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fork } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_CLIENT = path.join(__dirname, "dist", "client");

const PORT = parseInt(process.env.PORT || "3000", 10);

const MIME_TYPES = {
  ".js": "application/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

const serverModule = await import("./dist/server/server.js");
const handler = serverModule.default;

function collectBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function serveStaticFile(res, filePath) {
  try {
    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath);
    const mime = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, {
      "content-type": mime,
      "cache-control": ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
    });
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (url.pathname === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }));
      return;
    }

    const staticFile = path.join(DIST_CLIENT, url.pathname);
    if (fs.existsSync(staticFile) && fs.statSync(staticFile).isFile()) {
      serveStaticFile(res, staticFile);
      return;
    }

    const body = req.method !== "GET" && req.method !== "HEAD" ? await collectBody(req) : null;

    const request = new Request(url, {
      method: req.method,
      headers: Object.entries(req.headers).reduce((acc, [key, value]) => {
        acc[key] = Array.isArray(value) ? value.join(", ") : value;
        return acc;
      }, {}),
      body: body?.length ? body : null,
    });

    const response = await handler.fetch(request, {}, {});

    const responseHeaders = {};
    response.headers.forEach((value, key) => { responseHeaders[key] = value; });

    res.writeHead(response.status, responseHeaders);
    if (response.body) {
      for await (const chunk of response.body) res.write(chunk);
    }
    res.end();
  } catch (error) {
    console.error("Server error:", error);
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "application/json" });
    }
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
});

server.listen(PORT, () => {
  console.log("");
  console.log("========================================");
  console.log("  Barbearia Status - Frontend");
  console.log(`  Porta: ${PORT}`);
  console.log("========================================");
  console.log("");

  const aiProcess = fork(path.join(__dirname, "ai-server.js"), [], {
    env: { ...process.env, PORT: "3001" },
    stdio: "inherit",
  });

  aiProcess.on("error", (err) => {
    console.error("AI Agent error:", err);
  });

  aiProcess.on("exit", (code) => {
    console.log(`AI Agent exited with code ${code}`);
  });
});
