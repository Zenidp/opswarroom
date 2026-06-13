'use client'

import { useEffect } from 'react'

export interface ToastMessage {
  id: number
  text: string
  kind: 'success' | 'error' | 'info'
}

const kindStyles: Record<ToastMessage['kind'], string> = {
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  error: 'border-red-500/40 bg-red-500/10 text-red-300',
  info: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
}

export function Toast({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 4000)
    return () => clearTimeout(t)
  }, [toast.id, onDismiss])

  return (
    <div className={`pointer-events-auto rounded-lg border px-4 py-2.5 text-sm shadow-lg ${kindStyles[toast.kind]}`}>
      {toast.text}
    </div>
  )
}

export function ToastStack({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(t => <Toast key={t.id} toast={t} onDismiss={onDismiss} />)}
    </div>
  )
}
