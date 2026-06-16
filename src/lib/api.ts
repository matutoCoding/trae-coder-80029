const BASE_URL = '/api';

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'ApiError';
  }
}

function buildUrl(url: string, params?: Record<string, string | number | boolean>): string {
  let fullUrl = `${BASE_URL}${url}`;
  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, String(value));
    });
    const separator = fullUrl.includes('?') ? '&' : '?';
    fullUrl += `${separator}${searchParams.toString()}`;
  }
  return fullUrl;
}

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');
  let data: T;

  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = (await response.text()) as unknown as T;
  }

  if (!response.ok) {
    const message =
      (data as { message?: string })?.message ||
      response.statusText ||
      `请求失败 (${response.status})`;
    throw new ApiError(message, response.status, data);
  }

  return data;
}

async function request<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers, ...restOptions } = options;
  const fullUrl = buildUrl(url, params);

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const finalHeaders: HeadersInit = {
    ...defaultHeaders,
    ...headers,
  };

  const response = await fetch(fullUrl, {
    ...restOptions,
    headers: finalHeaders,
  });

  return handleResponse<T>(response);
}

export const api = {
  get<T>(url: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return request<T>(url, { ...options, method: 'GET' });
  },

  post<T>(
    url: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>
  ): Promise<T> {
    return request<T>(url, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(
    url: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>
  ): Promise<T> {
    return request<T>(url, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  del<T>(url: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return request<T>(url, { ...options, method: 'DELETE' });
  },
};

export { ApiError };
export type { RequestOptions };
