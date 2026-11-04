/** The five "Designer's Way" mindsets (How to Live a Meaningful Life). Lines are our own wording. */
export const MINDSETS = [
  { key: "wonder", name: "Wonder", line: "Look at one ordinary thing today as if you had never seen it before." },
  { key: "availability", name: "Availability", line: "Be fully here for whoever is in front of you." },
  { key: "radical-acceptance", name: "Radical Acceptance", line: "Start from what is true today, not from what should be." },
  { key: "engaged-detached", name: "Fully Engaged & Calmly Detached", line: "Give it everything you have, then let the outcome be." },
  { key: "create-your-world", name: "Create Your World", line: "You are designing this day. Make one deliberate choice." },
] as const;

export type Mindset = (typeof MINDSETS)[number];
