/** Display names for the acquisition channels, keyed by their stored form. */
export const CHANNEL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  referral: "Referral",
  google: "Google",
  direct: "Direct",
  podcast: "Podcast",
  x: "X",
};

/** Other names the sources use for the same channel. */
const CHANNEL_ALIASES: Record<string, string> = {
  twitter: "x",
};

/**
 * Turns a channel name from any source into its stored form, so "X" from the
 * newsletter and "twitter" from a UTM tag are one channel. Empty means none.
 */
export function normalizeChannel(raw: string): string | null {
  const key = raw.trim().toLowerCase();
  if (key === "") return null;
  return CHANNEL_ALIASES[key] ?? key;
}

/** The display name for a stored channel; unknown channels show as stored. */
export function channelLabel(channel: string): string {
  return CHANNEL_LABELS[channel] ?? channel;
}
