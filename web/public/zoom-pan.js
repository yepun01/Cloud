// Simple zoom + pan via CSS transform on the canvas element.
// Wheel = zoom in/out around cursor (1x to 4x). Drag with shift = pan.

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const DRAG_THRESHOLD = 5; // px

export function attachZoomPan(canvasElement, container) {
  const state = { zoom: 1, panX: 0, panY: 0, dragging: false, startX: 0, startY: 0, moved: 0 };

  const apply = () => {
    canvasElement.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
    canvasElement.style.transformOrigin = "0 0";
  };

  container.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.2 : 1 / 1.2;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, state.zoom * delta));
    if (newZoom === state.zoom) return;

    // Zoom around cursor: keep the point under the cursor stationary.
    const rect = canvasElement.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    state.panX -= (cx / state.zoom) * (newZoom - state.zoom);
    state.panY -= (cy / state.zoom) * (newZoom - state.zoom);
    state.zoom = newZoom;

    if (state.zoom === MIN_ZOOM) {
      state.panX = 0;
      state.panY = 0;
    }
    apply();
  }, { passive: false });

  // Pan with shift+drag (so plain click stays "place pixel").
  canvasElement.addEventListener("mousedown", (e) => {
    if (!e.shiftKey) return;
    state.dragging = true;
    state.startX = e.clientX - state.panX;
    state.startY = e.clientY - state.panY;
    state.moved = 0;
    canvasElement.style.cursor = "grabbing";
  });

  window.addEventListener("mousemove", (e) => {
    if (!state.dragging) return;
    const newX = e.clientX - state.startX;
    const newY = e.clientY - state.startY;
    state.moved += Math.abs(newX - state.panX) + Math.abs(newY - state.panY);
    state.panX = newX;
    state.panY = newY;
    apply();
  });

  window.addEventListener("mouseup", () => {
    if (!state.dragging) return;
    state.dragging = false;
    canvasElement.style.cursor = "crosshair";
  });

  return {
    isPanning: () => state.dragging,
    movedSignificantly: () => state.moved > DRAG_THRESHOLD,
    reset: () => {
      state.zoom = 1;
      state.panX = 0;
      state.panY = 0;
      apply();
    },
  };
}
