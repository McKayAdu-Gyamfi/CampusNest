import express from "express";
import cors from "cors";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";

import { auth } from "../auth.js";
import hostelsRouter from "./modules/hostels/hostels.routes.js";
import roomsRouter from "./modules/rooms/rooms.routes.js";
import bookingsRouter from "./modules/bookings/bookings.routes.js";
import complaintsRouter from "./modules/complaints/complaints.routes.js";
import reviewsRouter from "./modules/reviews/reviews.routes.js";
import usersRouter from "./modules/users/users.routes.js";
import authRouter from "./modules/auth/auth.routes.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";

const app = express();

app.use(helmet());
// CORS_ORIGIN supports a comma-separated allowlist (e.g. for a prod domain
// alongside a staging one). Defaults to the actual Vite dev server port —
// this was previously hardcoded to :3000, which doesn't match the frontend
// (Vite's default :5173) at all, silently breaking cross-origin requests
// with credentials in local dev.
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
// Custom Auth Routes (must be before Better Auth wildcard)
app.use("/api/auth", authRouter);

// Better Auth Route Handler 
app.all(/\/api\/auth.*/, toNodeHandler(auth));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Application Routes
app.use("/api/hostels", hostelsRouter);
app.use("/api/rooms", roomsRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/complaints", complaintsRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/users", usersRouter);

// Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
