import { treaty } from "@elysia/eden";
import type { app } from "./server";

const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const api = treaty<typeof app>(origin).api;
