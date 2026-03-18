async function request(path) {
  let res;
  try {
    res = await fetch(`/api/analytics${path}`, { credentials: "include" });
  } catch {
    throw new Error("Cannot reach the server.");
  }
  if (res.status === 401) {
    window.dispatchEvent(new Event("auth:expired"));
    throw new Error("Session expired.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
  return data;
}

/** { total, errors, errorRate, avgMs, p95Ms, p99Ms } */
export const getSummary    = (window = "24h") => request(`/summary?window=${window}`);
/** [{ method, path, count, errors, avgMs, p95Ms }] */
export const getRoutes     = (window = "24h") => request(`/routes?window=${window}`);
/** [{ bucket, total, errors }] */
export const getTimeseries = (window = "24h") => request(`/timeseries?window=${window}`);
/** [{ method, path, statusCode, responseTimeMs, errorMessage, createdAt }] */
export const getErrors     = ()               => request("/errors");
