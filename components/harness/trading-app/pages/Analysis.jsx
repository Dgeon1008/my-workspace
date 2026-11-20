import { useEffect, useState } from "react"

import client from "../api/client"
import { formatCurrency, formatDateTime, modeBadgeClass, modeLabel } from "../utils/formatters"

function MetricCard({ label, value, helper, tone = "text-white" }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-3 text-3xl font-black ${tone}`}>{value}</p>
      {helper && <p className="mt-2 text-xs text-slate-500">{helper}</p>}
    </div>
  )
}

function Analysis() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState("paper")

  useEffect(() => {
    let ignore = false

    const fetchHistory = async () => {
      setLoading(true)
      try {
        const { data } = await client.get(`/trade/history?mode=${viewMode}`)
        if (!ignore) setHistory(data)
      } catch {
        if (!ignore) setHistory([])
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    fetchHistory()
    return () => {
      ignore = true
    }
  }, [viewMode])

  const sellTrades = history.filter((trade) => trade.trade_type === "sell")
  const eligibleSellTrades = sellTrades.filter((trade) => Number(trade.analysis_eligible ?? 1) === 1)
  const excludedSellTrades = sellTrades.filter((trade) => Number(trade.analysis_eligible ?? 1) !== 1)
  const winTrades = eligibleSellTrades.filter((trade) => Number(trade.pnl || 0) > 0)
  const loseTrades = eligibleSellTrades.filter((trade) => Number(trade.pnl || 0) <= 0)
  const winRate = eligibleSellTrades.length ? ((winTrades.length / eligibleSellTrades.length) * 100).toFixed(1) : "0.0"
  const totalPnl = eligibleSellTrades.reduce((sum, trade) => sum + Number(trade.pnl || 0), 0)
  const averagePnlPct = eligibleSellTrades.length
    ? (
        eligibleSellTrades.reduce((sum, trade) => sum + Number(trade.pnl_pct || 0), 0) / eligibleSellTrades.length
      ).toFixed(2)
    : "0.00"
  const averageWin = winTrades.length
    ? (winTrades.reduce((sum, trade) => sum + Number(trade.pnl_pct || 0), 0) / winTrades.length).toFixed(2)
    : "0.00"
  const averageLoss = loseTrades.length
    ? (loseTrades.reduce((sum, trade) => sum + Number(trade.pnl_pct || 0), 0) / loseTrades.length).toFixed(2)
    : "0.00"

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Analysis</p>
          <h2 className="mt-2 text-3xl font-black text-white">매매 성과 분석</h2>
          <p className="mt-2 text-sm text-slate-400">
            이 화면은 분석 필터만 바꾸며 실제 주문 모드는 변경하지 않습니다.
          </p>
        </div>
        <div className="flex gap-2 rounded-2xl border border-slate-800 bg-slate-900/90 p-2">
          {["paper", "real"].map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                viewMode === mode
                  ? modeBadgeClass(mode)
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {modeLabel(mode)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <p className="animate-pulse text-slate-400">분석 데이터를 계산하는 중입니다.</p>
        </div>
      ) : eligibleSellTrades.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-16 text-center">
          <p className="text-lg font-semibold text-slate-200">
            {modeLabel(viewMode)} 기준 분석 가능한 매도 이력이 없습니다.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            앱 기준 매수-매도 쌍이 확인된 거래만 성과 통계에 포함합니다.
          </p>
          {excludedSellTrades.length > 0 && (
            <p className="mt-3 text-sm text-amber-300">
              제외된 매도 {excludedSellTrades.length}건은 외부 보유 청산 또는 매칭 불가 이력입니다.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-5">
            <MetricCard label="분석 포함 매도" value={eligibleSellTrades.length} helper="matched trade only" />
            <MetricCard
              label="제외된 매도"
              value={excludedSellTrades.length}
              helper="외부 보유/매칭 불가"
              tone={excludedSellTrades.length > 0 ? "text-amber-300" : "text-slate-300"}
            />
            <MetricCard
              label="승률"
              value={`${winRate}%`}
              helper={`${winTrades.length}승 / ${loseTrades.length}패`}
              tone={Number(winRate) >= 50 ? "text-emerald-400" : "text-amber-300"}
            />
            <MetricCard
              label="누적 순손익"
              value={formatCurrency(totalPnl)}
              helper="fee settings 적용값"
              tone={totalPnl >= 0 ? "text-emerald-400" : "text-rose-400"}
            />
            <MetricCard
              label="평균 손익률"
              value={`${Number(averagePnlPct) >= 0 ? "+" : ""}${averagePnlPct}%`}
              tone={Number(averagePnlPct) >= 0 ? "text-emerald-400" : "text-rose-400"}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <MetricCard label="평균 익절률" value={`+${averageWin}%`} tone="text-emerald-400" />
            <MetricCard label="평균 손절률" value={`${averageLoss}%`} tone="text-rose-400" />
          </div>

          {excludedSellTrades.length > 0 && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-950/30 px-5 py-4 text-sm leading-6 text-amber-100">
              제외된 매도는 성과 통계에서 뺐습니다. 앱이 만든 포지션이 아닌 외부 보유 청산, 혼합 보유,
              또는 대응 매수가 없는 이력이 섞이면 수익화 판단이 왜곡되기 때문입니다.
            </div>
          )}

          <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5">
            <h3 className="text-xl font-bold text-white">최근 분석 포함 매도 이력</h3>
            <div className="mt-5 space-y-3">
              {eligibleSellTrades.map((trade) => (
                <div
                  key={trade.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-4"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        Number(trade.pnl || 0) > 0
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-rose-500/15 text-rose-300"
                      }`}
                    >
                      {Number(trade.pnl || 0) > 0 ? "익절" : "손절"}
                    </span>
                    <div>
                      <p className="font-bold text-white">{trade.name || trade.symbol}</p>
                      <p className="text-sm text-slate-400">{trade.symbol}</p>
                    </div>
                  </div>
                  <div className="grid min-w-[320px] grid-cols-2 gap-3 text-sm xl:grid-cols-5">
                    <div>
                      <p className="text-slate-500">매도가</p>
                      <p className="mt-1 font-semibold text-white">{formatCurrency(trade.price)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">수량</p>
                      <p className="mt-1 font-semibold text-white">{trade.quantity}주</p>
                    </div>
                    <div>
                      <p className="text-slate-500">순손익</p>
                      <p className={`mt-1 font-semibold ${Number(trade.pnl || 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {formatCurrency(trade.pnl || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">수수료</p>
                      <p className="mt-1 font-semibold text-slate-300">
                        {formatCurrency(Number(trade.fee || 0))}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">체결 시각</p>
                      <p className="mt-1 font-semibold text-slate-300">{formatDateTime(trade.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export default Analysis
