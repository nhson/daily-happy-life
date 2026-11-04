import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";
import { APP_NAME } from "@/config";

export default function SignInPage() {
  return (
    <main
      className="grid min-h-dvh place-items-center px-6 py-16"
      // The same sky the app paints (variables set before first paint by the root layout).
      style={{ background: "linear-gradient(180deg, var(--sky-top), var(--sky-mid) 55%, var(--sky-bottom))" }}
    >
      <div className="flex flex-col items-center gap-8">
        <p className="serif text-4xl text-ink">{APP_NAME}</p>
        {/* Reads the URL, so it streams in after the static shell. */}
        <Suspense fallback={<div className="glass h-[420px] w-[min(400px,calc(100vw-48px))] rounded-[22px]" />}>
          {/* Owner only: no sign-up link; Clerk's restricted mode refuses anyone else. */}
          <SignIn withSignUp={false} />
        </Suspense>
      </div>
    </main>
  );
}
