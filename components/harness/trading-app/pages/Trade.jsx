import { useEffect, useState } from "react"

import client from "../api/client"
import ConfirmationDialog from "../components/ConfirmationDialog"
import HistoryPanel from "../components/trade/HistoryPanel"
import OrderPanel from "../components/trade/OrderPanel"
import PositionsPanel from "../components/trade/PositionsPanel"
import { formatCurrency, formatDateTime, modeBadgeClass, modeLabel } from "../utils/formatters"
import { getTickSize, roundToTick } from "../utils/trading"

const AUTO_REFRESH_MS = 20000

function messageClass(type) {
  if (type === "success") return "border-emerald-500/30 bg-emerald-950/40 text-emerald-200"
  if (type === "info") return "border-sky-500/30 bg-sky-950/40 text-sky-200"
  return "border-rose-500/30 bg-rose-950/40 text-rose-200"
}

function Trade() {
  const [tradeMode, setTradeMode] = useState("paper")
  const [side, setSide] = useState("buy")
  const [symbol, setSymbol] = useState("")
  const [name, setName] = useState("")
  const [price, setPrice] = useState("")
  const [quantity, setQuantity] = useState("")
  const [stopLoss, setStopLoss] = useState("")
  const [takeProfit, setTakeProfit] = useState("")
  const [search, setSearch] = useState("")
  const [searchResults, setSearchResults] = useState([])
  const [balance, setBalance] = useState(null)
  const [positions, setPositions] = useState([])
  const [positionsStatus, setPositionsStatus] = useState({
    brokerSynced: true,
    error: "",
    orphanLocalCount: 0,
    pendingOrderCount: 0,
    unmatchedSymbols: [],
    fillSyncError: "",
  })
  const [history, setHistory] = useState([])
  const [currentPrices, setCurrentPrices] = useState({})
  const [tab, setTab] = useState("position")
  const [pageLoading, setPageLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null)
  const [lastRefreshAt, setLastRefreshAt] = useState("")
  const [editingPosition, setEditingPosition] = useState(null)
  const [editTakeProfit, setEditTakeProfit] = useState("")
  const [editStopLoss, setEditStopLoss] = useState("")
  const [pendingModeSwitch, setPendingModeSwitch] = useState(null)
  const [confirmOrder, setConfirmOrder] = useState(null)

  const selectedPosition = positions.find((position) => position.symbol === symbol)
  const numericPrice = Number(price || 0)
  const numericQuantity = Number(quantity || 0)
  const numericStopLoss = Number(stopLoss || 0)
  const orderAmount = numericPrice * numericQuantity
  const allocationPct = balance?.orderable_cash
    ? ((orderAmount / Number(balance.orderable_cash)) * 100).toFixed(1)
    : "0.0"
  const riskAmount =
    side === "buy" && numericPrice > 0 && numericStopLoss > 0 && numericStopLoss < numericPrice
      ? (numericPrice - numericStopLoss) * numericQuantity
      : 0

  useEffect(() => {
    const closeDropdown = () => setSearchResults([])
    document.addEventListener("click", closeDropdown)
    return () => document.removeEventListener("click", closeDropdown)
  }, [])

  useEffect(() => {
    let ignore = false

    const initialize = async () => {
      setPageLoading(true)
      try {
        const { data } = await client.get("/trade/mode")
        if (ignore) return
        setTradeMode(data.mode)
        await refreshTradeData(data.mode, true)
      } finally {
        if (!ignore) setPageLoading(false)
      }
    }

    initialize()
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    if (!tradeMode) return undefined
    const timer = setInterval(() => {
      refreshTradeData(tradeMode, true)
    }, AUTO_REFRESH_MS)
    return () => clearInterval(timer)
  }, [tradeMode])

  const fetchCurrentPrices = async (positionList) => {
    if (!positionList.length) {
      setCurrentPrices({})
      return
    }

    const entries = await Promise.all(
      positionList.map(async (position) => {
        try {
          const { data } = await client.get(`/market/price/${position.symbol}`)
          return [position.symbol, data.price || position.entry_price]
        } catch {
          return [position.symbol, position.entry_price]
        }
      }),
    )

    setCurrentPrices(Object.fromEntries(entries))
  }

  const refreshTradeData = async (modeOverride = tradeMode, silent = false) => {
    if (!silent) setRefreshing(true)

    try {
      const [snapshotResponse, historyResponse] = await Promise.all([
        client.get("/trade/snapshot"),
        client.get(`/trade/history?mode=${modeOverride}`),
      ])

      const snapshot = snapshotResponse.data || {}
      const positionsPayload = snapshot.positions || {}
      const nextPositions = positionsPayload.items || []

      setBalance(snapshot.balance || null)
      setPositions(nextPositions)
      setPositionsStatus({
        brokerSynced: positionsPayload.broker_synced !== false,
        error: positionsPayload.error || "",
        orphanLocalCount: Number(positionsPayload.orphan_local_count || 0),
        pendingOrderCount: Number(positionsPayload.pending_order_count || 0),
        unmatchedSymbols: Array.isArray(positionsPayload.unmatched_symbols)
          ? positionsPayload.unmatched_symbols
          : [],
        fillSyncError: positionsPayload.fill_sync_error || "",
      })
      setHistory(historyResponse.data)
      await fetchCurrentPrices(nextPositions)
      setLastRefreshAt(new Date().toISOString())
    } catch {
      setMessage({ type: "error", text: "잔고 또는 포지션 데이터를 새로고침하지 못했습니다." })
    } finally {
      if (!silent) setRefreshing(false)
    }
  }

  const applyTradeMode = async (nextMode) => {
    try {
      await client.post(`/settings/update?key=trade_mode&value=${nextMode}`)
      setTradeMode(nextMode)
      setPendingModeSwitch(null)
      setMessage({ type: "info", text: `${modeLabel(nextMode)}로 주문 모드를 변경했습니다.` })
      await refreshTradeData(nextMode, true)
    } catch {
      setMessage({ type: "error", text: "주문 모드 변경에 실패했습니다." })
    }
  }

  const handleSearch = async () => {
    const keyword = search.trim()
    if (!keyword) return
    try {
      if (/^\d{6}$/.test(keyword)) {
        await fetchPrice(keyword)
        setSearchResults([])
        return
      }
      const { data } = await client.get(`/market/search/${keyword}`)
      setSearchResults(data)
    } catch {
      setMessage({ type: "error", text: "종목 검색에 실패했습니다." })
    }
  }

  const fetchPrice = async (targetSymbol = symbol) => {
    if (!targetSymbol) return
    try {
      const { data } = await client.get(`/market/price/${targetSymbol}`)
      if (!data?.price) {
        setMessage({ type: "error", text: "현재가를 가져오지 못했습니다." })
        return
      }
      setSymbol(targetSymbol)
      setName(data.name || name || targetSymbol)
      setSearch(data.name || targetSymbol)
      setPrice(String(roundToTick(data.price)))
    } catch {
      setMessage({ type: "error", text: "현재가 조회에 실패했습니다." })
    }
  }

  const selectSearchResult = async (item) => {
    setSymbol(item.symbol)
    setName(item.name)
    setSearch(item.name)
    setSearchResults([])
    await fetchPrice(item.symbol)
  }

  const adjustPrice = (direction) => {
    if (!numericPrice) return
    const tick = getTickSize(numericPrice)
    const next = direction === "up" ? numericPrice + tick : Math.max(0, numericPrice - tick)
    setPrice(String(roundToTick(next)))
  }

  const setQuantityByPercent = (percent) => {
    if (side === "sell") {
      if (!selectedPosition) return
      const sellableQuantity = Number(selectedPosition.orderable_quantity ?? selectedPosition.quantity ?? 0)
      const computed = Math.max(1, Math.floor((sellableQuantity * percent) / 100))
      setQuantity(String(percent === 100 ? sellableQuantity : computed))
      return
    }

    if (!numericPrice || !balance?.orderable_cash) return
    const computed = Math.max(
      1,
      Math.floor((Number(balance.orderable_cash) * (percent / 100)) / numericPrice),
    )
    setQuantity(String(computed))
  }

  const clearOrderForm = () => {
    setSide("buy")
    setSymbol("")
    setName("")
    setPrice("")
    setQuantity("")
    setStopLoss("")
    setTakeProfit("")
    setSearch("")
    setSearchResults([])
  }

  const prepareSellOrder = (position, percent = 100) => {
    const basePrice = currentPrices[position.symbol] || position.entry_price
    const sellableQuantity = Number(position.orderable_quantity ?? position.quantity ?? 0)
    const preparedQuantity =
      percent === 100 ? sellableQuantity : Math.max(1, Math.floor((sellableQuantity * percent) / 100))

    setSide("sell")
    setSymbol(position.symbol)
    setName(position.name)
    setSearch(position.name || position.symbol)
    setPrice(String(roundToTick(basePrice)))
    setQuantity(String(preparedQuantity))
    setStopLoss("")
    setTakeProfit("")
    setMessage({ type: "info", text: `${position.name || position.symbol} 매도 주문창을 채웠습니다.` })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const toggleEditPosition = (position) => {
    if (editingPosition === position.symbol) {
      setEditingPosition(null)
      return
    }
    setEditingPosition(position.symbol)
    setEditTakeProfit(String(position.take_profit || ""))
    setEditStopLoss(String(position.stop_loss || ""))
  }

  const savePositionTargets = async (position) => {
    try {
      await client.post("/trade/position/update", {
        symbol: position.symbol,
        take_profit: Number(editTakeProfit || 0),
        stop_loss: Number(editStopLoss || 0),
      })
      setEditingPosition(null)
      setMessage({ type: "success", text: `${position.name || position.symbol} 목표가를 수정했습니다.` })
      await refreshTradeData(tradeMode, true)
    } catch {
      setMessage({ type: "error", text: "포지션 목표가 수정에 실패했습니다." })
    }
  }

  const buildOrderPayload = () => ({
    symbol,
    name,
    side,
    price: roundToTick(Number(price || 0)),
    quantity: Number(quantity || 0),
    stop_loss: Number(stopLoss || 0),
    take_profit: Number(takeProfit || 0),
  })

  const executeOrder = async (payload) => {
    setSubmitting(true)
    setMessage(null)
    try {
      const { data } = await client.post("/trade/order", payload)
      if (!data.success) {
        setMessage({ type: "error", text: data.message })
        return
      }
      setConfirmOrder(null)
      setMessage({ type: "success", text: data.message })
      await refreshTradeData(tradeMode, true)
      setQuantity("")
      if (payload.side === "buy") {
        setStopLoss("")
        setTakeProfit("")
      }
    } catch {
      setMessage({ type: "error", text: "주문 요청 중 오류가 발생했습니다." })
    } finally {
      setSubmitting(false)
    }
  }

  const submitOrder = async () => {
    if (!symbol) return setMessage({ type: "error", text: "종목을 먼저 선택하세요." })
    if (!numericPrice || numericPrice <= 0) return setMessage({ type: "error", text: "주문 가격을 확인하세요." })
    if (!numericQuantity || numericQuantity <= 0) return setMessage({ type: "error", text: "주문 수량을 입력하세요." })
    if (side === "buy" && (!numericStopLoss || numericStopLoss >= numericPrice)) {
      return setMessage({ type: "error", text: "매수 주문에는 유효한 손절가가 필요합니다." })
    }
    if (
      side === "sell" &&
      selectedPosition &&
      numericQuantity > Number(selectedPosition.orderable_quantity ?? selectedPosition.quantity ?? 0)
    ) {
      return setMessage({ type: "error", text: "보유 수량을 초과한 매도 주문입니다." })
    }

    const payload = buildOrderPayload()
    if (tradeMode === "real") {
      setConfirmOrder(payload)
      return
    }
    await executeOrder(payload)
  }

  if (pageLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="animate-pulse text-slate-400">매매 화면을 초기화하는 중입니다.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Trade</p>
          <h2 className="mt-2 text-3xl font-black text-white">수동 주문 / 포지션 관리</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-xl px-3 py-2 text-sm font-semibold ${modeBadgeClass(tradeMode)}`}>
            현재 주문 모드: {modeLabel(tradeMode)}
          </span>
          <button
            type="button"
            onClick={() => refreshTradeData(tradeMode, false)}
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
          >
            {refreshing ? "새로고침 중..." : "새로고침"}
          </button>
        </div>
      </div>

      {tradeMode === "real" && (
        <div className="rounded-2xl border border-red-500/30 bg-red-950/40 px-5 py-4 text-sm leading-6 text-red-100">
          현재 실전매매 모드입니다. 주문 전 가격, 수량, 손절가, 계좌 모드를 다시 확인하세요.
        </div>
      )}

      {message && (
        <div className={`rounded-2xl border px-5 py-4 text-sm leading-6 ${messageClass(message.type)}`}>
          {message.text}
        </div>
      )}

      {!positionsStatus.brokerSynced && positionsStatus.error && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/30 px-5 py-4 text-sm leading-6 text-amber-100">
          {positionsStatus.error} 실제 보유 포지션이 확인될 때까지 포지션 목록은 비워집니다.
        </div>
      )}

      {positionsStatus.brokerSynced && positionsStatus.orphanLocalCount > 0 && (
        <div className="rounded-2xl border border-sky-500/30 bg-sky-950/30 px-5 py-4 text-sm leading-6 text-sky-100">
          브로커 기준으로 실제 보유가 아닌 로컬 포지션 {positionsStatus.orphanLocalCount}건을 정리했습니다.
        </div>
      )}

      {positionsStatus.pendingOrderCount > 0 && (
        <div className="rounded-2xl border border-violet-500/30 bg-violet-950/30 px-5 py-4 text-sm leading-6 text-violet-100">
          체결 확인 대기 주문이 {positionsStatus.pendingOrderCount}건 있습니다. 체결 전까지는 거래 이력과 보유 포지션에 확정 반영되지 않습니다.
        </div>
      )}

      {positionsStatus.fillSyncError && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/30 px-5 py-4 text-sm leading-6 text-amber-100">
          브로커 주문체결 동기화 경고: {positionsStatus.fillSyncError}
        </div>
      )}

      {positionsStatus.unmatchedSymbols.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/30 px-5 py-4 text-sm leading-6 text-amber-100">
          브로커 체결과 앱 기록이 아직 맞지 않는 종목이 있습니다: {positionsStatus.unmatchedSymbols.join(", ")}. 이 종목은 체결 동기화가 끝날 때까지 통계가 보수적으로 표시됩니다.
        </div>
      )}

      {balance && (
        <div className="grid gap-4 xl:grid-cols-5">
          {[
            { label: "예수금", value: balance.cash, helper: "현금 잔고" },
            { label: "주문 가능", value: balance.orderable_cash, helper: "신규 주문 가능 금액", tone: "text-emerald-400" },
            { label: "주식 평가금액", value: balance.stock_value, helper: "보유 주식의 현재가 기준 합계" },
            { label: "총 자산 평가", value: balance.total_value, helper: "예수금 + 주식 평가금액" },
            { label: "평가 손익", value: balance.unrealized_pnl, helper: "보유 주식 미실현 손익", tone: Number(balance.unrealized_pnl || 0) >= 0 ? "text-emerald-400" : "text-rose-400" },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5">
              <p className="text-sm text-slate-400">{item.label}</p>
              <p className={`mt-3 text-2xl font-black ${item.tone || "text-white"}`}>{formatCurrency(item.value)}</p>
              <p className="mt-2 text-xs text-slate-500">{item.helper}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1.65fr]">
        <OrderPanel
          tradeMode={tradeMode}
          side={side}
          onModeChange={(mode) => (mode === tradeMode ? null : mode === "real" ? setPendingModeSwitch(mode) : applyTradeMode(mode))}
          onSideChange={setSide}
          search={search}
          setSearch={setSearch}
          searchResults={searchResults}
          onSearch={handleSearch}
          onSelectSearchResult={selectSearchResult}
          symbol={symbol}
          name={name}
          price={price}
          setPrice={setPrice}
          quantity={quantity}
          setQuantity={setQuantity}
          stopLoss={stopLoss}
          setStopLoss={setStopLoss}
          takeProfit={takeProfit}
          setTakeProfit={setTakeProfit}
          onAdjustPrice={adjustPrice}
          onSetQuantityByPercent={setQuantityByPercent}
          onClear={clearOrderForm}
          onSubmit={submitOrder}
          submitting={submitting}
          balance={balance}
          selectedPosition={selectedPosition}
          orderAmount={orderAmount}
          allocationPct={allocationPct}
          riskAmount={riskAmount}
        />

        <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-2">
              {[
                { key: "position", label: `보유 포지션 (${positions.length})` },
                { key: "history", label: `거래 이력 (${history.length})` },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    tab === item.key ? "bg-sky-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p className="text-sm text-slate-500">마지막 갱신 {lastRefreshAt ? formatDateTime(lastRefreshAt) : "-"}</p>
          </div>

          {tab === "position" ? (
            <PositionsPanel
              positions={positions}
              currentPrices={currentPrices}
              editingPosition={editingPosition}
              editTakeProfit={editTakeProfit}
              editStopLoss={editStopLoss}
              setEditTakeProfit={setEditTakeProfit}
              setEditStopLoss={setEditStopLoss}
              onToggleEdit={toggleEditPosition}
              onSavePosition={savePositionTargets}
              onPrepareSell={prepareSellOrder}
            />
          ) : (
            <HistoryPanel history={history} />
          )}
        </section>
      </div>

      <ConfirmationDialog
        open={Boolean(pendingModeSwitch)}
        title="실전매매 모드로 전환할까요?"
        description={
          "실전매매 전환 후에는 모든 주문이 실제 계좌로 접수됩니다.\n분석 화면은 주문 모드를 바꾸지 않지만, 이 화면의 전환은 실제 주문 모드에 반영됩니다."
        }
        details={[
          { label: "현재 모드", value: modeLabel(tradeMode) },
          { label: "변경 모드", value: pendingModeSwitch ? modeLabel(pendingModeSwitch) : "-" },
        ]}
        confirmLabel="실전 모드 전환"
        onCancel={() => setPendingModeSwitch(null)}
        onConfirm={() => applyTradeMode(pendingModeSwitch)}
      />

      <ConfirmationDialog
        open={Boolean(confirmOrder)}
        title="실전 주문을 전송할까요?"
        description="실전 계좌로 주문이 접수됩니다. 가격, 수량, 손절가를 다시 확인하세요."
        details={[
          { label: "종목", value: `${confirmOrder?.name || confirmOrder?.symbol || "-"} (${confirmOrder?.symbol || "-"})` },
          { label: "주문 구분", value: confirmOrder?.side === "buy" ? "매수" : "매도" },
          { label: "가격", value: formatCurrency(confirmOrder?.price || 0) },
          { label: "수량", value: `${confirmOrder?.quantity || 0}주` },
          { label: "예상 금액", value: formatCurrency((confirmOrder?.price || 0) * (confirmOrder?.quantity || 0)) },
        ]}
        confirmLabel="실전 주문 전송"
        onCancel={() => setConfirmOrder(null)}
        onConfirm={() => executeOrder(confirmOrder)}
      />
    </div>
  )
}

export default Trade
