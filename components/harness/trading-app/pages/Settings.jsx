import { useEffect, useMemo, useState } from "react"

import client from "../api/client"

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative h-7 w-14 rounded-full transition ${checked ? "bg-emerald-500" : "bg-slate-600"}`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${checked ? "left-8" : "left-1"}`}
      />
    </button>
  )
}

function Field({ label, children, helper }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-white">{label}</p>
          {helper && <p className="mt-1 text-sm text-slate-500">{helper}</p>}
        </div>
        <div>{children}</div>
      </div>
    </div>
  )
}

function Settings() {
  const [savedSettings, setSavedSettings] = useState(null)
  const [draftSettings, setDraftSettings] = useState(null)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await client.get("/settings")
        setSavedSettings(data)
        setDraftSettings(data)
      } catch {
        setError("설정값을 불러오지 못했습니다.")
      }
    }

    fetchSettings()
  }, [])

  const isDirty = useMemo(() => {
    if (!savedSettings || !draftSettings) return false
    return JSON.stringify(savedSettings) !== JSON.stringify(draftSettings)
  }, [savedSettings, draftSettings])

  const updateDraft = (key, value) => {
    setDraftSettings((prev) => ({ ...prev, [key]: value }))
    setInfo("")
    setError("")
  }

  const resetDraft = () => {
    setDraftSettings(savedSettings)
    setInfo("저장된 설정 기준으로 초안을 되돌렸습니다.")
    setError("")
  }

  const applyDraft = async () => {
    if (!draftSettings || !isDirty) return

    setSaving(true)
    setError("")
    setInfo("")
    try {
      await client.post("/settings/bulk", { values: draftSettings })
      setSavedSettings(draftSettings)
      setInfo("설정을 적용했습니다.")
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || "설정 저장에 실패했습니다.")
    } finally {
      setSaving(false)
    }
  }

  if (!draftSettings) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="animate-pulse text-slate-400">설정 화면을 불러오는 중입니다.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Settings</p>
          <h2 className="mt-2 text-3xl font-black text-white">실전 규칙 / 스캔 / 알람 설정</h2>
          <p className="mt-2 text-sm text-slate-400">
            이 화면은 초안 편집 후 한 번에 적용합니다. 장중 운영 값이 무심코 바뀌지 않도록 즉시 저장을 막았습니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/90 px-4 py-3">
          <span className={`text-sm font-semibold ${isDirty ? "text-amber-300" : "text-slate-400"}`}>
            {isDirty ? "저장 전 변경 있음" : "저장된 설정과 동일"}
          </span>
          <button
            type="button"
            onClick={resetDraft}
            disabled={!isDirty || saving}
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            되돌리기
          </button>
          <button
            type="button"
            onClick={applyDraft}
            disabled={!isDirty || saving}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {saving ? "적용 중..." : "설정 적용"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-950/40 px-5 py-4 text-sm text-rose-100">
          {error}
        </div>
      )}

      {info && (
        <div className="rounded-2xl border border-sky-500/30 bg-sky-950/40 px-5 py-4 text-sm text-sky-100">
          {info}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5">
          <h3 className="text-xl font-bold text-white">시드 보호 규칙</h3>
          <div className="mt-5 space-y-4">
            <Field label="Rule 1. 손절가 없는 매수 차단" helper="손절가가 없거나 매수가 이상이면 신규 매수를 막습니다.">
              <Toggle
                checked={draftSettings.rule1_enabled === "true"}
                onChange={() => updateDraft("rule1_enabled", draftSettings.rule1_enabled === "true" ? "false" : "true")}
              />
            </Field>

            <Field label="Rule 2. 단일 종목 최대 비중" helper="한 종목이 전체 자산의 일정 비중을 넘지 못하게 합니다.">
              <div className="flex items-center gap-3">
                <Toggle
                  checked={draftSettings.rule2_enabled === "true"}
                  onChange={() => updateDraft("rule2_enabled", draftSettings.rule2_enabled === "true" ? "false" : "true")}
                />
                <input
                  type="number"
                  value={draftSettings.rule2_max_pct}
                  onChange={(event) => updateDraft("rule2_max_pct", event.target.value)}
                  className="w-20 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-center text-sm text-white"
                />
                <span className="text-sm text-slate-400">%</span>
              </div>
            </Field>

            <Field label="Rule 3. 당일 실현 손실 한도" helper="당일 누적 손실이 한도를 넘으면 신규 매수를 차단합니다.">
              <div className="flex items-center gap-3">
                <Toggle
                  checked={draftSettings.rule3_enabled === "true"}
                  onChange={() => updateDraft("rule3_enabled", draftSettings.rule3_enabled === "true" ? "false" : "true")}
                />
                <input
                  type="number"
                  value={draftSettings.rule3_max_loss}
                  onChange={(event) => updateDraft("rule3_max_loss", event.target.value)}
                  className="w-20 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-center text-sm text-white"
                />
                <span className="text-sm text-slate-400">%</span>
              </div>
            </Field>

            <Field label="Rule 5. 연속 손절 냉각" helper="연속 손절 후 일정 시간 동안 신규 매수를 차단합니다.">
              <div className="flex items-center gap-3">
                <Toggle
                  checked={draftSettings.rule5_enabled === "true"}
                  onChange={() => updateDraft("rule5_enabled", draftSettings.rule5_enabled === "true" ? "false" : "true")}
                />
                <input
                  type="number"
                  value={draftSettings.rule5_count}
                  onChange={(event) => updateDraft("rule5_count", event.target.value)}
                  className="w-16 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-center text-sm text-white"
                />
                <span className="text-sm text-slate-400">회</span>
                <input
                  type="number"
                  value={draftSettings.rule5_cool_min}
                  onChange={(event) => updateDraft("rule5_cool_min", event.target.value)}
                  className="w-16 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-center text-sm text-white"
                />
                <span className="text-sm text-slate-400">분</span>
              </div>
            </Field>
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5">
            <h3 className="text-xl font-bold text-white">자동 스캔 설정</h3>
            <div className="mt-5 space-y-4">
              <Field label="거래량 상위 종목 수">
                <input
                  type="number"
                  value={draftSettings.scan_top_n}
                  onChange={(event) => updateDraft("scan_top_n", event.target.value)}
                  className="w-24 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-center text-sm text-white"
                />
              </Field>
              <Field label="자동 스캔 주기">
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={draftSettings.scan_interval}
                    onChange={(event) => updateDraft("scan_interval", event.target.value)}
                    className="w-24 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-center text-sm text-white"
                  />
                  <span className="text-sm text-slate-400">분</span>
                </div>
              </Field>
              <Field label="R:R 미달 필터">
                <Toggle
                  checked={draftSettings.alarm_rr_filter === "true"}
                  onChange={() => updateDraft("alarm_rr_filter", draftSettings.alarm_rr_filter === "true" ? "false" : "true")}
                />
              </Field>
              <Field label="최소 R:R">
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    step="0.1"
                    value={draftSettings.alarm_rr_min}
                    onChange={(event) => updateDraft("alarm_rr_min", event.target.value)}
                    className="w-24 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-center text-sm text-white"
                  />
                  <span className="text-sm text-slate-400">: 1</span>
                </div>
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5">
            <h3 className="text-xl font-bold text-white">알람 / 비용 설정</h3>
            <div className="mt-5 space-y-4">
              <Field label="텔레그램 알람">
                <Toggle
                  checked={draftSettings.alarm_telegram === "true"}
                  onChange={() => updateDraft("alarm_telegram", draftSettings.alarm_telegram === "true" ? "false" : "true")}
                />
              </Field>
              <Field label="알람 쿨다운">
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={draftSettings.alarm_cooldown}
                    onChange={(event) => updateDraft("alarm_cooldown", event.target.value)}
                    className="w-24 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-center text-sm text-white"
                  />
                  <span className="text-sm text-slate-400">분</span>
                </div>
              </Field>
              <Field label="매수 수수료율" helper="예: 0.00015">
                <input
                  type="number"
                  step="0.00001"
                  value={draftSettings.trade_fee_rate_buy}
                  onChange={(event) => updateDraft("trade_fee_rate_buy", event.target.value)}
                  className="w-28 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-center text-sm text-white"
                />
              </Field>
              <Field label="매도 수수료율" helper="예: 0.00015">
                <input
                  type="number"
                  step="0.00001"
                  value={draftSettings.trade_fee_rate_sell}
                  onChange={(event) => updateDraft("trade_fee_rate_sell", event.target.value)}
                  className="w-28 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-center text-sm text-white"
                />
              </Field>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default Settings
