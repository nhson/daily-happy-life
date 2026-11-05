"use client";

import { clsx } from "clsx";
import { Mountain, ListChecks, Sun } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { APP_NAME } from "@/config";
import { useCopy, useLocale } from "@/copy";
import type { LiveData } from "@/data/live";
import { StoreProvider, useStore } from "@/data/store";
import { CaptureButton, CaptureProvider } from "@/features/capture/capture";
import { TaskSheetProvider } from "@/features/tasks/task-sheet";
import { ClockProvider } from "@/ui/clock";
import { AppMark } from "@/ui/glyphs";
import { SkyProvider } from "@/ui/sky";
import { ToastProvider, useToast } from "@/ui/toast";

const subscribe = () => () => {};

/**
 * Renders client-only: the store and clock live in the browser (`live` is the signed-in user's
 * data from the server; null in signed-out design review). The sky is already correct before
 * this mounts (inline script in the root layout).
 */
export function AppShell({ live, children }: { live: LiveData | null; children: ReactNode }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  if (!mounted) return <ShellPlaceholder />;
  return (
    <ClockProvider>
      <StoreProvider live={live}>
        <Themed>
          <ToastProvider>
            <SyncNotice />
            <CaptureProvider>
              <TaskSheetProvider>
                <Frame>{children}</Frame>
              </TaskSheetProvider>
            </CaptureProvider>
          </ToastProvider>
        </Themed>
      </StoreProvider>
    </ClockProvider>
  );
}

function Themed({ children }: { children: ReactNode }) {
  const { state, mode } = useStore();
  const locale = useLocale();
  // The root layout renders lang="vi"; keep it true when the user switches language.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <SkyProvider theme={state.settings.theme} settled={mode === "night"}>
      {children}
    </SkyProvider>
  );
}

/** A save the server refused is quietly reported; the store has already reloaded. */
function SyncNotice() {
  const { syncFailures } = useStore();
  const toast = useToast();
  const copy = useCopy();
  useEffect(() => {
    if (syncFailures) toast(copy.common.notSaved);
  }, [syncFailures, toast, copy]);
  return null;
}

const TABS = [
  { href: "/today", tab: "today", Icon: Sun },
  { href: "/tasks", tab: "tasks", Icon: ListChecks },
  { href: "/life", tab: "life", Icon: Mountain },
] as const;

function Frame({ children }: { children: ReactNode }) {
  const copy = useCopy();
  const pathname = usePathname();
  const router = useRouter();
  const { state } = useStore();
  const bare = pathname.startsWith("/welcome");

  useEffect(() => {
    if (!state.onboarded && !bare) router.replace(`/welcome${window.location.search}`);
  }, [state.onboarded, bare, router]);

  if (bare) return <>{children}</>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="min-h-dvh">
      {/* Desktop header */}
      <header data-chrome className="sticky top-0 z-30 hidden items-center justify-between px-8 py-5 lg:flex">
        <Link href="/today" className="flex items-center gap-2.5 text-ink">
          <AppMark size={26} />
          <span className="serif text-xl">{APP_NAME}</span>
        </Link>
        <nav className="glass flex rounded-full p-1" aria-label={copy.common.mainNav}>
          {TABS.map((t) => (
            <TabLink key={t.href} href={t.href} Icon={t.Icon} label={copy.tabs[t.tab]} active={pathname.startsWith(t.href)} layoutId="tab-desktop" desktop />
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-ink-3 xl:inline">⌘K to capture</span>
          <Link href="/settings" aria-label={copy.settings.title} className="glass grid size-10 place-items-center rounded-full text-sm font-medium">
            S
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-36 pt-[max(env(safe-area-inset-top),12px)] sm:px-6 lg:px-8 lg:pb-16 lg:pt-0">
        {/* Keyed by tab, so each arriving page fades in once; within a tab nothing re-animates. */}
        <div key={pathname.split("/")[1]} className="page-enter">
          {children}
        </div>
      </main>

      {/* Phone tab bar + capture */}
      <div data-chrome className="fixed inset-x-0 bottom-0 z-30 flex items-end justify-center gap-3 px-4 pb-[max(env(safe-area-inset-bottom),14px)] lg:hidden">
        <nav className="glass-strong flex flex-1 justify-around rounded-full p-1.5 sm:max-w-sm" aria-label={copy.common.mainNav}>
          {TABS.map((t) => (
            <TabLink key={t.href} href={t.href} Icon={t.Icon} label={copy.tabs[t.tab]} active={pathname.startsWith(t.href)} layoutId="tab-phone" />
          ))}
        </nav>
        <CaptureButton />
      </div>

      {/* Desktop capture */}
      <div data-chrome className="fixed bottom-8 right-8 z-30 hidden lg:block">
        <CaptureButton />
      </div>
    </motion.div>
  );
}

function TabLink({
  href,
  label,
  Icon,
  active,
  layoutId,
  desktop,
}: {
  href: string;
  label: string;
  Icon: typeof Sun;
  active: boolean;
  layoutId: string;
  desktop?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "relative flex items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-colors",
        desktop ? "h-9 px-5" : "h-11 flex-1 flex-col gap-0.5 text-[11px]",
        active ? "text-ink" : "text-ink-3 hover:text-ink-2",
      )}
    >
      {active && (
        <motion.span
          layoutId={layoutId}
          className="absolute inset-0 rounded-full"
          style={{ background: "var(--fill)", boxShadow: "inset 0 0 0 1px var(--hairline)" }}
          transition={{ type: "spring", stiffness: 500, damping: 38 }}
        />
      )}
      <Icon size={desktop ? 16 : 19} strokeWidth={active ? 2.1 : 1.7} className="relative" />
      <span className="relative">{label}</span>
    </Link>
  );
}

/**
 * What shows while the app loads: the same frame (tab bar, capture button, a few quiet rows) with
 * nothing in it, so the real page arrives in place instead of out of an empty sky.
 * Needs no store or copy: it renders before either exists.
 */
export function ShellPlaceholder() {
  return (
    <div aria-hidden className="min-h-dvh animate-pulse [animation-duration:2.4s]">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 pt-28 sm:px-6 lg:pt-40">
        <div className="mb-8 h-24 w-4/5 rounded-3xl bg-[var(--fill)]" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="glass-lite h-14 rounded-2xl opacity-60" />
        ))}
      </div>
      <div className="fixed inset-x-0 bottom-0 flex items-end justify-center gap-3 px-4 pb-[max(env(safe-area-inset-bottom),14px)] lg:hidden">
        <div className="glass-strong h-14 flex-1 rounded-full sm:max-w-sm" />
        <div className="size-14 rounded-full bg-solid opacity-80" />
      </div>
    </div>
  );
}
