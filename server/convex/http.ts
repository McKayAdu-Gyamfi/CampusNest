import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// This automatically mounts all /api/auth routes inside the Convex backend
authComponent.registerRoutesLazy(http, createAuth);

export default http;
