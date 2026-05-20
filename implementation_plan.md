# Room Tour Implementation Plan (Pannellum)

## Goal
To implement a 360° virtual room tour using Pannellum, featuring two linked scenes: the **Main Room** and the **Bathroom**.

## Proposed Approach

### 1. The Pannellum JSON Configuration
Pannellum requires a JSON configuration object to define a multi-scene tour. We will create a `tour_config.json` file structured as follows:
- **`default`**: Defines the initial scene (`main_room`) and global settings like auto-load and fade duration.
- **`scenes.main_room`**: The primary equirectangular panorama.
  - Contains a hotspot linking to the `bathroom`.
  - Can optionally contain info hotspots (e.g., "Study Desk").
- **`scenes.bathroom`**: The secondary equirectangular panorama.
  - Contains a hotspot linking back to the `main_room`.

### 2. Asset Hosting via Convex Storage
Since Pannellum needs absolute URLs for the panoramic images, we need to:
1. Upload the two 360° JPEG images (Main Room & Bathroom) to your Convex Storage.
2. Get their public URLs.
3. Inject these URLs into the `tour_config.json`.

### 3. Storing the Config
We have two options for how the frontend consumes this data:
- **Option A (Static Config File)**: We upload the `tour_config.json` itself to Convex Storage, get its URL, and save it in the database under `rooms.room_tour_scenes`. The frontend will pass this JSON URL to Pannellum: `pannellum.viewer('viewer', { "config": "<JSON_URL>" })`.
- **Option B (Database JSON)**: Instead of a JSON file in storage, we can store the JSON object directly inside the `rooms` table in Convex. The frontend queries the room, gets the JSON object, and passes it directly to Pannellum. 

*Given your current schema `scene_config_url: v.string()`, Option A is the intended path.*

### 4. Integration Steps
1. Create the template `tour_config.json`.
2. Wait for you to provide/upload the 360° images for the room and bathroom.
3. Update the JSON template with the actual Convex storage URLs of those images.
4. Upload the final `tour_config.json` to Convex Storage.
5. Create a `rooms:createTourScene` mutation from the client, passing the JSON's URL to save it to the database.

## Open Questions

1. Do you already have the 360° images (equirectangular panoramas) ready to be uploaded to Convex Storage?
2. Do you want to manually tweak the `pitch` and `yaw` coordinates for the hotspots on the frontend, or should I just provide a template with estimated coordinates for now?
