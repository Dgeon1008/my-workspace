function ConfirmationDialog({
  open,
  title,
  description,
  accent = "red",
  details = [],
  confirmLabel = "확인",
  cancelLabel = "취소",
  onConfirm,
  onCancel,
}) {
  if (!open) return null

  const accentClass =
    accent === "green"
      ? "bg-green-600 hover:bg-green-500"
      : "bg-red-600 hover:bg-red-500"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        {description && (
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-300">
            {description}
          </p>
        )}

        {details.length > 0 && (
          <div className="mt-4 rounded-xl bg-slate-800/90 p-4">
            <div className="space-y-2">
              {details.map((detail) => (
                <div key={detail.label} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-400">{detail.label}</span>
                  <span className="text-right font-semibold text-white">{detail.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-white transition ${accentClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmationDialog
