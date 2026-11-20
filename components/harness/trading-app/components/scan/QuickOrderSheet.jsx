import { formatCurrency, formatNumber } from "../../utils/formatters"
import { getTickSize, roundToTick } from "../../utils/trading"

function buttonClass(active, tone) {
  if (!active) {
    return "border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
  }

  return tone === "buy"
    ? "bg-emerald-500 text-slate-950"
    : "bg-rose-500 text-white"
}

function QuickOrderSheet({
  orderModal,
  orderQty,
  orderStopLoss,
  stopLossConfirmed,
  requireStopLossConfirmation,
  orderMsg,
  orderLoading,
  balance,
  onClose,
  onChangeQty,
  onChangeStopLoss,
  onConfirmStopLoss,
  onSetBuyPercent,
  onSetSellPercent,
  onSubmit,
}) {
  if (!orderModal) return null

  const { stock, side, holding } = orderModal
  const numericQty = Number(orderQty || 0)
  const estimatedAmount = Number(stock.price || 0) * numericQty
  const availableSellQty = Number(holding?.orderable_quantity ?? holding?.quantity ?? 0)
  const orderTone = side === "buy" ? "buy" : "sell"
  const exceedsCash = side === "buy" && balance && estimatedAmount > Number(balance.orderable_cash || 0)

  const numericStopLoss = Number(orderStopLoss || 0)
  const invalidStopLoss =
    side === "buy" && (!numericStopLoss || numericStopLoss <= 0 || numericStopLoss >= Number(stock.price || 0))
  const buyBlocked = side === "buy" && requireStopLossConfirmation && (invalidStopLoss || !stopLossConfirmed)
  const stopLossTick = getTickSize(numericStopLoss || Number(stock.price || 0))

  const adjustStopLossByTick = (direction, steps) => {
    const baseValue = Number(orderStopLoss || stock.stop_loss || 0)
    const tick = getTickSize(baseValue || Number(stock.price || 0))
    const delta = tick * steps
    const nextValue = direction === "up" ? baseValue + delta : Math.max(0, baseValue - delta)
    onChangeStopLoss(String(roundToTick(nextValue)))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 px-4 py-4 backdrop-blur-sm xl:items-center">
      <div className="w-full max-w-4xl rounded-[28px] border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Quick Order</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h3 className="text-2xl font-black text-white">{stock.name}</h3>
              <span className="text-sm text-slate-400">{stock.symbol}</span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  side === "buy" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
                }`}
              >
                {side === "buy" ? "매수 준비" : "매도 준비"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            닫기
          </button>
        </div>

        <div className="grid gap-6 px-6 py-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">주문 가격</p>
                <p className="mt-3 text-3xl font-black text-white">{formatCurrency(stock.price)}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">예상 주문 금액</p>
                <p className="mt-3 text-3xl font-black text-white">{formatCurrency(estimatedAmount)}</p>
                {side === "buy" && balance && (
                  <p className="mt-2 text-xs text-slate-500">주문 가능 {formatCurrency(balance.orderable_cash || 0)}</p>
                )}
                {side === "sell" && holding && (
                  <p className="mt-2 text-xs text-slate-500">매도 가능 {formatNumber(availableSellQty)}주</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-semibold text-slate-200">주문 수량</label>
                {side === "sell" && holding && (
                  <p className="text-xs text-slate-500">
                    보유 {formatNumber(holding.quantity)}주 / 매도 가능 {formatNumber(availableSellQty)}주
                  </p>
                )}
              </div>
              <input
                type="number"
                value={orderQty}
                onChange={(event) => onChangeQty(event.target.value)}
                className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-4 text-center text-2xl font-black text-white outline-none transition focus:border-emerald-500"
              />
              <div className="mt-3 grid grid-cols-4 gap-2">
                {side === "buy" ? (
                  <>
                    <button type="button" onClick={() => onChangeQty("1")} className={`rounded-xl px-3 py-3 text-sm font-semibold transition ${buttonClass(orderQty === "1", orderTone)}`}>1주</button>
                    <button type="button" onClick={() => onSetBuyPercent(10)} className={`rounded-xl px-3 py-3 text-sm font-semibold transition ${buttonClass(false, orderTone)}`}>10%</button>
                    <button type="button" onClick={() => onSetBuyPercent(25)} className={`rounded-xl px-3 py-3 text-sm font-semibold transition ${buttonClass(false, orderTone)}`}>25%</button>
                    <button type="button" onClick={() => onSetBuyPercent(50)} className={`rounded-xl px-3 py-3 text-sm font-semibold transition ${buttonClass(false, orderTone)}`}>50%</button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => onSetSellPercent(25)} className={`rounded-xl px-3 py-3 text-sm font-semibold transition ${buttonClass(false, orderTone)}`}>25%</button>
                    <button type="button" onClick={() => onSetSellPercent(50)} className={`rounded-xl px-3 py-3 text-sm font-semibold transition ${buttonClass(false, orderTone)}`}>50%</button>
                    <button type="button" onClick={() => onSetSellPercent(75)} className={`rounded-xl px-3 py-3 text-sm font-semibold transition ${buttonClass(false, orderTone)}`}>75%</button>
                    <button type="button" onClick={() => onSetSellPercent(100)} className={`rounded-xl px-3 py-3 text-sm font-semibold transition ${buttonClass(false, orderTone)}`}>전량</button>
                  </>
                )}
              </div>
              {exceedsCash && (
                <p className="mt-3 text-xs text-amber-300">
                  주문 가능 금액을 초과했습니다. 수량을 줄이거나 직접 주문 화면에서 다시 확인해 주세요.
                </p>
              )}
            </div>

            {orderMsg && (
              <div
                className={`rounded-2xl border px-4 py-4 text-sm leading-6 ${
                  orderMsg.type === "success"
                    ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-200"
                    : "border-rose-500/30 bg-rose-950/40 text-rose-200"
                }`}
              >
                {orderMsg.text}
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">주문 판단 정보</p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">현재가</span>
                  <span className="font-semibold text-white">{formatCurrency(stock.price)}</span>
                </div>

                {side === "buy" && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">손절가</span>
                      <span className={`font-semibold ${invalidStopLoss ? "text-amber-300" : "text-rose-300"}`}>
                        {formatCurrency(orderStopLoss || 0)}
                      </span>
                    </div>

                    {requireStopLossConfirmation ? (
                      <>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={orderStopLoss}
                          onChange={(event) => onChangeStopLoss(event.target.value.replace(/[^0-9]/g, ""))}
                          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-right text-sm font-semibold text-white outline-none transition focus:border-emerald-500"
                        />
                        <div className="grid grid-cols-4 gap-2">
                          <button type="button" onClick={() => adjustStopLossByTick("down", 5)} className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800">-5틱</button>
                          <button type="button" onClick={() => adjustStopLossByTick("down", 1)} className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800">-1틱</button>
                          <button type="button" onClick={() => adjustStopLossByTick("up", 1)} className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800">+1틱</button>
                          <button type="button" onClick={() => adjustStopLossByTick("up", 5)} className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800">+5틱</button>
                        </div>
                        <button
                          type="button"
                          onClick={onConfirmStopLoss}
                          disabled={invalidStopLoss}
                          className={`w-full rounded-xl px-3 py-3 text-sm font-semibold transition ${
                            stopLossConfirmed
                              ? "bg-emerald-500 text-slate-950"
                              : "border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                          } disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-950 disabled:text-slate-500`}
                        >
                          {stopLossConfirmed ? "손절가 확인 완료" : "손절가 확인"}
                        </button>
                        <p className={`text-xs ${invalidStopLoss ? "text-amber-300" : "text-slate-500"}`}>
                          {invalidStopLoss
                            ? "손절가는 0보다 크고 현재 매수가보다 낮아야 합니다."
                            : `추천 손절가를 그대로 보내지 않고, 이 값을 직접 확인해야 주문할 수 있습니다. 현재 호가 단위 ${formatNumber(stopLossTick)}원`}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-slate-500">
                        현재 설정에서는 손절가 확인 없이 빠른 매수가 가능합니다. 표시된 값은 스캔 추천 손절가입니다.
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">익절가</span>
                      <span className="font-semibold text-emerald-300">{formatCurrency(stock.take_profit || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">R:R</span>
                      <span className="font-semibold text-amber-300">{stock.rr_ratio || "-"}</span>
                    </div>
                  </>
                )}

                {holding && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">현재 보유</span>
                    <span className="font-semibold text-amber-300">{formatNumber(holding.quantity)}주</span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-sm leading-6 text-slate-300">
              {side === "buy"
                ? requireStopLossConfirmation
                  ? "스캔 화면에서는 가격과 손절/익절 정보는 그대로 유지하고, 수량만 빠르게 결정하는 흐름이 가장 안전합니다. 현재 설정에서는 손절가를 직접 확인한 뒤에만 빠른 매수가 접수됩니다."
                  : "현재 설정에서는 손절가 없는 매수 차단이 꺼져 있으므로, 빠른 매수에서 손절가 확인을 강제하지 않습니다."
                : "매도는 보유/매도가능 수량을 먼저 확인하고, 부분매도보다 전량 버튼이 항상 눈에 먼저 들어와야 합니다."}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-4 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
              >
                취소
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={orderLoading || buyBlocked}
                className={`flex-1 rounded-2xl px-4 py-4 text-sm font-bold transition ${
                  side === "buy"
                    ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                    : "bg-rose-500 text-white hover:bg-rose-400"
                } disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400`}
              >
                {orderLoading
                  ? "전송 중..."
                  : side === "buy" && buyBlocked
                    ? "손절가 확인 필요"
                    : side === "buy"
                      ? "빠른 매수 실행"
                      : "빠른 매도 실행"}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

export default QuickOrderSheet
