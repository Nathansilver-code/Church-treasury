"use strict";
const net = require("net");

/** Asks the computer for a free port on this machine, so we never clash with another program. */
function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

module.exports = { freePort };
