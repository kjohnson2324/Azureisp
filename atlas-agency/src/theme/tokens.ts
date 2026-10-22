// Design tokens. Map and UI colours use the Okabe–Ito palette, which stays
// distinguishable under protanopia, deuteranopia and tritanopia. Status is never
// conveyed by colour alone: every state also has an icon and a text label.

export const palette = {
  black: '#000000',
  orange: '#E69F00',
  skyBlue: '#56B4E9',
  green: '#009E73',
  yellow: '#F0E442',
  blue: '#0072B2',
  vermillion: '#D55E00',
  purple: '#CC79A7',
  ink: '#1B1F3B',
  paper: '#FFFDF7',
  white: '#FFFFFF',
} as const;

/** Map fills per continent (Okabe–Ito ordering; borders carry contrast, not fill). */
export const regionFill = {
  Africa: palette.orange,
  Americas: palette.skyBlue,
  Asia: palette.green,
  Europe: palette.yellow,
  Oceania: palette.purple,
} as const;

export type Theme = Record<
  'background' | 'surface' | 'text' | 'textMuted' | 'accent' | 'correct' | 'incorrect' | 'focusRing' | 'mapWater' | 'mapBorder',
  string
>;

export const lightTheme: Theme = {
  background: palette.paper,
  surface: palette.white,
  text: palette.ink,          // 15.8:1 on paper
  textMuted: '#4A4F6A',       // 7.9:1 on paper
  accent: palette.blue,       // 5.1:1 on paper, AA for text
  // 3.4:1 and 3.8:1: meets AA for icons, borders and large text only. Never body text.
  correct: palette.green,
  incorrect: palette.vermillion,
  focusRing: palette.blue,
  mapWater: '#DCEBF5',
  mapBorder: palette.ink,
};

export const darkTheme: Theme = {
  background: '#11132A',
  surface: '#1B1F3B',
  text: '#F4F4F8',
  textMuted: '#C2C5D6',
  accent: palette.skyBlue,
  correct: '#3CC59A',
  incorrect: '#FF8A4C',
  focusRing: palette.yellow,
  mapWater: '#1F3550',
  mapBorder: '#F4F4F8',
};

export type FontChoice = 'default' | 'dyslexia';

/** Atkinson Hyperlegible by default; OpenDyslexic on request. Both are SIL OFL. */
export const fontFamily: Record<FontChoice, { regular: string; bold: string }> = {
  default: { regular: 'AtkinsonHyperlegible-Regular', bold: 'AtkinsonHyperlegible-Bold' },
  dyslexia: { regular: 'OpenDyslexic-Regular', bold: 'OpenDyslexic-Bold' },
};

export const layout = {
  minTouchTarget: 48, // exceeds WCAG 2.5.5 / platform guidance (44pt iOS, 48dp Android)
  radius: 14,
  space: (n: number) => n * 4,
};
