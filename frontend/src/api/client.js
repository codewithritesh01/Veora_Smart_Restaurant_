export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const fetchClient = async (endpoint, { body, ...customConfig } = {}) => {
  const token = localStorage.getItem('token');
  const headers = { ...customConfig.headers };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body) {
    if (body instanceof FormData) {
      delete headers['Content-Type'];
    } else {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      body = JSON.stringify(body);
    }
  }

  const config = {
    method: body ? 'POST' : 'GET',
    ...customConfig,
    headers,
    body,
  };

  let res;
  try {
    res = await fetch(`${BASE_URL}${endpoint}`, config);
  } catch (err) {
    return Promise.reject(err);
  }

  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    const err = new Error('Unauthorized');
    err.response = { status: 401, data: { detail: 'Unauthorized' } };
    return Promise.reject(err);
  }

  let data;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  if (!res.ok) {
    const error = new Error(res.statusText);
    error.response = { status: res.status, data };
    return Promise.reject(error);
  }

  return { data, status: res.status, headers: res.headers };
};

const api = {
  get: (endpoint, config) => fetchClient(endpoint, { ...config, method: 'GET' }),
  post: (endpoint, body, config) => fetchClient(endpoint, { ...config, body, method: 'POST' }),
  patch: (endpoint, body, config) => fetchClient(endpoint, { ...config, body, method: 'PATCH' }),
  delete: (endpoint, config) => fetchClient(endpoint, { ...config, method: 'DELETE' }),
};

export default api;
