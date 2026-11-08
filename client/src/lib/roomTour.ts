// Turns a room's saved tour scenes into one Pannellum config the viewer
// (public/tour.html, via postMessage) can show: a multi-scene tour with a
// "next room view" arrow on each scene.
export interface SceneRef { scene_name: string; scene_config_url: string }

/** Fetches every scene's config. A scene that can't be loaded is skipped rather than breaking the tour. */
export async function buildTourConfig(scenes: SceneRef[]): Promise<Record<string, unknown> | null> {
  const loaded = (
    await Promise.all(
      scenes.map(async (s) => {
        try {
          const res = await fetch(s.scene_config_url);
          if (!res.ok) return null;
          return { name: s.scene_name, config: (await res.json()) as Record<string, unknown> };
        } catch {
          return null;
        }
      }),
    )
  ).filter((x): x is { name: string; config: Record<string, unknown> } => x !== null);

  if (loaded.length === 0) return null;

  const ids = loaded.map((_, i) => `scene_${i}`);
  const sceneMap: Record<string, unknown> = {};
  loaded.forEach(({ name, config }, i) => {
    const own = Array.isArray(config.hotSpots) ? (config.hotSpots as unknown[]) : [];
    const next = loaded.length > 1
      ? [{ pitch: 0, yaw: 0, type: "scene", text: `Next: ${loaded[(i + 1) % loaded.length].name}`, sceneId: ids[(i + 1) % loaded.length] }]
      : [];
    sceneMap[ids[i]] = { ...config, title: name, hotSpots: [...own, ...next] };
  });

  return {
    default: { firstScene: ids[0], sceneFadeDuration: 1000, autoLoad: true, doubleClickZoom: false, showZoomCtrl: false, showFullscreenCtrl: false },
    scenes: sceneMap,
  };
}

export const PANORAMA_MAX_BYTES = 20 * 1024 * 1024;

/** Checks a panorama is a JPEG/PNG under 20 MB and equirectangular (2:1). Returns an error message, a warning, or nothing. */
export async function checkPanorama(file: File): Promise<{ error?: string; warning?: string; width?: number; height?: number }> {
  if (!["image/jpeg", "image/png"].includes(file.type)) return { error: "Use a JPEG or PNG panorama." };
  if (file.size > PANORAMA_MAX_BYTES) return { error: `That file is ${(file.size / 1048576).toFixed(1)} MB. The limit is 20 MB.` };
  const dims = await new Promise<{ w: number; h: number } | null>((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve(null); URL.revokeObjectURL(url); };
    img.src = url;
  });
  if (!dims) return { error: "That file couldn't be read as an image." };
  const ratio = dims.w / dims.h;
  if (Math.abs(ratio - 2) > 0.04) return { error: `A 360° panorama must be 2:1 (twice as wide as tall). This one is ${dims.w}×${dims.h}.` };
  return {
    width: dims.w, height: dims.h,
    warning: dims.w < 4096 ? `${dims.w}×${dims.h} will look soft when zoomed in. 4096×2048 or larger is recommended.` : undefined,
  };
}
