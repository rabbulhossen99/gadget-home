let csrf = "";
export function setCsrf(value: string) {
  csrf = value;
}
export async function api<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(method !== "GET" ? { "X-CSRF-Token": csrf } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Request failed");
  return result;
}
export async function upload(file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024)
    throw new Error("Images must be 5 MB or smaller.");
  const response = await fetch("/api/admin/upload", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": file.type, "X-CSRF-Token": csrf },
    body: file,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result.url;
}
export const money = (value: number) =>
  "৳" +
  new Intl.NumberFormat("en-BD", { maximumFractionDigits: 2 }).format(
    value / 100,
  );
export function clean<T extends { id?: string; version?: number }>(data: T) {
  const { id, version, ...rest } = data;
  return rest;
}
export function download(name: string, content: string, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csv(rows: unknown[][]) {
  return rows
    .map((row) =>
      row
        .map((v) => {
          const text = String(v ?? "");
          return (
            '"' +
            (/^[=+@\-\t\r]/.test(text) ? "'" : "") +
            text.replaceAll('"', '""') +
            '"'
          );
        })
        .join(","),
    )
    .join("\r\n");
}
