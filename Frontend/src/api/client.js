const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export async function apiFetch(path, options = {}, baseUrl = API_BASE_URL) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.mensaje ?? `Error ${response.status}: ${response.statusText}`)
  }

  return response.json()
}
