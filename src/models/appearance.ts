// Public appearance contract shared by system and client templates.
export type Appearance = {
  borders: "none" | "subtle" | "defined";
  rounding: "straight" | "soft" | "rounded";
  shadows: "none" | "soft" | "marked";
};
export const DEFAULT_APPEARANCE: Appearance = {
  borders: "subtle",
  rounding: "soft",
  shadows: "soft",
};
export function normalizeAppearance(value: unknown): Appearance {
  const input =
    value && typeof value === "object" ? (value as Partial<Appearance>) : {};
  return {
    borders: ["none", "subtle", "defined"].includes(input.borders || "")
      ? input.borders!
      : DEFAULT_APPEARANCE.borders,
    rounding: ["straight", "soft", "rounded"].includes(input.rounding || "")
      ? input.rounding!
      : DEFAULT_APPEARANCE.rounding,
    shadows: ["none", "soft", "marked"].includes(input.shadows || "")
      ? input.shadows!
      : DEFAULT_APPEARANCE.shadows,
  };
}

export type BookingSiteConfig = {
  siteId: string;
  template: { id: string; name: string };
  palette: {
    primary: string;
    background: string;
    foreground: string;
    accent: string;
  };
  appearance: Appearance;
  primaryOrigin: string;
};
