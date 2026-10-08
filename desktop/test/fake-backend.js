// A stand-in for the Spring Boot application, used only by the tests.
const http = require("http");
if (process.env.FAKE_EXIT) {
  console.error("fake backend: cannot connect to the database");
  process.exit(3);
}
const port = Number(process.env.SERVER_PORT);
const server = http.createServer((req, res) => {
  if (req.url === "/api/health") { res.writeHead(200, { "content-type": "application/json" }); return res.end('{"status":"ok"}'); }
  if (req.url === "/env") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ url: process.env.TREASURY_DB_URL, user: process.env.TREASURY_DB_USER, password: process.env.TREASURY_DB_PASSWORD }));
  }
  res.writeHead(404); res.end();
});
setTimeout(() => server.listen(port, "127.0.0.1"), 600);   // pretend to take a moment to start
process.on("SIGTERM", () => server.close(() => process.exit(0)));
