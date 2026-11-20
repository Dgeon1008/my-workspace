const API_ROOT = process.env.NEXT_PUBLIC_TRADING_API_URL || "http://127.0.0.1:8000"

async function request(method, path, data, config = {}) {
  const url = new URL(path, API_ROOT)
  Object.entries(config.params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
  })

  const response = await fetch(url, {
    method,
    headers: data === undefined ? undefined : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
    signal: AbortSignal.timeout(config.timeout || 30000),
    cache: "no-store",
  })
  const body = await response.text()
  let payload = body
  try {
    payload = body ? JSON.parse(body) : null
  } catch {
    // Keep non-JSON backend errors readable to the existing screens.
  }

  if (!response.ok) {
    const error = new Error(payload?.detail || `Trading API 오류 (${response.status})`)
    error.response = { status: response.status, data: payload }
    throw error
  }

  return { data: payload, status: response.status }
}

const client = {
  get: (path, config) => request("GET", path, undefined, config),
  post: (path, data, config) => request("POST", path, data, config),
}

export default client
