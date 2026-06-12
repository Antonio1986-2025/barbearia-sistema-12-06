import http from "node:http";

const PORT = parseInt(process.env.PORT || "3000", 10);

const serverModule = await import("./dist/server/server.js");
const handler = serverModule.default;

function collectBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (url.pathname === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }));
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
});
