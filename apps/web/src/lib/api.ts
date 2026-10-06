const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333';

export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, headers, ...customConfig } = options;

  const defaultHeaders: Record<string, string> = {};

  if (customConfig.body) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      ...defaultHeaders,
      ...headers,
    },
    ...customConfig,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Ocorreu um erro na requisição');
  }

  return data as T;
}
