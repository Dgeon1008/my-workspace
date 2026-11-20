import { useEffect, useState } from "react"

import client from "../api/client"
import { formatCurrency, formatTime, modeBadgeClass, modeLabel } from "../utils/formatters"

function SummaryCard({ label, value, helper, tone = "text-white" }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-3 text-3xl font-black ${tone}`}>{value}</p>
      {helper && <p className="mt-2 text-xs text-slate-500">{helper}</p>}
    </div>
  )
}

function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let ignore = false

    const fetchSummary = async () => {
      try {
        const { data: summary } = await client.get("/dashboard/summary")
        if (!ignore) {
          setData(summary)
          setError(false)
        }
      } catch {
        if (!ignore) {
          setData(null)
          setError(true)
        }
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    fetchSummary()
    const timer = setInterval(fetchSummary, 30000)
    return () => {
      ignore = true
      clearInterval(timer)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="animate-pulse text-slate-400">대시보드 데이터를 불러오는 중입니다.</p>
      </div>
    )
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-amber-500/30 bg-amber-950/30 p-6">
        <h2 className="text-lg font-bold text-amber-100">Trading App 서버에 연결할 수 없습니다.</h2>
        <p className="mt-2 text-sm leading-6 text-amber-200/80">
          로컬 FastAPI 서버가 실행 중인지 확인해 주세요. 설정된 주소는 NEXT_PUBLIC_TRADING_API_URL이며 기본값은 http://127.0.0.1:8000 입니다.
        </p>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Dashboard</p>
          <h2 className="mt-2 text-3xl font-black text-white">장중 요약</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-xl px-3 py-2 text-sm font-semibold ${modeBadgeClass(data?.mode)}`}>
            {modeLabel(data?.mode)}
          </span>
          <span className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300">
            마지막 갱신 {formatTime(data?.server_time)}
          </span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <SummaryCard label="오늘 매수 신호" value={data?.buy_signals ?? 0} tone="text-emerald-400" />
        <SummaryCard label="오늘 매도 신호" value={data?.sell_signals ?? 0} tone="text-rose-400" />
        <SummaryCard label="보유 포지션 수" value={data?.position_count ?? 0} helper="현재 주문 모드 기준" />
        <SummaryCard label="오늘 거래 수" value={data?.today_trades ?? 0} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SummaryCard
          label="오늘 순손익"
          value={formatCurrency(data?.today_pnl ?? 0)}
          helper="matched sell only"
          tone={(data?.today_pnl ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}
        />
        <SummaryCard
          label="누적 순손익"
          value={formatCurrency(data?.total_pnl ?? 0)}
          helper="fee/tax settings applied"
          tone={(data?.total_pnl ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}
        />
        <SummaryCard
          label="승률"
          value={`${data?.win_rate ?? 0}%`}
          helper="matched sell only"
          tone={(data?.win_rate ?? 0) >= 50 ? "text-emerald-400" : "text-amber-300"}
        />
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-white">최근 신호 5개</h3>
            <p className="mt-1 text-sm text-slate-400">장중 판단용 최근 후보 흐름입니다.</p>
          </div>
        </div>

        {data?.recent_signals?.length ? (
          <div className="mt-5 space-y-3">
            {data.recent_signals.map((signal) => (
              <div
                key={`${signal.symbol}-${signal.created_at}-${signal.signal_type}`}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-4"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      signal.signal_type === "buy"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-rose-500/15 text-rose-300"
                    }`}
                  >
                    {signal.signal_type === "buy" ? "매수" : "매도"}
                  </span>
                  <div>
                    <p className="font-bold text-white">{signal.name || signal.symbol}</p>
                    <p className="text-sm text-slate-400">{signal.symbol}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-white">{formatCurrency(signal.price)}</p>
                  <p className="text-sm text-slate-400">{formatTime(signal.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-slate-700 px-4 py-10 text-center text-slate-500">
            최근 신호가 없습니다.
          </div>
        )}
      </section>
    </div>
  )
}

export default Dashboard
