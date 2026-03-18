import { useState, useEffect, useCallback } from "react";
import { getSummary, getRoutes, getTimeseries, getErrors } from "../api/analytics.js";

/* ── Top-level panel ────────────────────────────────────────────── */
export default function AnalyticsPanel() {
  const [window, setWindow]       = useState("24h");
  const [summary, setSummary]     = useState(null);
  const [routes,  setRoutes]      = useState([]);
  const [series,  setSeries]      = useState([]);
  const [errors,  setErrors]      = useState([]);
  const [tab,     setTab]         = useState("overview"); // overview | routes | errors
  const [loading, setLoading]     = useState(true);
  const [fetchErr, setFetchErr]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFetchErr(null);
    try {
      const [s, r, ts, e] = await Promise.all([
        getSummary(window),
        getRoutes(window),
        getTimeseries(window),
        getErrors(),
      ]);
      setSummary(s);
      setRoutes(r);
      setSeries(ts);
      setErrors(e);
    } catch (err) {
      setFetchErr(err.message);
    } finally {
      setLoading(false);
    }
  }, [window]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Toolbar ─────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">Analytics</h2>
          <p className="text-xs text-gray-500 mt-0.5">API performance and error monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Window toggle */}
          <div className="flex rounded-lg overflow-hidden border border-gray-700 text-xs">
            {["24h", "7d"].map((w) => (
              <button
                key={w}
                onClick={() => setWindow(w)}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  window === w ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:text-gray-200"
                }`}
              >
                {w === "24h" ? "Last 24 h" : "Last 7 d"}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshIcon spinning={loading} />
          </button>
        </div>
      </div>

      {fetchErr && (
        <div className="bg-red-950/50 border border-red-800/60 rounded-xl px-4 py-3 text-sm text-red-300">
          {fetchErr}
        </div>
      )}

      {/* ── KPI cards ───────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Requests" value={summary?.total ?? "—"} loading={loading} />
        <StatCard label="Errors"         value={summary?.errors ?? "—"} loading={loading} accent="red" />
        <StatCard label="Error Rate"     value={summary ? `${summary.errorRate}%` : "—"} loading={loading}
                  accent={summary?.errorRate > 5 ? "red" : summary?.errorRate > 1 ? "yellow" : "green"} />
        <StatCard label="Avg Latency"    value={summary ? `${summary.avgMs} ms` : "—"} loading={loading} />
        <StatCard label="p95 Latency"    value={summary ? `${summary.p95Ms} ms` : "—"} loading={loading}
                  accent={summary?.p95Ms > 2000 ? "red" : summary?.p95Ms > 800 ? "yellow" : null} />
        <StatCard label="p99 Latency"    value={summary ? `${summary.p99Ms} ms` : "—"} loading={loading}
                  accent={summary?.p99Ms > 5000 ? "red" : null} />
      </div>

      {/* ── Tabs ────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-gray-800">
        {[
          { id: "overview", label: "Overview" },
          { id: "routes",   label: `Routes (${routes.length})` },
          { id: "errors",   label: `Errors (${errors.length})`, badge: errors.length > 0 },
        ].map(({ id, label, badge }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === id
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            {label}
            {badge && (
              <span className="ml-1.5 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                !
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────── */}
      {tab === "overview" && <OverviewTab series={series} loading={loading} window={window} />}
      {tab === "routes"   && <RoutesTab   routes={routes} loading={loading} />}
      {tab === "errors"   && <ErrorsTab   errors={errors} loading={loading} />}
    </div>
  );
}

/* ── Overview: timeseries bar chart ─────────────────────────────── */
function OverviewTab({ series, loading, window }) {
  if (loading) return <SkeletonBlock rows={8} />;
  if (!series.length) return <Empty>No request data for this period.</Empty>;

  const maxTotal = Math.max(...series.map((s) => s.total), 1);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-medium text-gray-300 mb-4">
        Requests {window === "24h" ? "per hour" : "per day"}
      </h3>
      <div className="flex items-end gap-1 h-40 overflow-x-auto pb-1">
        {series.map((s) => {
          const totalPct  = (s.total  / maxTotal) * 100;
          const errorPct  = (s.errors / s.total)  * 100;
          const label = window === "24h"
            ? s.bucket.slice(11, 16)   // HH:00
            : s.bucket.slice(5);        // MM-DD
          return (
            <div key={s.bucket} className="flex-1 min-w-[28px] flex flex-col items-center gap-1 group">
              <div className="relative w-full flex flex-col-reverse" style={{ height: "128px" }}>
                {/* Error portion */}
                {s.errors > 0 && (
                  <div
                    className="w-full bg-red-600/80 rounded-t"
                    style={{ height: `${(s.errors / maxTotal) * 100}%` }}
                  />
                )}
                {/* Success portion */}
                <div
                  className="w-full bg-indigo-600 rounded-t group-hover:bg-indigo-500 transition-colors"
                  style={{ height: `${((s.total - s.errors) / maxTotal) * 100}%` }}
                  title={`${s.total} requests, ${s.errors} errors`}
                />
              </div>
              <span className="text-[10px] text-gray-500 rotate-45 origin-left ml-2 whitespace-nowrap">
                {label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-6 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-indigo-600 inline-block" />Successful</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-600/80 inline-block" />Errors</span>
      </div>
    </div>
  );
}

/* ── Routes tab ─────────────────────────────────────────────────── */
function RoutesTab({ routes, loading }) {
  if (loading) return <SkeletonBlock rows={6} />;
  if (!routes.length) return <Empty>No route data for this period.</Empty>;

  const maxCount = Math.max(...routes.map((r) => r.count), 1);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-left text-xs text-gray-500">
            <th className="px-4 py-3 font-medium">Route</th>
            <th className="px-4 py-3 font-medium text-right">Requests</th>
            <th className="px-4 py-3 font-medium text-right">Errors</th>
            <th className="px-4 py-3 font-medium text-right">Avg</th>
            <th className="px-4 py-3 font-medium text-right">p95</th>
            <th className="px-4 py-3 font-medium w-32">Volume</th>
          </tr>
        </thead>
        <tbody>
          {routes.map((r, i) => {
            const errRate = r.count ? (r.errors / r.count) * 100 : 0;
            return (
              <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-3 font-mono">
                  <span className={`text-[11px] font-bold mr-2 px-1.5 py-0.5 rounded ${methodColour(r.method)}`}>
                    {r.method}
                  </span>
                  <span className="text-gray-300 text-xs">{r.path}</span>
                </td>
                <td className="px-4 py-3 text-right text-gray-200">{r.count}</td>
                <td className={`px-4 py-3 text-right font-medium ${r.errors > 0 ? "text-red-400" : "text-gray-500"}`}>
                  {r.errors > 0 ? `${r.errors} (${errRate.toFixed(0)}%)` : "0"}
                </td>
                <td className="px-4 py-3 text-right text-gray-400">{r.avgMs} ms</td>
                <td className={`px-4 py-3 text-right ${r.p95Ms > 2000 ? "text-red-400" : r.p95Ms > 800 ? "text-yellow-400" : "text-gray-400"}`}>
                  {r.p95Ms} ms
                </td>
                <td className="px-4 py-3">
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden w-full">
                    <div
                      className="h-full bg-indigo-600 rounded-full"
                      style={{ width: `${(r.count / maxCount) * 100}%` }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Errors tab ─────────────────────────────────────────────────── */
function ErrorsTab({ errors, loading }) {
  if (loading) return <SkeletonBlock rows={6} />;
  if (!errors.length) return <Empty icon="✓">No errors recorded. Looking good!</Empty>;

  return (
    <div className="flex flex-col gap-2">
      {errors.map((e) => (
        <div key={e._id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${methodColour(e.method)}`}>{e.method}</span>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${statusColour(e.statusCode)}`}>{e.statusCode}</span>
          </div>
          <span className="font-mono text-xs text-gray-300 flex-1 truncate">{e.path}</span>
          <span className="text-xs text-gray-500 shrink-0">{e.responseTimeMs} ms</span>
          {e.errorMessage && (
            <span className="text-xs text-red-400 truncate max-w-xs">{e.errorMessage}</span>
          )}
          <span className="text-[10px] text-gray-600 shrink-0">{new Date(e.createdAt).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Shared small components ────────────────────────────────────── */
function StatCard({ label, value, loading, accent }) {
  const accentClass = {
    red:    "text-red-400",
    yellow: "text-yellow-400",
    green:  "text-emerald-400",
  }[accent] ?? "text-gray-100";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
      <div className="text-[11px] text-gray-500 mb-1">{label}</div>
      {loading
        ? <div className="h-6 w-16 bg-gray-800 rounded animate-pulse" />
        : <div className={`text-xl font-semibold ${accentClass}`}>{value}</div>
      }
    </div>
  );
}

function SkeletonBlock({ rows = 4 }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 bg-gray-900 rounded-xl animate-pulse" style={{ opacity: 1 - i * 0.1 }} />
      ))}
    </div>
  );
}

function Empty({ children, icon = "○" }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-600">
      <span className="text-3xl">{icon}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

function RefreshIcon({ spinning }) {
  return (
    <svg
      className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0
           l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7
           l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

/* ── Colour helpers ─────────────────────────────────────────────── */
function methodColour(method) {
  return {
    GET:    "bg-emerald-900/60 text-emerald-400",
    POST:   "bg-blue-900/60 text-blue-400",
    PATCH:  "bg-yellow-900/60 text-yellow-400",
    PUT:    "bg-orange-900/60 text-orange-400",
    DELETE: "bg-red-900/60 text-red-400",
  }[method] ?? "bg-gray-800 text-gray-400";
}

function statusColour(code) {
  if (code >= 500) return "bg-red-900/60 text-red-300";
  if (code >= 400) return "bg-orange-900/60 text-orange-300";
  if (code >= 300) return "bg-yellow-900/60 text-yellow-300";
  return "bg-emerald-900/60 text-emerald-300";
}
