import { formatCurrency, formatDateTime } from "../../utils/formatters"

function HistoryPanel({ history }) {
  if (history.length === 0) {
    return (
      <div className="mt-5 rounded-2xl border border-dashed border-slate-700 px-6 py-16 text-center text-slate-500">
        거래 이력이 없습니다.
      </div>
    )
  }

  return (
    <div className="mt-5 space-y-3">
      {history.map((trade) => (
        <div
          key={trade.id}
          className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4"
        >
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                trade.trade_type === "buy"
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-rose-500/15 text-rose-300"
              }`}
            >
              {trade.trade_type === "buy" ? "매수" : "매도"}
            </span>
            <div>
              <p className="font-bold text-white">{trade.name || trade.symbol}</p>
              <p className="text-sm text-slate-400">{trade.symbol}</p>
            </div>
          </div>

          <div className="grid min-w-[320px] grid-cols-2 gap-3 text-sm xl:grid-cols-4">
            <div>
              <p className="text-slate-500">가격</p>
              <p className="mt-1 font-semibold text-white">{formatCurrency(trade.price)}</p>
            </div>
            <div>
              <p className="text-slate-500">수량</p>
              <p className="mt-1 font-semibold text-white">{trade.quantity}주</p>
            </div>
            <div>
              <p className="text-slate-500">손익률</p>
              <p className={`mt-1 font-semibold ${(trade.pnl_pct || 0) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                {(trade.pnl_pct || 0) >= 0 ? "+" : ""}
                {Number(trade.pnl_pct || 0).toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-slate-500">시각</p>
              <p className="mt-1 font-semibold text-slate-300">{formatDateTime(trade.created_at)}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default HistoryPanel
