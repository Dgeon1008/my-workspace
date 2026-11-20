export function getTickSize(price) {
  if (price < 2000) return 1
  if (price < 5000) return 5
  if (price < 20000) return 10
  if (price < 50000) return 50
  if (price < 200000) return 100
  if (price < 500000) return 500
  return 1000
}

export function roundToTick(price) {
  const numericPrice = Number(price || 0)
  if (numericPrice <= 0) return 0
  const tick = getTickSize(numericPrice)
  return Math.round(numericPrice / tick) * tick
}
