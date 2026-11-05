"use client";

import { ArrowLeft, Download, Lightbulb, MonitorDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LOCALE_NAME, LOCALES, useCopy } from "@/copy";
import { useStore } from "@/data/store";
import { Button, Chip } from "@/ui/controls";
import { useToast } from "@/ui/toast";
import { useInstall, usePush } from "@/features/pwa/pwa";

const hours = Array.from({ length: 24 }, (_, h) => h);
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

export function SettingsView() {
  const copy = useCopy();
  const { state, actions, isLive } = useStore();
  const toast = useToast();
  const s = state.settings;
  const zones = Intl.supportedValuesOf?.("timeZone") ?? [s.timeZone];

  const exportAll = () => {
    // Signed in, the server sends every table (the screen holds only recent days).
    if (isLive) {
      const a = document.createElement("a");
      a.href = "/api/export";
      a.click();
      return;
    }
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...state }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `daily-happy-life-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 pt-4 lg:pt-8">
      <Link href="/today" className="flex h-10 w-fit items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft size={16} /> {copy.tabs.today}
      </Link>
      <h1 className="serif text-[44px] leading-none">{copy.settings.title}</h1>

      <div id="reminder" className="glass flex scroll-mt-24 flex-col divide-y divide-[color:var(--hairline)] rounded-[28px]">
        <Row label={copy.settings.reminder} hint={copy.settings.reminderHint}>
          <input type="time" value={s.reminderTime} onChange={(e) => actions.updateSettings({ reminderTime: e.target.value })} className="tabular rounded-xl bg-fill px-3 py-2 font-mono text-sm text-ink outline-none" />
        </Row>
        <PushRow />
        <Row label={copy.settings.timeZone}>
          <select value={s.timeZone} onChange={(e) => actions.updateSettings({ timeZone: e.target.value })} className="max-w-48 rounded-xl bg-fill px-3 py-2 text-sm text-ink outline-none">
            {zones.map((z) => (
              <option key={z}>{z}</option>
            ))}
          </select>
        </Row>
        <Row label={copy.settings.evening}>
          <HourSelect value={s.eveningHour} onChange={(eveningHour) => actions.updateSettings({ eveningHour })} />
        </Row>
        <Row label={copy.settings.dayEnds} hint={copy.settings.dayEndsHint}>
          <HourSelect value={s.dayEndHour} options={[0, 1, 2, 3, 4, 5, 6]} onChange={(dayEndHour) => actions.updateSettings({ dayEndHour })} />
        </Row>
        <Row label={copy.settings.sound}>
          <input type="checkbox" checked={s.sound} onChange={(e) => actions.updateSettings({ sound: e.target.checked })} className="size-5 accent-[var(--kind-objective)]" />
        </Row>
      </div>

      <InstallRow />

      <section>
        <p className="eyebrow mb-3">{copy.settings.language}</p>
        <div className="flex flex-wrap gap-2">
          {LOCALES.map((l) => (
            <Chip key={l} selected={s.locale === l} onClick={() => actions.updateSettings({ locale: l })}>
              <span lang={l}>{LOCALE_NAME[l]}</span>
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <p className="eyebrow mb-3">{copy.settings.theme}</p>
        <div className="flex flex-wrap gap-2">
          {(["sky", "light", "dark"] as const).map((t) => (
            <Chip key={t} selected={s.theme === t} onClick={() => actions.updateSettings({ theme: t })}>
              {copy.settings.themes[t]}
            </Chip>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="glass" onClick={exportAll}>
          <Download size={16} /> {copy.settings.export}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            actions.showTipsAgain();
            toast(copy.settings.tipsShown);
          }}
        >
          <Lightbulb size={16} /> {copy.settings.showTips}
        </Button>
        {/* Sample data exists only in design review. */}
        {!isLive && (
          <Button variant="ghost" onClick={actions.resetFixtures}>
            {copy.settings.reset}
          </Button>
        )}
      </div>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex min-h-16 items-center justify-between gap-4 px-5 py-3">
      <span>
        <span className="block text-[15px]">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-ink-3">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function HourSelect({ value, onChange, options = hours }: { value: number; onChange: (h: number) => void; options?: number[] }) {
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} className="tabular rounded-xl bg-fill px-3 py-2 font-mono text-sm text-ink outline-none">
      {options.map((h) => (
        <option key={h} value={h}>
          {hh(h)}
        </option>
      ))}
    </select>
  );
}

/** The reminder reaches this device only once it is subscribed here (one device at a time). */
function PushRow() {
  const copy = useCopy();
  const { status, enable, disable } = usePush();
  const [busy, setBusy] = useState(false);
  const hint = status === "unsupported" || status === "unavailable" || status === "denied" ? copy.settings.pushHint[status] : undefined;
  return (
    <Row label={copy.settings.push} hint={hint}>
      <input
        type="checkbox"
        checked={status === "on"}
        disabled={busy || (status !== "on" && status !== "off")}
        onChange={async (e) => {
          setBusy(true);
          try {
            await (e.target.checked ? enable() : disable());
          } finally {
            setBusy(false);
          }
        }}
        className="size-5 accent-[var(--kind-objective)] disabled:opacity-40"
      />
    </Row>
  );
}

function InstallRow() {
  const copy = useCopy();
  const install = useInstall();
  if (!install) return null;
  return (
    <div className="glass flex items-center justify-between gap-4 rounded-[28px] px-5 py-4">
      <span>
        <span className="block text-[15px]">{copy.settings.install}</span>
        <span className="mt-0.5 block text-xs text-ink-3">{copy.settings.installHint}</span>
      </span>
      <Button variant="glass" size="sm" onClick={install}>
        <MonitorDown size={15} /> {copy.settings.install}
      </Button>
    </div>
  );
}
