import type { ColorData } from "../models/types";

/** 将颜色结构转换为 CSS rgba 字符串。 */
export function colorDataToCss(color: ColorData | null | undefined, fallback = "rgba(255, 255, 255, 0.6)") {
  if (!color) {
    return fallback;
  }
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const a = Number.isFinite(color.a) ? color.a : 1;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** 将颜色结构转换为 Hex 字符串。 */
export function colorDataToHex(color: ColorData | null | undefined, fallback = "#999999") {
  if (!color) {
    return fallback;
  }
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value * 255)));
  const toHex = (value: number) => clamp(value).toString(16).padStart(2, "0");
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}
