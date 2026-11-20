export function formatNumber(value, options = {}) {
  const number = Number(value || 0)
  const {
    minimumFractionDigits = 0,
    maximumFractionDigits = 0,
  } = options

  return number.toLocaleString("ko-KR", {
    minimumFractionDigits,
    maximumFractionDigits,
  })
}

export function formatCurrency(value) {
  return `${formatNumber(value)}원`
}

function normalizeDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  const normalized = String(value).replace(" ", "T")
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function formatDateTime(value) {
  const parsed = normalizeDate(value)
  if (!parsed) return value || "-"
  return parsed.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

export function formatTime(value) {
  const parsed = normalizeDate(value)
  if (!parsed) return value || "-"
  return parsed.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

export function modeLabel(mode) {
  return mode === "real" ? "실전매매" : "모의매매"
}

export function modeBadgeClass(mode) {
  return mode === "real"
    ? "border border-red-500/40 bg-red-950/70 text-red-300"
    : "border border-sky-500/40 bg-sky-950/70 text-sky-300"
}
