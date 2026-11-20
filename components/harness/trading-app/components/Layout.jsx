import { useEffect, useState } from "react"

import client from "../api/client"
import { formatTime, modeBadgeClass, modeLabel } from "../utils/formatters"

const menus = [
  { id: "dashboard", label: "대시보드" },
  { id: "scan", label: "스캔" },
  { id: "trade", label: "매매" },
  { id: "analysis", label: "분석" },
  { id: "settings", label: "설정" },
]

function StatusChip({ label, value, className = "" }) {
  return (
    <div className={`rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 ${className}`}>
      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-xs font-semibold text-white">{value}</p>
    </div>
  )
}

function Layout({ activePage, onNavigate, children }) {
  const [status, setStatus] = useState(null)

  useEffect(() => {
    let ignore = false

    const fetchStatus = async () => {
      try {
        const [{ data: health }, { data: runtime }] = await Promise.all([
          client.get("/health"),
          client.get("/dashboard/status"),
        ])

        if (ignore) return
        setStatus({
          serverOk: health.status === "healthy" && runtime.server_ok,
          tradeMode: runtime.trade_mode,
          marketOpen: runtime.market_open,
          autoScanRunning: runtime.auto_scan_running,
          autoScanInterval: runtime.auto_scan_interval,
          autoScanLastRunAt: runtime.auto_scan_last_run_at,
          autoScanLastError: runtime.auto_scan_last_error,
          serverTime: runtime.server_time,
        })
      } catch {
        if (!ignore) setStatus((previous) => ({ ...previous, serverOk: false }))
      }
    }

    void fetchStatus()
    const timer = setInterval(fetchStatus, 15000)
    return () => {
      ignore = true
      clearInterval(timer)
    }
  }, [])

  return (
    <div className="trading-app flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 lg:px-7">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-400">KR Trading</p>
            <h1 className="mt-1 text-lg font-black text-white">Trading App</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusChip
              label="Order Mode"
              value={status?.tradeMode ? modeLabel(status.tradeMode) : "-"}
              className={status?.tradeMode ? modeBadgeClass(status.tradeMode) : ""}
            />
            <StatusChip
              label="Market"
              value={status?.marketOpen ? "개장 중" : "장 외 시간"}
              className={status?.marketOpen ? "border-emerald-500/30" : "border-amber-500/30"}
            />
            <StatusChip
              label="Server"
              value={status?.serverOk ? "정상 연결" : "확인 필요"}
              className={status?.serverOk ? "border-emerald-500/30" : "border-red-500/30"}
            />
            <StatusChip label="Last Sync" value={status?.serverTime ? formatTime(status.serverTime) : "-"}/>
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto px-4 pb-3 lg:px-7" aria-label="Trading App 메뉴">
          {menus.map((menu) => (
            <button
              key={menu.id}
              type="button"
              aria-pressed={activePage === menu.id}
              onClick={() => onNavigate(menu.id)}
              className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                activePage === menu.id
                  ? "bg-emerald-500 text-slate-950"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {menu.label}
            </button>
          ))}
        </nav>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-slate-800/70 px-4 py-2 text-[11px] text-slate-500 lg:px-7">
          <span>자동 스캔 {status?.autoScanRunning ? `${status.autoScanInterval}분 주기 실행 중` : "중지됨"}</span>
          <span>마지막 자동 스캔 {status?.autoScanLastRunAt ? formatTime(status.autoScanLastRunAt) : "-"}</span>
          {status?.autoScanLastError && <span className="max-w-full truncate text-red-300">오류: {status.autoScanLastError}</span>}
        </div>
      </header>

      <div className="min-w-0 flex-1 px-4 py-6 lg:px-7">{children}</div>
    </div>
  )
}

export default Layout
