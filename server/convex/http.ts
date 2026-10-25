import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// Serves a tiled panorama's files by the relative path Pannellum asks for.
//
// A multiRes config has basePath "https://<deployment>.convex.site/tour/<id>"
// and path "/%l/%s%y_%x", so the viewer requests e.g.
// /tour/<id>/2/f0_1.jpg. Convex storage cannot answer that itself — its ids
// are opaque — so this looks the path up in tourFiles and streams the blob
// it points at.
//
// Deliberately public and unauthenticated: a tour's tiles are loaded
// directly by the browser's panorama viewer, exactly as they were when they
// sat in a public Supabase Storage bucket. Writing them requires
// PANO_CONVEX_SECRET (see tours.ts); only reading is open.
http.route({
  pathPrefix: "/tour/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    // "/tour/<tourId>/<rest...>" — rest may contain slashes (level dirs)
    const rest = url.pathname.slice("/tour/".length);
    const slash = rest.indexOf("/");
    if (slash <= 0 || slash === rest.length - 1) {
      return new Response("Not found", { status: 404 });
    }

    const tourId = rest.slice(0, slash);
    const path = decodeURIComponent(rest.slice(slash + 1));

    const found = await ctx.runQuery(internal.tours.lookupTourFile, { tourId, path });
    if (!found) {
      return new Response("Not found", { status: 404 });
    }

    const blob = await ctx.storage.get(found.storageId as any);
    if (!blob) {
      // The row outlived the file it pointed at.
      return new Response("Not found", { status: 404 });
    }

    return new Response(blob, {
      status: 200,
      headers: {
        "Content-Type": blob.type || "application/octet-stream",
        // Tiles are immutable once written: a regenerated tour gets a new
        // tour id, so a long cache is safe and keeps the viewer responsive.
        "Cache-Control": "public, max-age=31536000, immutable",
        // The viewer runs on a different origin than .convex.site.
        "Access-Control-Allow-Origin": "*",
      },
    });
  }),
});

export default http;
