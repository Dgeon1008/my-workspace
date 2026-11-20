import { formatCurrency, modeBadgeClass, modeLabel } from "../../utils/formatters"

function originMeta(origin) {
  if (origin === "external") {
    return {
      label: "EXTERNAL",
      className: "bg-amber-500/15 text-amber-300",
    }
  }

  if (origin === "mixed") {
    return {
      label: "MIXED",
      className: "bg-violet-500/15 text-violet-300",
    }
  }

  return {
    label: "APP",
    className: "bg-sky-500/15 text-sky-300",
  }
}

function PositionsPanel({
  positions,
  currentPrices,
  editingPosition,
  editTakeProfit,
  editStopLoss,
  setEditTakeProfit,
  setEditStopLoss,
  onToggleEdit,
  onSavePosition,
  onPrepareSell,
}) {
  if (positions.length === 0) {
    return (
      <div className="mt-5 rounded-2xl border border-dashed border-slate-700 px-6 py-16 text-center text-slate-500">
        현재 주문 모드 기준 보유 포지션이 없습니다.
      </div>
    )
  }

  return (
    <div className="mt-5 space-y-4">
      {positions.map((position) => {
        const currentPrice = currentPrices[position.symbol] || position.current_price || position.entry_price
        const pnlPct = position.entry_price
          ? ((currentPrice - position.entry_price) / position.entry_price) * 100
          : Number(position.pnl_pct || 0)
        const pnlAmount = (currentPrice - position.entry_price) * position.quantity
        const isEditing = editingPosition === position.symbol
        const orderableQuantity = Number(position.orderable_quantity ?? position.quantity ?? 0)
        const positionOrigin = originMeta(position.origin)

        return (
          <div key={`${position.mode}-${position.symbol}`} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-bold text-white">{position.name || position.symbol}</p>
                  <span className="text-sm text-slate-400">{position.symbol}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${modeBadgeClass(position.mode)}`}>
                    {modeLabel(position.mode)}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${positionOrigin.className}`}>
                    {positionOrigin.label}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-400 xl:grid-cols-3">
                  <p>평균단가 <span className="ml-2 font-semibold text-white">{formatCurrency(position.entry_price)}</span></p>
                  <p>보유수량 <span className="ml-2 font-semibold text-white">{position.quantity}주</span></p>
                  <p>현재가 <span className="ml-2 font-semibold text-white">{formatCurrency(currentPrice)}</span></p>
                </div>
                {orderableQuantity !== Number(position.quantity) && (
                  <p className="mt-2 text-xs text-amber-300">매도 가능 수량 {orderableQuantity}주</p>
                )}
                {position.broker_synced === false && (
                  <p className="mt-2 text-xs text-amber-300">
                    브로커 잔고 동기화에 실패했습니다. 새로고침 후 다시 확인해 주세요.
                  </p>
                )}
              </div>

              <div className="text-right">
                <p className={`text-xl font-black ${pnlPct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {pnlPct >= 0 ? "+" : ""}
                  {pnlPct.toFixed(2)}%
                </p>
                <p className={`mt-1 text-sm font-semibold ${pnlAmount >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                  {formatCurrency(pnlAmount)}
                </p>
              </div>
            </div>

            {!isEditing && (position.take_profit || position.stop_loss) && (
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                {position.take_profit > 0 && (
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-300">
                    익절 {formatCurrency(position.take_profit)}
                  </span>
                )}
                {position.stop_loss > 0 && (
                  <span className="rounded-full bg-rose-500/10 px-3 py-1 text-rose-300">
                    손절 {formatCurrency(position.stop_loss)}
                  </span>
                )}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onPrepareSell(position, 25)}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
              >
                25% 매도 준비
              </button>
              <button
                type="button"
                onClick={() => onPrepareSell(position, 50)}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
              >
                50% 매도 준비
              </button>
              <button
                type="button"
                onClick={() => onPrepareSell(position, 100)}
                className="rounded-xl bg-rose-500/90 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-400"
              >
                전량 매도 준비
              </button>
              <button
                type="button"
                onClick={() => onToggleEdit(position)}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
              >
                {isEditing ? "수정 닫기" : "익절/손절 수정"}
              </button>
            </div>

            {isEditing && (
              <div className="mt-4 grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 xl:grid-cols-[1fr_1fr_auto]">
                <input
                  type="number"
                  value={editTakeProfit}
                  onChange={(event) => setEditTakeProfit(event.target.value)}
                  placeholder="익절가"
                  className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500"
                />
                <input
                  type="number"
                  value={editStopLoss}
                  onChange={(event) => setEditStopLoss(event.target.value)}
                  placeholder="손절가"
                  className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => onSavePosition(position)}
                  className="rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
                >
                  저장
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default PositionsPanel
