import { formatCurrency, formatNumber, modeBadgeClass, modeLabel } from "../../utils/formatters"
import { getTickSize } from "../../utils/trading"

function OrderPanel({
  tradeMode,
  side,
  onModeChange,
  onSideChange,
  search,
  setSearch,
  searchResults,
  onSearch,
  onSelectSearchResult,
  symbol,
  name,
  price,
  setPrice,
  quantity,
  setQuantity,
  stopLoss,
  setStopLoss,
  takeProfit,
  setTakeProfit,
  onAdjustPrice,
  onSetQuantityByPercent,
  onClear,
  onSubmit,
  submitting,
  balance,
  selectedPosition,
  orderAmount,
  allocationPct,
  riskAmount,
}) {
  const numericPrice = Number(price || 0)

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5">
      <div className="flex flex-wrap gap-2">
        {["paper", "real"].map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onModeChange(mode)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tradeMode === mode
                ? modeBadgeClass(mode)
                : "border border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            {modeLabel(mode)}
          </button>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        {["buy", "sell"].map((orderSide) => (
          <button
            key={orderSide}
            type="button"
            onClick={() => onSideChange(orderSide)}
            className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold transition ${
              side === orderSide
                ? orderSide === "buy"
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-rose-500 text-white"
                : "border border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            {orderSide === "buy" ? "매수" : "매도"}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        <div className="relative" onClick={(event) => event.stopPropagation()}>
          <label className="mb-2 block text-sm font-medium text-slate-300">종목 검색</label>
          <div className="flex gap-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onSearch()
              }}
              placeholder="종목명 또는 6자리 코드"
              className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={onSearch}
              className="rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              검색
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
              {searchResults.map((item) => (
                <button
                  key={item.symbol}
                  type="button"
                  onClick={() => onSelectSearchResult(item)}
                  className="flex w-full items-center justify-between border-b border-slate-800 px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-slate-800 last:border-b-0"
                >
                  <span>{item.name}</span>
                  <span className="text-slate-400">{item.symbol}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {(name || symbol) && (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3">
            <p className="font-bold text-white">{name || symbol}</p>
            <p className="mt-1 text-sm text-slate-400">{symbol}</p>
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">
            주문 가격
            {numericPrice > 0 && (
              <span className="ml-2 text-xs text-slate-500">틱 단위 {formatNumber(getTickSize(numericPrice))}원</span>
            )}
          </label>
          <div className="flex gap-2">
            <input
              value={price}
              onChange={(event) => setPrice(event.target.value.replace(/,/g, ""))}
              inputMode="numeric"
              placeholder="0"
              className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-center text-lg font-bold text-white outline-none transition focus:border-emerald-500"
            />
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => onAdjustPrice("up")}
                className="rounded-xl bg-emerald-600 px-3 py-3 text-sm font-bold text-white transition hover:bg-emerald-500"
              >
                +틱
              </button>
              <button
                type="button"
                onClick={() => onAdjustPrice("down")}
                className="rounded-xl bg-rose-600 px-3 py-3 text-sm font-bold text-white transition hover:bg-rose-500"
              >
                -틱
              </button>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-slate-300">수량</label>
            {side === "sell" && selectedPosition && (
              <span className="text-xs text-slate-500">
                보유 {selectedPosition.quantity}주
                {Number(selectedPosition.orderable_quantity ?? selectedPosition.quantity ?? 0) !== Number(selectedPosition.quantity)
                  ? ` / 매도 가능 ${selectedPosition.orderable_quantity}주`
                  : ""}
              </span>
            )}
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[10, 25, 50, 75, 100].map((percent) => (
              <button
                key={percent}
                type="button"
                onClick={() => onSetQuantityByPercent(percent)}
                className="rounded-xl border border-slate-700 bg-slate-900 px-2 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
              >
                {percent}%
              </button>
            ))}
          </div>
          <input
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            type="number"
            placeholder="직접 입력"
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-center text-sm text-white outline-none transition focus:border-emerald-500"
          />
        </div>

        {side === "buy" && (
          <div className="grid gap-4 xl:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">손절가</label>
              <input
                value={stopLoss}
                onChange={(event) => setStopLoss(event.target.value)}
                type="number"
                placeholder="필수"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">익절가</label>
              <input
                value={takeProfit}
                onChange={(event) => setTakeProfit(event.target.value)}
                type="number"
                placeholder="선택"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500"
              />
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">예상 주문 금액</span>
            <span className="font-semibold text-white">{formatCurrency(orderAmount)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-slate-400">주문 가능 대비 비중</span>
            <span className="font-semibold text-slate-200">{allocationPct}%</span>
          </div>
          {side === "buy" && riskAmount > 0 && (
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-slate-400">손절 기준 총 리스크</span>
              <span className="font-semibold text-rose-300">{formatCurrency(riskAmount)}</span>
            </div>
          )}
          {balance?.orderable_cash === 0 && (
            <p className="mt-2 text-xs text-amber-300">주문 가능 금액이 0원으로 표시됩니다. 잔고 상태를 다시 확인하세요.</p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClear}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
          >
            입력 초기화
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold transition ${
              side === "buy"
                ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                : "bg-rose-500 text-white hover:bg-rose-400"
            } disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400`}
          >
            {submitting ? "주문 전송 중..." : side === "buy" ? "매수 주문" : "매도 주문"}
          </button>
        </div>
      </div>
    </section>
  )
}

export default OrderPanel
