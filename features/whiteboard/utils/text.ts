import { TEXT_LINE_HEIGHT } from "../constants";

export type TextMeasurer = (text: string, width: number, fontSize: number) => number;

/**
 * Environment-free estimate used before the canvas registers an exact
 * measurer (and in tests). Average glyph width is ~0.55em for sans fonts.
 */
export const estimateTextHeight: TextMeasurer = (text, width, fontSize) => {
  const charsPerLine = Math.max(1, Math.floor(width / (fontSize * 0.55)));
  const lines = (text || " ")
    .split("\n")
    .reduce((total, paragraph) => total + Math.max(1, Math.ceil(paragraph.length / charsPerLine)), 0);
  return Math.ceil(lines * fontSize * TEXT_LINE_HEIGHT);
};

let activeMeasurer: TextMeasurer = estimateTextHeight;

/** The canvas registers a Konva-backed measurer so stored heights match rendering. */
export function setTextMeasurer(measurer: TextMeasurer | null): void {
  activeMeasurer = measurer ?? estimateTextHeight;
}

export function measureTextHeight(text: string, width: number, fontSize: number): number {
  return activeMeasurer(text, width, fontSize);
}
