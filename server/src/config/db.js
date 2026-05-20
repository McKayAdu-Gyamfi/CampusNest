import { ConvexHttpClient } from "convex/browser";
import "dotenv/config";

// Create a single Convex client for interacting with your database
export const convex = new ConvexHttpClient(process.env.CONVEX_URL);
