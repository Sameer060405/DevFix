/**
 * Returns a stable UUID for this browser.
 * Generated once, persisted in localStorage under "devfix_user_id".
 * Used as the X-User-Id header so the backend can associate Redis context
 * with this user across the Error Debugger, Chat, and Repo Analyzer.
 */
export function getUserId() {
  const KEY = "devfix_user_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
