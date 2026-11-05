"use client";

import { clsx } from "clsx";
import { Check, Search, SlidersHorizontal, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { LOCALE_TAG, useCopy, useLocale, type Copy } from "@/copy";
import { addDays, logicalDate } from "@/domain/logical-day";
import type { Task, TaskKind } from "@/domain/types";
import { useStore } from "@/data/store";
import { KindDot, kindColor } from "@/ui/glyphs";
import { TaskList, useTaskKeys } from "./task-list";

type Tab = "open" | "done";
type Filter = { kind: "all" } | { kind: "objective"; id: string } | { kind: "maintenance" } | { kind: "prototype" };
type Option = { filter: Filter; label: string; dot?: TaskKind };

const sameFilter = (a: Filter, b: Filter) =>
  a.kind === b.kind && (a.kind !== "objective" || (b.kind === "objective" && a.id === b.id));

/** Open tasks and this week’s Done behind a segmented control. Search (with the "why" filter inside) opens on demand. */
export function TasksPanel({ keyboard = false, title = true }: { keyboard?: boolean; title?: boolean }) {
  const copy = useCopy();
  const locale = useLocale();
  const { state, open, activeObjectives, today } = useStore();
  const [tab, setTab] = useState<Tab>("open");
  const [filter, setFilter] = useState<Filter>({ kind: "all" });
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [focusTick, setFocusTick] = useState(0);
  const { timeZone, dayEndHour } = state.settings;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (t: Task) =>
      (!q || t.title.toLowerCase().includes(q)) &&
      (filter.kind === "all" ||
        (filter.kind === "objective" ? t.objectiveId === filter.id : t.kind === filter.kind));
  }, [query, filter]);

  const done = useMemo(
    () =>
      state.tasks
        .filter((t) => t.doneAt && logicalDate(new Date(t.doneAt), timeZone, dayEndHour) >= addDays(today, -6))
        .sort((a, b) => (b.doneAt! > a.doneAt! ? 1 : -1)),
    [state.tasks, timeZone, dayEndHour, today],
  );

  const closeSearch = () => {
    setSearching(false);
    setQuery("");
    setFilter({ kind: "all" });
  };

  // "/" opens search on desktop.
  useEffect(() => {
    if (!keyboard) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || (t && ["INPUT", "TEXTAREA"].includes(t.tagName)) || document.querySelector("dialog[open]")) return;
      e.preventDefault();
      setSearching(true);
      setFocusTick((n) => n + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keyboard]);

  const openGroups = useMemo(() => {
    const g: { key: string; label: string; kind: TaskKind; tasks: Task[] }[] = [];
    for (const o of activeObjectives) g.push({ key: o.id, label: o.title, kind: "objective", tasks: open.filter((t) => t.objectiveId === o.id) });
    for (const p of state.plans.filter((p) => !p.isActive))
      g.push({ key: p.id, label: `${copy.kinds.prototype} · ${p.title || `Plan ${p.slot}`}`, kind: "prototype", tasks: open.filter((t) => t.prototypePlanId === p.id) });
    g.push({ key: "maintenance", label: copy.kinds.maintenance, kind: "maintenance", tasks: open.filter((t) => t.kind === "maintenance") });
    return g.map((x) => ({ ...x, tasks: x.tasks.filter(matches) })).filter((x) => x.tasks.length);
  }, [activeObjectives, state.plans, open, matches, copy]);

  const doneGroups = useMemo(() => {
    const byDay = new Map<string, Task[]>();
    for (const t of done.filter(matches)) {
      const d = logicalDate(new Date(t.doneAt!), timeZone, dayEndHour);
      byDay.set(d, [...(byDay.get(d) ?? []), t]);
    }
    return [...byDay].map(([date, tasks]) => ({ key: date, label: dayLabel(date, today, copy, LOCALE_TAG[locale]), tasks }));
  }, [done, matches, timeZone, dayEndHour, today, copy, locale]);

  const groups = tab === "open" ? openGroups : doneGroups;
  const flat = useMemo(() => groups.flatMap((g) => g.tasks), [groups]);
  const focusedId = useTaskKeys(flat, keyboard);
  const narrowed = query.trim() !== "" || filter.kind !== "all";

  const options: Option[] = [
    { filter: { kind: "all" }, label: copy.tasks.all },
    ...activeObjectives.map((o): Option => ({ filter: { kind: "objective", id: o.id }, label: o.title, dot: "objective" })),
    { filter: { kind: "prototype" }, label: copy.kinds.prototype, dot: "prototype" },
    { filter: { kind: "maintenance" }, label: copy.kinds.maintenance, dot: "maintenance" },
  ];

  return (
    <div className="flex flex-col gap-5">
      {title && <h1 className="serif text-[40px] leading-none">{copy.tasks.title}</h1>}

      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <Segmented
            value={tab}
            onChange={setTab}
            items={[
              { value: "open", label: copy.tasks.open, count: open.length },
              { value: "done", label: copy.tasks.done, count: done.length },
            ]}
          />
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          onClick={() => (searching ? closeSearch() : setSearching(true))}
          aria-label={searching ? copy.tasks.closeSearch : copy.tasks.search}
          aria-expanded={searching}
          className={clsx(
            "grid size-12 shrink-0 place-items-center rounded-full transition-colors duration-200",
            searching ? "bg-solid text-solid-ink shadow-[0_8px_24px_-12px_rgb(0_0_0/0.5)]" : "glass text-ink-2 hover:text-ink",
          )}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={searching ? "x" : "s"}
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {searching ? <X size={18} /> : <Search size={18} />}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </div>

      <AnimatePresence initial={false}>
        {searching && (
          <motion.div
            initial={{ height: 0, opacity: 0, marginTop: -20 }}
            animate={{ height: "auto", opacity: 1, marginTop: 0 }}
            exit={{ height: 0, opacity: 0, marginTop: -20 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-20"
          >
            <SearchBar
              query={query}
              onQuery={setQuery}
              options={options}
              filter={filter}
              onFilter={setFilter}
              focusTick={focusTick}
              onClose={closeSearch}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {groups.length === 0 && (
        <p className="serif py-10 text-center text-2xl text-ink-2">
          {narrowed ? copy.tasks.noMatch : tab === "open" ? copy.tasks.empty : copy.tasks.doneEmpty}
        </p>
      )}

      <AnimatePresence mode="popLayout" initial={false}>
        {groups.map((g) => (
          <motion.section
            key={`${tab}:${g.key}`}
            layout="position"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <h2 className="mb-2.5 flex items-center gap-2 text-sm font-medium text-ink-2">
              {"kind" in g && <KindDot kind={g.kind as TaskKind} />}
              <span className="truncate">{g.label}</span>
              <span className="tabular ml-auto font-mono text-xs text-ink-3">{g.tasks.length}</span>
            </h2>
            <TaskList tasks={g.tasks} showWhy={tab === "done"} focusedId={focusedId} />
          </motion.section>
        ))}
      </AnimatePresence>
    </div>
  );
}

function dayLabel(date: string, today: string, copy: Copy, localeTag: string): string {
  if (date === today) return copy.tasks.today;
  if (date === addDays(today, -1)) return copy.tasks.yesterday;
  return new Intl.DateTimeFormat(localeTag, { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: string; count: number }[];
}) {
  const id = useId();
  const copy = useCopy();
  return (
    <div role="tablist" aria-label={copy.tasks.title} className="glass grid h-12 grid-cols-2 gap-1 rounded-full p-1">
      {items.map((it) => {
        const on = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(it.value)}
            className={clsx("relative flex items-center justify-center gap-2 rounded-full text-[15px] font-medium transition-colors", on ? "text-solid-ink" : "text-ink-2 hover:text-ink")}
          >
            {on && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-full bg-solid shadow-[0_8px_24px_-12px_rgb(0_0_0/0.5)]"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative">{it.label}</span>
            <span className={clsx("tabular relative font-mono text-xs", on ? "opacity-70" : "text-ink-3")}>{it.count}</span>
          </button>
        );
      })}
    </div>
  );
}

function SearchBar({
  query,
  onQuery,
  options,
  filter,
  onFilter,
  focusTick,
  onClose,
}: {
  query: string;
  onQuery: (q: string) => void;
  options: Option[];
  filter: Filter;
  onFilter: (f: Filter) => void;
  focusTick: number;
  onClose: () => void;
}) {
  const copy = useCopy();
  const [menu, setMenu] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const active = options.find((o) => sameFilter(o.filter, filter) && o.filter.kind !== "all");

  useEffect(() => {
    input.current?.focus();
  }, [focusTick]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setMenu(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [menu]);

  return (
    <div ref={root} className="relative z-20">
      <div className="glass field-pill flex h-12 items-center gap-2 rounded-full pl-4 pr-1.5">
        <Search size={17} className="shrink-0 text-ink-3" aria-hidden />
        {active && (
          <motion.button
            type="button"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={() => onFilter({ kind: "all" })}
            aria-label={`${copy.tasks.clearFilter}: ${active.label}`}
            className="flex h-8 min-w-0 max-w-[45%] shrink items-center gap-1.5 rounded-full pl-2.5 pr-2 text-[13px] text-ink"
            style={{
              background: `color-mix(in oklab, ${kindColor[active.dot!]} 22%, var(--glass-strong))`,
              boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${kindColor[active.dot!]} 70%, transparent)`,
            }}
          >
            <KindDot kind={active.dot!} className="shrink-0" />
            <span className="truncate">{active.label}</span>
            <X size={13} className="shrink-0 text-ink-2" aria-hidden />
          </motion.button>
        )}
        <input
          ref={input}
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              if (query) onQuery("");
              else onClose();
            }
            if (e.key === "Backspace" && !query && active) onFilter({ kind: "all" });
          }}
          placeholder={copy.tasks.search}
          aria-label={copy.tasks.search}
          className="bare h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button type="button" onClick={() => onQuery("")} aria-label={copy.tasks.clearSearch} className="grid size-8 shrink-0 place-items-center rounded-full text-ink-3 hover:text-ink">
            <X size={15} />
          </button>
        )}
        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          aria-label={copy.tasks.filter}
          aria-expanded={menu}
          aria-haspopup="menu"
          className={clsx("relative grid size-9 shrink-0 place-items-center rounded-full transition-colors", menu || active ? "bg-solid text-solid-ink" : "text-ink-2 hover:bg-fill hover:text-ink")}
        >
          <SlidersHorizontal size={16} />
        </button>
      </div>

      <AnimatePresence>
        {menu && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="glass-strong absolute inset-x-0 top-[calc(100%+8px)] origin-top overflow-hidden rounded-[22px] p-1.5"
          >
            <p className="eyebrow px-3 pb-1 pt-2">{copy.tasks.filter}</p>
            {options.map((o) => {
              const on = sameFilter(o.filter, filter);
              return (
                <button
                  key={o.filter.kind === "objective" ? o.filter.id : o.filter.kind}
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  onClick={() => {
                    onFilter(o.filter);
                    setMenu(false);
                  }}
                  className={clsx("flex h-11 w-full items-center gap-3 rounded-2xl px-3 text-left text-[15px] transition-colors hover:bg-fill", on ? "text-ink" : "text-ink-2")}
                >
                  <span className="grid w-3 place-items-center">{o.dot ? <KindDot kind={o.dot} /> : null}</span>
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {on && <Check size={16} className="shrink-0" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
