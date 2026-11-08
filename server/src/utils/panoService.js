// Optional client for the external panorama service (temp-pano-api). When
// PANO_API_URL is set, a panorama is tiled into a multi-resolution Pannellum
// tour (sharper zoom, progressive loading). Without it, the room-tour route
// stores the panorama as one equirectangular image instead.

export const isPanoServiceConfigured = () => !!process.env.PANO_API_URL && !!process.env.PANO_API_KEY;

/**
 * Sends the panorama to the service and returns the URL of the generated
 * Pannellum config. Throws on any failure so the caller can fall back.
 */
export async function generateTiledTour({ roomId, buffer, mimetype, hotspots = [] }) {
  const form = new FormData();
  form.append("room_id", roomId);
  form.append("image", new Blob([buffer], { type: mimetype }), mimetype === "image/png" ? "panorama.png" : "panorama.jpg");
  if (hotspots.length) form.append("hotspots", JSON.stringify(hotspots));

  const res = await fetch(`${process.env.PANO_API_URL.replace(/\/$/, "")}/api/panorama/tour`, {
    method: "POST",
    headers: { "X-Internal-Key": process.env.PANO_API_KEY },
    body: form,
    // Tiling a large panorama is slow; don't hang the admin's request forever.
    signal: AbortSignal.timeout(Number(process.env.PANO_API_TIMEOUT_MS) || 120_000),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.tour_url) {
    throw new Error(`Panorama service failed (HTTP ${res.status}): ${body.detail || body.message || "no tour_url returned"}`);
  }
  return body.tour_url;
}
