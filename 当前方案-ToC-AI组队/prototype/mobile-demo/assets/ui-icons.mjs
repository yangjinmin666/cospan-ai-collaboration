// Shared COSPAN icon geometry. Mini-program SVGs are checked against this source.
export const ICON_STROKE = 1.75;
export const iconPaths = {
  "details": '<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>',
  "wave": '<path d="M7.5 13.2V6a1.5 1.5 0 0 1 3 0v4.6V4a1.5 1.5 0 0 1 3 0v6.6V5.7a1.5 1.5 0 0 1 3 0V11 8.5a1.5 1.5 0 0 1 3 0v5.7c0 4.5-2.6 7.2-6.8 7.2-3 0-5-1.4-6.6-3.8l-3.2-5c-.7-1.1-.5-2.1.3-2.6s1.7-.2 2.3.6l2 2.6Z"/><path d="M20 3.2c1 .7 1.6 1.7 1.8 2.8M2.3 17.8c.5 1.4 1.3 2.5 2.4 3.2"/>',
  "discover": "<circle cx=\"12\" cy=\"12\" r=\"8.25\"/><path d=\"m15.4 8.6-2.05 4.75L8.6 15.4l2.05-4.75 4.75-2.05Z\"/>",
  "connections": "<path d=\"m9.25 14.75-1.4 1.4a3.4 3.4 0 0 1-4.8-4.8l2.3-2.3a3.4 3.4 0 0 1 4.8 0\"/><path d=\"m14.75 9.25 1.4-1.4a3.4 3.4 0 1 1 4.8 4.8l-2.3 2.3a3.4 3.4 0 0 1-4.8 0\"/><path d=\"m8.75 15.25 6.5-6.5\"/>",
  "collaboration": "<path d=\"m7.65 7.75 2.4 2.4m6.3-2.4-2.4 2.4M12 14.7v1.05\"/><circle cx=\"6\" cy=\"6.1\" r=\"2.35\"/><circle cx=\"18\" cy=\"6.1\" r=\"2.35\"/><circle cx=\"12\" cy=\"18.1\" r=\"2.35\"/><path d=\"m12 8 3.35 3.35L12 14.7l-3.35-3.35Z\" fill=\"currentColor\" stroke=\"none\"/>",
  "profile": "<circle cx=\"12\" cy=\"12\" r=\"8.25\"/><circle cx=\"12\" cy=\"9.25\" r=\"2.5\"/><path d=\"M6.75 18.4a5.8 5.8 0 0 1 10.5 0\"/>",
  "filter": "<path d=\"M3 6h18M3 12h18M3 18h18\"/><circle cx=\"8\" cy=\"6\" r=\"2.25\" fill=\"currentColor\" stroke=\"#fff\" stroke-width=\"1.5\"/><circle cx=\"16\" cy=\"12\" r=\"2.25\" fill=\"currentColor\" stroke=\"#fff\" stroke-width=\"1.5\"/><circle cx=\"8\" cy=\"18\" r=\"2.25\" fill=\"currentColor\" stroke=\"#fff\" stroke-width=\"1.5\"/>",
  "back": "<path d=\"m10 5-7 7 7 7M3 12h18\"/>",
  "close": "<path d=\"m6 6 12 12M18 6 6 18\"/>",
  "forward": "<path d=\"m14 5 7 7-7 7M3 12h18\"/>",
  "event": "<rect x=\"4.5\" y=\"3.5\" width=\"14\" height=\"17\" rx=\"3\"/><path d=\"M8 10h7M8 15h5\"/><circle cx=\"18\" cy=\"5\" r=\"3.25\" fill=\"#347cf8\" stroke=\"#fff\" stroke-width=\"1.5\"/>",
  "settings": "<path d=\"M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5Zm8.1 4.7v-2.4l-2.2-.7a7 7 0 0 0-.7-1.7l1.1-2-1.7-1.7-2 1.1a7 7 0 0 0-1.7-.7L12.2 3H9.8l-.7 2.2a7 7 0 0 0-1.7.7l-2-1.1-1.7 1.7 1.1 2a7 7 0 0 0-.7 1.7l-2.2.7v2.4l2.2.7a7 7 0 0 0 .7 1.7l-1.1 2 1.7 1.7 2-1.1a7 7 0 0 0 1.7.7l.7 2.2h2.4l.7-2.2a7 7 0 0 0 1.7-.7l2 1.1 1.7-1.7-1.1-2a7 7 0 0 0 .7-1.7l2.2-.7Z\"/>"
};
export function renderUiIcon(name, color = "currentColor", extra = "") {
  if (!iconPaths[name]) throw new Error("Unknown COSPAN icon: " + name);
  const solid = name === "settings";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="${solid ? color : "none"}" stroke="${solid ? "none" : color}" stroke-width="${ICON_STROKE}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" ${extra}>${iconPaths[name].replaceAll("currentColor", color)}</svg>`;
}
