export type LayoutType =
  | "hero-cover"
  | "image-left"
  | "image-right"
  | "split-insight"
  | "vertical-timeline"
  | "horizontal-steps"
  | "feature-grid"
  | "comparison"
  | "statistics-highlight"
  | "premium-content";

export type ThemeName =
  | "neon-cyan"
  | "cyber-purple"
  | "deep-blue"
  | "emerald-tech"
  | "premium-gold";

export interface Theme {
  name: ThemeName;

  background: string;

  accent: string;

  textPrimary: string;

  textSecondary: string;
}

export interface ContentBlock {
  type:
    | "paragraph"
    | "bullet"
    | "steps"
    | "features"
    | "quote"
    | "stat";

  title?: string;

  content?: string;

  items?: string[];

  value?: string;

  label?: string;
}

export interface VisualElements {
  diagram?:
    | "insight-nodes"
    | "timeline"
    | "feature-grid"
    | "steps"
    | "comparison";

  nodes?: number;

  alignment?:
    | "left"
    | "center"
    | "right"
    | "split";

  overlay?: boolean;

  gradient?:
    | "dark"
    | "neon"
    | "none";
}

export interface PPTSlide {
  layoutType:
    LayoutType;

  theme: Theme;

  title: string;

  contentBlocks:
    ContentBlock[];

  imageQuery?: string;

  visualElements?:
    VisualElements;
}

export interface PPTOutline {
  slides:
    PPTSlide[];
}