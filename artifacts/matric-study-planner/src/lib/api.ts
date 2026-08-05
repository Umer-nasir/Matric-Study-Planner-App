const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ?? '';

export function apiUrl(path: `/api/${string}`): string {
  return `${apiBaseUrl}${path}`;
}
