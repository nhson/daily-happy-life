import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/** Owner-only app: everything but the sign-in page needs a session. Sign-up is closed in Clerk (allowlist). */
const isPublic = createRouteMatcher(["/sign-in(.*)"]);

/**
 * Design review (`bun run review`) screenshots the app signed out. Only `next dev` with
 * DHL_REVIEW=1 skips the check; a production build never does.
 */
const reviewing = process.env.NODE_ENV === "development" && process.env.DHL_REVIEW === "1";

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req) && !reviewing) await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
