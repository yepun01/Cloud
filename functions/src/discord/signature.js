const nacl = require("tweetnacl");

// Verifies a Discord interaction request signature (ed25519).
// rawBody: Buffer or string of the request body.
// signature: hex string from x-signature-ed25519 header.
// timestamp: string from x-signature-timestamp header.
// publicKey: hex string of the application's public key.
function verifySignature(rawBody, signature, timestamp, publicKey) {
  if (!rawBody || !signature || !timestamp || !publicKey) return false;
  try {
    const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody);
    const message = Buffer.from(timestamp + bodyStr, "utf8");
    const sigBytes = Buffer.from(signature, "hex");
    const keyBytes = Buffer.from(publicKey, "hex");
    if (sigBytes.length !== 64 || keyBytes.length !== 32) return false;
    return nacl.sign.detached.verify(message, sigBytes, keyBytes);
  } catch (err) {
    console.warn("verifySignature error:", err && err.message);
    return false;
  }
}

module.exports = { verifySignature };
