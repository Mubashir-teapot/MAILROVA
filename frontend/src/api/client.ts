import axios from "axios";

// Auth is an HttpOnly cookie the browser sends automatically — never read or
// set from JS, so an XSS bug can't steal it. Requests go to this same
// frontend origin's /api/* (see next.config.js rewrites), which forwards
// them server-side to the backend — the browser never talks to the backend
// directly, so the cookie is same-origin, no cross-site cookie config needed.
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "/api",
  withCredentials: true,
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const path = window.location.pathname;
    const onAuthPage = path.startsWith("/admin/login") || path.startsWith("/platform");
    if (err.response?.status === 401 && !onAuthPage) {
      window.location.href = "/admin/login";
    }
    return Promise.reject(err);
  }
);
