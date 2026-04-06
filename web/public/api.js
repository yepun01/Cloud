import { API } from "./firebase-config.js";

export async function placePixel({ userId, x, y, color }) {
  const res = await fetch(API.placePixel, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, x, y, color }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export async function getCanvas() {
  const res = await fetch(API.getCanvas);
  if (!res.ok) throw new Error(`getCanvas failed: ${res.status}`);
  return res.json();
}
