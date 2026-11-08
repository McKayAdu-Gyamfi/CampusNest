// The sample 360° tour (Pannellum config) shown when a room has no tour of its own.
// Shared by the live preview page and the booking page's room view.
export const DEMO_TOUR_CONFIG = {
    default: {
      firstScene: "main_room",
      sceneFadeDuration: 1000,
      autoLoad: true,
      doubleClickZoom: false,
      showZoomCtrl: false,
      showFullscreenCtrl: false
    },
    scenes: {
      main_room: {
        type: "equirectangular",
        panorama: "https://ardent-lobster-343.eu-west-1.convex.cloud/api/storage/daa32b7c-8365-452d-a7d5-b8e04570f5d3",
        hotSpots: [
          {
            pitch: -5,
            yaw: 170,
            type: "scene",
            text: "Go to Bathroom",
            sceneId: "bathroom_1"
          }
        ]
      },
      bathroom_1: {
        type: "equirectangular",
        panorama: "https://ardent-lobster-343.eu-west-1.convex.cloud/api/storage/14b05d63-7718-45ae-90ec-d286e1d3139d",
        hotSpots: [
          {
            pitch: -5,
            yaw: -90,
            type: "scene",
            text: "Back to Main Room",
            sceneId: "main_room"
          },
          {
            pitch: -5,
            yaw: 90,
            type: "scene",
            text: "Go to bathroom_2",
            sceneId: "bathroom_2"
          }
        ]
      },
      bathroom_2: {
        type: "equirectangular",
        panorama: "https://ardent-lobster-343.eu-west-1.convex.cloud/api/storage/0d061f94-4b5b-497d-86cf-76b4d22aebb1",
        hotSpots: [
          {
            pitch: -5,
            yaw: -120,
            type: "scene",
            text: "Back to Main Room",
            sceneId: "main_room",
          },
          {
            pitch: -5,
            yaw: -90,
            type: "scene",
            text: "Back to bathroom_1",
            sceneId: "bathroom_1"
          }
        ]
      }
    }
  };
