const BASE = "/api/auth";

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      ...options,
    });
  } catch {
    throw new Error("Cannot reach the server. Is the backend running on port 5000?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
  return data;
}

/** Register a new account. Returns { ok, user } */
export function register({ name, email, password }) {
  return request("/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

/** Log in. Returns { ok, user } */
export function login({ email, password }) {
  return request("/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

/** Log out (clears cookie server-side). Returns { ok } */
export function logout() {
  return request("/logout", { method: "POST" });
}

/** Fetch current user from cookie. Returns { user } or throws 401. */
export function getMe() {
  return request("/me");
}
