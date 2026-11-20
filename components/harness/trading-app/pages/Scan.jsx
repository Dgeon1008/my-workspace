import { useEffect, useState } from "react"

import client from "../api/client"
import ConfirmationDialog from "../components/ConfirmationDialog"
import QuickOrderSheet from "../components/scan/QuickOrderSheet"
import SignalSection from "../components/scan/SignalSection"
import { formatCurrency, formatDateTime, modeBadgeClass, modeLabel } from "../utils/formatters"

const DEFAULT_CONDITIONS = {
  rsi_oversold: { enabled: true, weight: 3, label: "RSI 과매도", desc: "RSI 35 이하 구간 반등 후보" },
  volume_surge: { enabled: true, weight: 2, label: "거래량 급증", desc: "평균 대비 거래량 급증" },
  bollinger_lower: { enabled: true, weight: 2, label: "볼린저 하단", desc: "볼린저 하단 터치" },
  golden_cross: { enabled: true, weight: 2, label: "골든크로스", desc: "5일선이 20일선을 상향 돌파" },
  macd_bullish: { enabled: false, weight: 1, label: "MACD 양전환", desc: "MACD 상승 전환" },
  breakout_high: { enabled: false, weight: 2, label: "전고점 돌파", desc: "20일 고점 돌파" },
  price_rising: { enabled: true, weight: 1, label: "3연속 상승", desc: "연속 상승 흐름" },
  above_ma: { enabled: true, weight: 1, label: "20일선 위", desc: "중기 추세 유지" },
  rsi_overbought: { enabled: true, weight: 3, label: "RSI 과매수", desc: "RSI 65 이상 구간" },
  bollinger_upper: { enabled: true, weight: 2, label: "볼린저 상단", desc: "볼린저 상단 돌파" },
  dead_cross: { enabled: true, weight: 2, label: "데드크로스", desc: "5일선이 20일선을 하향 돌파" },
}

function Scan() {
  const [conditions, setConditions] = useState(DEFAULT_CONDITIONS)
  const [minScore, setMinScore] = useState(3)
  const [topN, setTopN] = useState(30)
  const [scanInterval, setScanInterval] = useState(5)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState("")
  const [showBuy, setShowBuy] = useState(true)
  const [showSell, setShowSell] = useState(true)
  const [autoStatus, setAutoStatus] = useState({ is_running: false, interval: 5, last_run_at: "", last_error: "" })
  const [tradeMode, setTradeMode] = useState("paper")
  const [balance, setBalance] = useState(null)
  const [positionsMap, setPositionsMap] = useState({})
  const [orderModal, setOrderModal] = useState(null)
  const [orderQty, setOrderQty] = useState("")
  const [orderStopLoss, setOrderStopLoss] = useState("")
  const [stopLossConfirmed, setStopLossConfirmed] = useState(false)
  const [requireStopLossConfirmation, setRequireStopLossConfirmation] = useState(true)
  const [orderLoading, setOrderLoading] = useState(false)
  const [orderMsg, setOrderMsg] = useState(null)
  const [confirmOrder, setConfirmOrder] = useState(null)

  useEffect(() => {
    let ignore = false

    const fetchContext = async () => {
      try {
        const [conditionsResponse, settingsResponse, autoResponse, snapshotResponse] =
          await Promise.all([
            client.get("/scan/conditions"),
            client.get("/settings"),
            client.get("/scan/auto/status"),
            client.get("/trade/snapshot"),
          ])

        if (ignore) return

        setConditions(conditionsResponse.data || DEFAULT_CONDITIONS)
        setTopN(Number(settingsResponse.data.scan_top_n || 30))
        setScanInterval(Number(settingsResponse.data.scan_interval || 5))
        setRequireStopLossConfirmation((settingsResponse.data.rule1_enabled || "true") === "true")
        setAutoStatus(autoResponse.data)
        setTradeMode(snapshotResponse.data?.mode || "paper")
        setBalance(snapshotResponse.data?.balance || null)
        const positions = snapshotResponse.data?.positions?.items || []
        setPositionsMap(
          Object.fromEntries(positions.map((position) => [position.symbol, position])),
        )
      } catch {
        if (!ignore) setError("초기 스캔 설정을 불러오지 못했습니다.")
      }
    }

    fetchContext()
    const timer = setInterval(fetchContext, 20000)
    return () => {
      ignore = true
      clearInterval(timer)
    }
  }, [])

  const updateSetting = async (key, value) => {
    await client.post(`/settings/update?key=${key}&value=${value}`)
  }

  const toggleCondition = (key) => {
    setConditions((prev) => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key].enabled },
    }))
  }

  const changeWeight = (key, value) => {
    setConditions((prev) => ({
      ...prev,
      [key]: { ...prev[key], weight: Number(value) },
    }))
  }

  const refreshTradeSnapshot = async () => {
    try {
      const { data } = await client.get("/trade/snapshot")
      setTradeMode(data?.mode || "paper")
      setBalance(data?.balance || null)
      const positions = data?.positions?.items || []
      setPositionsMap(Object.fromEntries(positions.map((position) => [position.symbol, position])))
    } catch {
      // keep previous state
    }
  }

  const runScan = async () => {
    setLoading(true)
    setError("")
    setResult(null)

    try {
      await Promise.all([
        client.post("/scan/conditions", conditions),
        updateSetting("scan_top_n", topN),
        updateSetting("scan_interval", scanInterval),
      ])

      const { data } = await client.get("/scan/run", {
        params: { min_score: minScore, top_n: topN },
      })
      setResult(data)
      await refreshTradeSnapshot()
    } catch {
      setError("스캔 실행 중 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const toggleAutoScan = async () => {
    try {
      await updateSetting("scan_interval", scanInterval)
      const endpoint = autoStatus.is_running
        ? "/scan/auto/stop"
        : `/scan/auto/start?interval=${scanInterval}`
      const { data } = await client.post(endpoint)
      setAutoStatus(data)
    } catch {
      setError("자동 스캔 상태를 변경하지 못했습니다.")
    }
  }

  const openOrderModal = (stock, side) => {
    const holding = positionsMap[stock.symbol]
    setOrderModal({ stock, side, holding })
    setOrderQty(
      side === "sell" && holding
        ? String(holding.orderable_quantity ?? holding.quantity ?? "")
        : "1",
    )
    setOrderStopLoss(side === "buy" ? String(stock.stop_loss ?? "") : "")
    setStopLossConfirmed(false)
    setOrderMsg(null)
  }

  const closeOrderModal = () => {
    setOrderModal(null)
    setOrderQty("")
    setOrderStopLoss("")
    setStopLossConfirmed(false)
    setOrderMsg(null)
  }

  const setQuickBuyQtyByPercent = (percent) => {
    if (!balance?.orderable_cash || !orderModal?.stock?.price) return
    const computed = Math.max(
      1,
      Math.floor((Number(balance.orderable_cash) * (percent / 100)) / Number(orderModal.stock.price)),
    )
    setOrderQty(String(computed))
  }

  const setQuickSellQtyByPercent = (percent) => {
    if (!orderModal?.holding) return
    const sellableQuantity = Number(orderModal.holding.orderable_quantity ?? orderModal.holding.quantity ?? 0)
    const computed = percent === 100 ? sellableQuantity : Math.max(1, Math.floor((sellableQuantity * percent) / 100))
    setOrderQty(String(computed))
  }

  const buildOrderPayload = () => ({
    symbol: orderModal.stock.symbol,
    name: orderModal.stock.name,
    side: orderModal.side,
    price: Number(orderModal.stock.price),
    quantity: Number(orderQty || 0),
    stop_loss: Number(orderStopLoss || 0),
    take_profit: Number(orderModal.stock.take_profit || 0),
    signal_id: orderModal.stock.signal_id ?? null,
    order_source: "scan",
    stop_loss_confirmed: orderModal.side === "buy" ? (!requireStopLossConfirmation || stopLossConfirmed) : true,
  })

  const executeQuickOrder = async (payload) => {
    setOrderLoading(true)
    setOrderMsg(null)
    try {
      const { data } = await client.post("/trade/order", payload)
      if (!data.success) {
        setOrderMsg({ type: "error", text: data.message })
        return
      }
      setOrderMsg({ type: "success", text: data.message })
      setConfirmOrder(null)
      await refreshTradeSnapshot()
      setTimeout(() => {
        closeOrderModal()
      }, 1000)
    } catch {
      setOrderMsg({ type: "error", text: "주문 요청 중 오류가 발생했습니다." })
    } finally {
      setOrderLoading(false)
    }
  }

  const submitQuickOrder = async () => {
    const qty = Number(orderQty || 0)
    if (!qty || qty <= 0) {
      setOrderMsg({ type: "error", text: "주문 수량을 입력하세요." })
      return
    }

    if (orderModal.side === "buy" && requireStopLossConfirmation) {
      const stopLossValue = Number(orderStopLoss || 0)
      if (!stopLossValue || stopLossValue <= 0 || stopLossValue >= Number(orderModal.stock.price || 0)) {
        setOrderMsg({ type: "error", text: "빠른 매수 손절가는 0보다 크고 매수가보다 낮아야 합니다." })
        return
      }
      if (!stopLossConfirmed) {
        setOrderMsg({ type: "error", text: "빠른 매수 전 손절가를 직접 확인해 주세요." })
        return
      }
    }

    if (
      orderModal.side === "sell" &&
      orderModal.holding &&
      qty > Number(orderModal.holding.orderable_quantity ?? orderModal.holding.quantity ?? 0)
    ) {
      setOrderMsg({ type: "error", text: "보유 수량을 초과한 매도 주문입니다." })
      return
    }

    const payload = buildOrderPayload()
    if (tradeMode === "real") {
      setConfirmOrder(payload)
      return
    }

    await executeQuickOrder(payload)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Scan</p>
          <h2 className="mt-2 text-3xl font-black text-white">조건 스캔 / 빠른 주문</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-xl px-3 py-2 text-sm font-semibold ${modeBadgeClass(tradeMode)}`}>
            현재 주문 모드: {modeLabel(tradeMode)}
          </span>
          <button
            type="button"
            onClick={toggleAutoScan}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              autoStatus.is_running
                ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                : "border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
            }`}
          >
            {autoStatus.is_running ? "자동 스캔 중지" : "자동 스캔 시작"}
          </button>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-rose-500/30 bg-rose-950/40 px-5 py-4 text-sm text-rose-100">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.65fr]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5">
          <h3 className="text-xl font-bold text-white">스캔 조건</h3>
          <div className="mt-5 space-y-3">
            {Object.entries(conditions).map(([key, condition]) => (
              <div key={key} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <button type="button" onClick={() => toggleCondition(key)} className="text-left">
                      <p className={`font-semibold ${condition.enabled ? "text-white" : "text-slate-500"}`}>
                        {condition.label}
                      </p>
                    </button>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{condition.desc}</p>
                  </div>
                  <select
                    value={condition.weight}
                    onChange={(event) => changeWeight(key, event.target.value)}
                    disabled={!condition.enabled}
                    className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 disabled:opacity-40"
                  >
                    {[1, 2, 3, 4, 5].map((weight) => (
                      <option key={weight} value={weight}>{weight}점</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">최소 점수</label>
              <select value={minScore} onChange={(event) => setMinScore(Number(event.target.value))} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((score) => (
                  <option key={score} value={score}>{score}점 이상</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">거래량 상위</label>
              <select value={topN} onChange={(event) => setTopN(Number(event.target.value))} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white">
                {[10, 30, 50, 100, 200].map((value) => (
                  <option key={value} value={value}>{value}개</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium text-slate-300">자동 스캔 주기</label>
            <input
              type="number"
              value={scanInterval}
              onChange={(event) => setScanInterval(Number(event.target.value))}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
            />
          </div>

          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-300">
            <p>상태: {autoStatus.is_running ? "실행 중" : "중지됨"}</p>
            <p className="mt-2">최근 자동 스캔: {autoStatus.last_run_at ? formatDateTime(autoStatus.last_run_at) : "-"}</p>
            {autoStatus.last_error && <p className="mt-2 text-rose-300">최근 오류: {autoStatus.last_error}</p>}
          </div>

          <button
            type="button"
            onClick={runScan}
            disabled={loading}
            className="mt-5 w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-400"
          >
            {loading ? "스캔 실행 중..." : "지금 스캔 실행"}
          </button>
        </section>

        <div className="space-y-4">
          {!loading && !result && (
            <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-16 text-center text-slate-500">
              조건을 확인한 뒤 스캔을 실행하세요.
            </div>
          )}

          {loading && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 px-6 py-16 text-center text-slate-300">
              거래량 상위 {topN}개 종목을 분석 중입니다.
            </div>
          )}

          {result && (
            <>
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5">
                  <p className="text-sm text-slate-400">매수 후보</p>
                  <p className="mt-3 text-3xl font-black text-emerald-400">{result.buy.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5">
                  <p className="text-sm text-slate-400">매도 후보</p>
                  <p className="mt-3 text-3xl font-black text-rose-400">{result.sell.length}</p>
                </div>
              </div>

              <SignalSection
                title="매수 후보"
                accent="buy"
                count={result.buy.length}
                expanded={showBuy}
                onToggle={() => setShowBuy((prev) => !prev)}
                stocks={result.buy}
                positionsMap={positionsMap}
                onOpenOrder={openOrderModal}
              />

              <SignalSection
                title="매도 후보"
                accent="sell"
                count={result.sell.length}
                expanded={showSell}
                onToggle={() => setShowSell((prev) => !prev)}
                stocks={result.sell}
                positionsMap={positionsMap}
                onOpenOrder={openOrderModal}
              />
            </>
          )}
        </div>
      </div>

      <QuickOrderSheet
        orderModal={orderModal}
        orderQty={orderQty}
        orderStopLoss={orderStopLoss}
        stopLossConfirmed={stopLossConfirmed}
        requireStopLossConfirmation={requireStopLossConfirmation}
        orderMsg={orderMsg}
        orderLoading={orderLoading}
        balance={balance}
        onClose={closeOrderModal}
        onChangeQty={setOrderQty}
        onChangeStopLoss={(value) => {
          setOrderStopLoss(value)
          setStopLossConfirmed(false)
          setOrderMsg(null)
        }}
        onConfirmStopLoss={() => {
          setStopLossConfirmed(true)
          setOrderMsg(null)
        }}
        onSetBuyPercent={setQuickBuyQtyByPercent}
        onSetSellPercent={setQuickSellQtyByPercent}
        onSubmit={submitQuickOrder}
      />

      <ConfirmationDialog
        open={Boolean(confirmOrder)}
        title="실전 주문을 전송할까요?"
        description="실전 계좌로 주문이 접수됩니다. 종목, 가격, 수량을 다시 확인하세요."
        details={[
          { label: "종목", value: `${confirmOrder?.name || confirmOrder?.symbol || "-"} (${confirmOrder?.symbol || "-"})` },
          { label: "주문 구분", value: confirmOrder?.side === "buy" ? "매수" : "매도" },
          { label: "주문 가격", value: formatCurrency(confirmOrder?.price || 0) },
          { label: "주문 수량", value: `${confirmOrder?.quantity || 0}주` },
          { label: "예상 금액", value: formatCurrency((confirmOrder?.price || 0) * (confirmOrder?.quantity || 0)) },
        ]}
        confirmLabel="실전 주문 전송"
        onCancel={() => setConfirmOrder(null)}
        onConfirm={() => executeQuickOrder(confirmOrder)}
      />
    </div>
  )
}

export default Scan
