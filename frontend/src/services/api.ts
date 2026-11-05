const configuredApi = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "";
function apiPath(path: string) {
  if (!configuredApi && window.location.hostname.endsWith(".github.io")) {
    throw new Error("Backend is not configured. Set the VITE_API_BASE_URL repository variable to your HTTPS backend origin and redeploy.");
  }
  return configuredApi + "/api" + path;
}

export class APIError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  token?: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(apiPath(path), {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const payload = await response
      .json()
      .catch(() => ({ detail: "The server could not complete this request." }));
    throw new APIError(
      response.status,
      typeof payload.detail === "string"
        ? payload.detail
        : "Check the form fields and try again.",
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export const post = (body?: unknown): RequestInit => ({
  method: "POST",
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
export async function exportReport(token: string, includeDemo = false) {
  const response = await fetch(
    apiPath(`/research/export?include_demo=${includeDemo}`),
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!response.ok) throw new Error("Report could not be exported.");
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = "lba-aggregate-report.csv";
  a.click();
  URL.revokeObjectURL(url);
}
