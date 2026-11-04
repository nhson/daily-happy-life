import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/** One HTTP-based client per server instance (Neon, pooled URL). Every query takes a userId. */
export const db = drizzle({ client: neon(process.env.DATABASE_URL!), schema });
