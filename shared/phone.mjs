// Local 11-digit numbers, optionally prefixed with +88. Whitespace is allowed.
export const phonePattern = String.raw`\s*(?:\+88\s*)?01[0-9]{9}\s*`;
export function normalizePhone(value) {
  if (!new RegExp(`^(?:${phonePattern})$`).test(value)) return null;
  return value.trim().replace(/^\+88\s*/, "");
}
