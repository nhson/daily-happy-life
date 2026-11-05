"use client";

import { motion, useIsPresent, type HTMLMotionProps } from "motion/react";

/**
 * One step of a full-screen flow inside <AnimatePresence mode="popLayout">. While a step is
 * leaving, the next one is already on screen; the leaving one turns inert so a quick second tap
 * can't press its buttons again.
 */
export function StepSection(props: HTMLMotionProps<"section">) {
  const present = useIsPresent();
  return <motion.section {...props} inert={!present} />;
}

export function StepForm(props: HTMLMotionProps<"form">) {
  const present = useIsPresent();
  return <motion.form {...props} inert={!present} />;
}
