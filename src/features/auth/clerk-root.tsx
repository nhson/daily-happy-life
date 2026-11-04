import { ClerkProvider } from "@clerk/nextjs";
import { viVN } from "@clerk/localizations";
import type { ReactNode } from "react";
import { vi } from "@/copy/vi";

/**
 * Clerk, dressed in the app's sky: glass card, ink colours, our serif title, our words.
 * Sign-in happens before we know the user's language, so it speaks Vietnamese, the default.
 */
const localization = {
  ...viVN,
  signIn: {
    ...viVN.signIn,
    start: { ...viVN.signIn?.start, title: vi.signIn.title, subtitle: vi.signIn.subtitle },
  },
};

const appearance = {
  variables: {
    colorPrimary: "var(--solid)",
    colorPrimaryForeground: "var(--solid-ink)",
    colorForeground: "var(--ink)",
    colorMutedForeground: "var(--ink-2)",
    colorBackground: "transparent",
    colorInput: "var(--fill)",
    colorInputForeground: "var(--ink)",
    colorBorder: "var(--hairline)",
    colorRing: "color-mix(in oklab, var(--kind-objective) 45%, transparent)",
    fontFamily: "var(--font-geist), ui-sans-serif, system-ui, sans-serif",
    borderRadius: "14px",
  },
  elements: {
    cardBox: "glass !rounded-[28px] !shadow-none",
    card: "!bg-transparent !shadow-none",
    headerTitle: "serif !text-[30px] !leading-tight",
    // Owner only: there is no sign-up to offer.
    footerAction: "!hidden",
    socialButtonsBlockButton: "!bg-[var(--fill)] !shadow-[inset_0_0_0_1px_var(--glass-border)]",
    dividerLine: "!bg-[var(--hairline)]",
    footer: "!bg-none !bg-transparent",
  },
};

export function ClerkRoot({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider localization={localization} appearance={appearance}>
      {children}
    </ClerkProvider>
  );
}
