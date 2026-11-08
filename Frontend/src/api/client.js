const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export async function apiFetch(path, options = {}, baseUrl = API_BASE_URL) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const error = new Error(body?.mensaje ?? `Error ${response.status}: ${response.statusText}`)
    if (body) {
      Object.assign(error, body);
    }
    error.status = response.status
    throw error;
  }

  return response.json()
}
