import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react'
import { registerToast } from './bridge'

/**
 * ActionToast / useToast — retours d'action (succès, erreur, info, warning).
 * Réutilise la charte visuelle de NotificationToast (icône, bordure colorée,
 * fond blanc, accent stripe, animation slide-in). Indépendant de
 * NotificationToast.jsx qui gère les notifications push/SSE.
 */

const VARIANT_META = {
  success: { color: '#059669', Icon: CheckCircle2, label: 'Succès',          duration: 4000 },
  error:   { color: '#dc2626', Icon: XCircle,      label: 'Erreur',          duration: 6000 },
  warning: { color: '#f59e0b', Icon: AlertTriangle, label: 'Attention',      duration: 5000 },
  info:    { color: '#02162e', Icon: Info,         label: 'Information',     duration: 4000 },
}

const ToastContext = createContext(null)

let _id = 0

function ToastItem({ toast, onDismiss, offset }) {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)
  const meta = VARIANT_META[toast.variant] || VARIANT_META.info
  const { Icon } = meta

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 20)
    const duration = toast.duration ?? meta.duration
    let t3, t4
    if (duration > 0) {
      t3 = setTimeout(() => setExiting(true), duration - 420)
      t4 = setTimeout(() => onDismiss(toast.id), duration)
    }
    return () => {
      clearTimeout(t1)
      if (t3) clearTimeout(t3)
      if (t4) clearTimeout(t4)
    }
  }, [])

  function dismiss() {
    setExiting(true)
    setTimeout(() => onDismiss(toast.id), 420)
  }

  const isVisible = visible && !exiting

  return (
    <div
      role="alert"
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
      data-toast-variant={toast.variant}
      style={{
        position: 'fixed',
        top: 20 + offset,
        right: 20,
        zIndex: 10000,
        width: 400,
        maxWidth: 'calc(100vw - 40px)',
        borderRadius: 16,
        overflow: 'hidden',
        background: '#ffffff',
        border: '1px solid var(--border, #e2e8f0)',
        boxShadow: '0 10px 40px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.04)',
        transform: isVisible ? 'translateX(0) scale(1)' : 'translateX(calc(100% + 28px)) scale(0.95)',
        opacity: isVisible ? 1 : 0,
        transition: 'transform 0.48s cubic-bezier(0.34,1.56,0.64,1), opacity 0.42s ease, top 0.25s ease',
      }}
    >
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
        background: `linear-gradient(180deg, ${meta.color} 0%, ${meta.color}55 100%)`,
      }} />

      <div style={{ padding: '14px 14px 14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 11, flexShrink: 0,
            background: meta.color + '12',
            border: `1px solid ${meta.color}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={18} color={meta.color} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: meta.color,
                background: meta.color + '12',
                border: `1px solid ${meta.color}22`,
                padding: '2px 8px', borderRadius: 20,
              }}>
                {toast.title || meta.label}
              </span>
            </div>

            {toast.message && (
              <div style={{
                fontSize: '0.85rem', color: 'var(--text, #0f172a)',
                lineHeight: 1.45, wordBreak: 'break-word',
              }}>
                {toast.message}
              </div>
            )}
          </div>

          <button
            onClick={dismiss}
            aria-label="Fermer"
            style={{
              width: 26, height: 26, border: 'none',
              background: 'var(--bg, #f1f5f9)',
              cursor: 'pointer', borderRadius: 7,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#94a3b8', flexShrink: 0, padding: 0,
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#475569' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg, #f1f5f9)'; e.currentTarget.style.color = '#94a3b8' }}
          >
            <X size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}

export function ToastProvider({ children, max = 3 }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts(cur => cur.filter(t => t.id !== id))
  }, [])

  const show = useCallback((payload) => {
    const id = ++_id
    const toast = {
      id,
      variant: payload.variant || 'info',
      title: payload.title,
      message: payload.message || (typeof payload === 'string' ? payload : ''),
      duration: payload.duration,
    }
    setToasts(cur => {
      const next = [...cur, toast]
      // Cap queue
      return next.length > max ? next.slice(next.length - max) : next
    })
    return id
  }, [max])

  const api = useMemo(() => ({
    show,
    success: (message, opts) => show({ variant: 'success', message, ...(opts || {}) }),
    error:   (message, opts) => show({ variant: 'error',   message, ...(opts || {}) }),
    warning: (message, opts) => show({ variant: 'warning', message, ...(opts || {}) }),
    info:    (message, opts) => show({ variant: 'info',    message, ...(opts || {}) }),
    dismiss,
  }), [show, dismiss])

  useEffect(() => {
    registerToast(api)
    return () => registerToast(null)
  }, [api])

  const portal = typeof document !== 'undefined' ? createPortal(
    <div aria-live="polite" aria-atomic="false">
      {toasts.map((t, i) => (
        <ToastItem
          key={t.id}
          toast={t}
          onDismiss={dismiss}
          offset={i * 88}
        />
      ))}
    </div>,
    document.body,
  ) : null

  return (
    <ToastContext.Provider value={api}>
      {children}
      {portal}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Fallback silencieux si provider absent (tests unitaires isolés)
    return {
      show: () => 0, success: () => 0, error: () => 0,
      warning: () => 0, info: () => 0, dismiss: () => {},
    }
  }
  return ctx
}

export default ToastProvider
