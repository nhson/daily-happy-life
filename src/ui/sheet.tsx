"use client";

import { motion, useAnimate, useDragControls, useReducedMotion } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Bottom sheet on a native <dialog> (top layer, inert background, Esc to close).
 * Drag the handle down to dismiss.
 */
export function Sheet({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const backdrop = useRef<HTMLDivElement>(null);
  const controls = useDragControls();
  const reduce = useReducedMotion();

  useEffect(() => {
    const d = ref.current;
    if (!d || !scope.current || !backdrop.current) return;
    if (open && !d.open) {
      d.showModal();
      animate(backdrop.current, { opacity: [0, 1] }, { duration: 0.3 });
      animate(scope.current, reduce ? { opacity: [0, 1] } : { y: ["100%", "0%"] }, reduce ? { duration: 0.2 } : { type: "spring", stiffness: 380, damping: 36 });
    } else if (!open && d.open) {
      animate(backdrop.current, { opacity: 0 }, { duration: 0.25 });
      animate(scope.current, reduce ? { opacity: 0 } : { y: "100%" }, { duration: 0.26, ease: [0.4, 0, 1, 1] }).then(() => d.close());
    }
  }, [open, animate, scope, reduce]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-hidden bg-transparent p-0 text-ink"
    >
      <div ref={backdrop} className="absolute inset-0 bg-[rgb(5_8_25/0.32)]" onClick={onClose} />
      <motion.div
        ref={scope}
        drag="y"
        dragListener={false}
        dragControls={controls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 110 || info.velocity.y > 700) onClose();
        }}
        className="glass-strong absolute inset-x-0 bottom-0 mx-auto flex max-h-[92dvh] max-w-xl flex-col rounded-t-[30px] sm:bottom-4 sm:rounded-[30px]"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-3 active:cursor-grabbing"
          onPointerDown={(e) => controls.start(e)}
        >
          <span className="h-1.5 w-10 rounded-full bg-ink-3 opacity-50" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-2 sm:px-7">{children}</div>
      </motion.div>
    </dialog>
  );
}
