import { formatCurrency, formatNumber } from "../../utils/formatters"

function MetricCard({ label, value, helper, tone = "text-white" }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`mt-3 text-xl font-black ${tone}`}>{value}</p>
      {helper && <p className="mt-2 text-xs text-slate-500">{helper}</p>}
    </div>
  )
}

function SignalSection({
  title,
  accent,
  count,
  expanded,
  onToggle,
  stocks,
  positionsMap,
  onOpenOrder,
}) {
  const titleClass =
    accent === "buy"
      ? "text-emerald-300"
      : "text-rose-300"

  const badgeClass =
    accent === "buy"
      ? "bg-emerald-500/15 text-emerald-300"
      : "bg-rose-500/15 text-rose-300"

  if (!stocks.length) return null

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3">
        <div>
          <h3 className={`text-xl font-bold ${titleClass}`}>{title}</h3>
          <p className="mt-1 text-sm text-slate-400">{count}건</p>
        </div>
        <span className="text-sm font-semibold text-slate-400">{expanded ? "접기" : "펼치기"}</span>
      </button>

      {expanded && (
        <div className="mt-5 space-y-4">
          {stocks.map((stock) => {
            const holding = positionsMap[stock.symbol]
            const score = accent === "buy" ? stock.buy_score : stock.sell_score
            const reasons = accent === "buy" ? stock.buy_reasons : stock.sell_reasons
            const holdingLabel = holding ? `보유중 ${formatNumber(holding.quantity)}주` : "미보유"
            const holdingTone = holding
              ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
              : "border-slate-700 bg-slate-900 text-slate-400"
            const actionLabel =
              accent === "buy"
                ? holding
                  ? "보유중 추가매수 준비"
                  : "빠른 매수"
                : holding
                  ? "보유분 매도 준비"
                  : "보유 포지션 없음"

            return (
              <div key={`${accent}-${stock.symbol}`} className="rounded-[26px] border border-slate-800 bg-slate-950/70 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xl font-black text-white">{stock.name}</p>
                      <span className="text-sm text-slate-400">{stock.symbol}</span>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${holdingTone}`}>
                        {holdingLabel}
                      </span>
                    </div>
                    {holding && (
                      <p className="mt-2 text-sm text-slate-400">
                        평균단가 {formatCurrency(holding.entry_price)} / 현재 보유 {formatNumber(holding.quantity)}주
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">현재가</p>
                    <p className="mt-2 text-3xl font-black text-white">{formatCurrency(stock.price)}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-300">점수 {score}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 xl:grid-cols-4">
                  <MetricCard
                    label="현재가"
                    value={formatCurrency(stock.price)}
                    helper="기준 주문 가격"
                  />
                  <MetricCard
                    label="손절가"
                    value={stock.stop_loss > 0 ? formatCurrency(stock.stop_loss) : "-"}
                    helper={stock.sl_pct || (accent === "buy" ? "손절 기준 없음" : "매도 후보")}
                    tone={stock.stop_loss > 0 ? "text-rose-300" : "text-slate-400"}
                  />
                  <MetricCard
                    label="익절가"
                    value={stock.take_profit > 0 ? formatCurrency(stock.take_profit) : "-"}
                    helper={stock.tp_pct || (accent === "buy" ? "익절 기준 없음" : "매도 후보")}
                    tone={stock.take_profit > 0 ? "text-emerald-300" : "text-slate-400"}
                  />
                  <MetricCard
                    label="R:R"
                    value={stock.rr_ratio || "-"}
                    helper={holding ? "보유 상태에서도 유지" : "신규 진입 판단 기준"}
                    tone={stock.rr_ratio ? "text-amber-300" : "text-slate-400"}
                  />
                </div>

                {!!reasons?.length && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {reasons.map((reason) => (
                      <span key={reason} className={`rounded-full px-2.5 py-1 text-xs font-bold ${badgeClass}`}>
                        {reason}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {accent === "buy" ? (
                    <button
                      type="button"
                      onClick={() => onOpenOrder(stock, "buy")}
                      className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
                    >
                      {actionLabel}
                    </button>
                  ) : holding ? (
                    <button
                      type="button"
                      onClick={() => onOpenOrder(stock, "sell")}
                      className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-400"
                    >
                      {actionLabel}
                    </button>
                  ) : (
                    <span className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-500">
                      {actionLabel}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default SignalSection
