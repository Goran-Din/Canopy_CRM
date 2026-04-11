import axios from 'axios';

/**
 * Axios instance for public (unauthenticated) endpoints.
 * Does NOT attach JWT or trigger token refresh.
 */
export const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});
