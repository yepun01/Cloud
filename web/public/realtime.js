import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { db } from "./firebase-init.js";

// Listens to the pixels collection and calls onChange(pixels[]) on every update.
// onChange receives the full set of pixels (not just delta) for simplicity.
export function watchPixels(onChange) {
  const pixelsCol = collection(db, "pixels");
  return onSnapshot(
    pixelsCol,
    (snap) => {
      const pixels = [];
      snap.forEach((doc) => {
        const d = doc.data();
        if (typeof d.x === "number" && typeof d.y === "number" && typeof d.color === "string") {
          pixels.push({ x: d.x, y: d.y, color: d.color });
        }
      });
      onChange(pixels);
    },
    (err) => {
      console.error("Firestore listener error:", err);
    }
  );
}
