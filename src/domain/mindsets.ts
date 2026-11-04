/**
 * The five "Designer's Way" mindsets (How to Live a Meaningful Life).
 * Keys only: names and lines live in the copy dictionaries, in the user's language.
 */
export const MINDSET_KEYS = ["wonder", "availability", "radical-acceptance", "engaged-detached", "create-your-world"] as const;

export type MindsetKey = (typeof MINDSET_KEYS)[number];
