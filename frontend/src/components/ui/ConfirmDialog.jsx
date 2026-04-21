import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, HelpCircle, X } from 'lucide-react'
import { registerConfirm } from './bridge'

/**
 * ConfirmDialog / useConfirm — remplace window.confirm() et window.prompt().
 *
 * Usage:
 *   const confirm = useConfirm()
 *   const ok = await confirm({ title, message, confirmLabel, variant })
 *   // Avec saisie (ex. motif de refus):
 *   const motif = await confirm({
 *     title: 'Refuser la demande',
 *     message: 'Indiquez le motif de refus.',
 *     variant: 'danger',
 *     requireInput: { label: 'Motif', placeholder: 'Motif du refus…', required: true }
 *   })
 *   // Résout avec la string saisie, ou null si annulé.
 */

const ConfirmContext = createContext(null)

const VARIANT_COLORS = {
  primary: { color: '#2563eb', bg: '#2563eb12', border: '#2563eb30', Icon: HelpCircle },
  danger:  { color: '#dc2626', bg: '#dc262612', border: '#dc262630', Icon: AlertTriangle },
  warning: { color: '#f59e0b', bg: '#f59e0b12', border: '#f59e0b30', Icon: AlertTriangle },
}

function DialogBody({ request, onResolve }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const cancelBtnRef = useRef(null)
  const confirmBtnRef = useRef(null)
  const inputRef = useRef(null)

  const meta = VARIANT_COLORS[request.variant] || VARIANT_COLORS.primary
  const { Icon } = meta
  const needsInput = !!request.requireInput

  useEffect(() => {
    // Focus: input si présent, sinon bouton cancel (sécurisé)
    const t = setTimeout(() => {
      if (needsInput && inputRef.current) inputRef.current.focus()
      else if (cancelBtnRef.current) cancelBtnRef.current.focus()
    }, 30)
    return () => clearTimeout(t)
  }, [needsInput])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onResolve(null)
      } else if (e.key === 'Enter' && !needsInput) {
        e.preventDefault()
        onResolve(true)
      } else if (e.key === 'Enter' && needsInput && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault()
        submit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [needsInput, value])

  function submit() {
    if (needsInput) {
      const required = request.requireInput.required !== false
      if (required && !value.trim()) {
        setError(request.requireInput.errorLabel || 'Ce champ est requis.')
        inputRef.current?.focus()
        return
      }
      onResolve(value.trim())
    } else {
      onResolve(true)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 10001,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(15,23,42,0.45)',
        backdropFilter: 'blur(4px)',
        padding: 16,
        animation: 'ems-confirm-fade 0.18s ease-out',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onResolve(null) }}
    >
      <style>{`
        @keyframes ems-confirm-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes ems-confirm-pop { from { opacity: 0; transform: translateY(8px) scale(0.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
      `}</style>
      <div style={{
        background: '#ffffff',
        borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)',
        border: '1px solid var(--border, #e2e8f0)',
        width: 440, maxWidth: '100%',
        overflow: 'hidden',
        animation: 'ems-confirm-pop 0.22s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
          background: `linear-gradient(180deg, ${meta.color} 0%, ${meta.color}55 100%)`,
        }} />
        <div style={{ padding: '20px 22px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: meta.bg, border: `1px solid ${meta.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={22} color={meta.color} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 id="confirm-title" style={{
                margin: 0, fontSize: '1rem', fontWeight: 700,
                color: 'var(--text, #0f172a)', lineHeight: 1.3,
              }}>
                {request.title || 'Confirmer l\'action'}
              </h3>
              {request.message && (
                <p style={{
                  margin: '6px 0 0', fontSize: '0.85rem',
                  color: '#64748b', lineHeight: 1.55,
                }}>
                  {request.message}
                </p>
              )}
            </div>
            <button
              onClick={() => onResolve(null)}
              aria-label="Fermer"
              style={{
                width: 28, height: 28, border: 'none',
                background: 'var(--bg, #f1f5f9)',
                cursor: 'pointer', borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#94a3b8', flexShrink: 0, padding: 0,
              }}
            >
              <X size={14} />
            </button>
          </div>

          {needsInput && (
            <div style={{ marginTop: 14 }}>
              {request.requireInput.label && (
                <label style={{
                  display: 'block', marginBottom: 6,
                  fontSize: '0.78rem', fontWeight: 600, color: '#334155',
                }}>
                  {request.requireInput.label}
                  {request.requireInput.required !== false && <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span>}
                </label>
              )}
              {request.requireInput.multiline ? (
                <textarea
                  ref={inputRef}
                  value={value}
                  onChange={(e) => { setValue(e.target.value); if (error) setError('') }}
                  placeholder={request.requireInput.placeholder || ''}
                  rows={3}
                  style={{
                    width: '100%', padding: '9px 11px',
                    borderRadius: 8, border: `1px solid ${error ? '#dc2626' : 'var(--border, #cbd5e1)'}`,
                    fontSize: '0.88rem', fontFamily: 'inherit',
                    resize: 'vertical', boxSizing: 'border-box',
                    outline: 'none',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = meta.color }}
                  onBlur={(e) => { e.target.style.borderColor = error ? '#dc2626' : 'var(--border, #cbd5e1)' }}
                />
              ) : (
                <input
                  ref={inputRef}
                  type={request.requireInput.type || 'text'}
                  value={value}
                  onChange={(e) => { setValue(e.target.value); if (error) setError('') }}
                  placeholder={request.requireInput.placeholder || ''}
                  style={{
                    width: '100%', padding: '9px 11px',
                    borderRadius: 8, border: `1px solid ${error ? '#dc2626' : 'var(--border, #cbd5e1)'}`,
                    fontSize: '0.88rem', boxSizing: 'border-box', outline: 'none',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = meta.color }}
                  onBlur={(e) => { e.target.style.borderColor = error ? '#dc2626' : 'var(--border, #cbd5e1)' }}
                />
              )}
              {error && (
                <div style={{ marginTop: 5, fontSize: '0.75rem', color: '#dc2626' }}>
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{
          padding: '12px 22px 18px',
          display: 'flex', justifyContent: 'flex-end', gap: 10,
        }}>
          <button
            ref={cancelBtnRef}
            onClick={() => onResolve(null)}
            style={{
              padding: '8px 16px', borderRadius: 8,
              background: 'var(--bg, #f1f5f9)',
              border: '1px solid var(--border, #cbd5e1)',
              color: '#334155', fontSize: '0.82rem', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {request.cancelLabel || 'Annuler'}
          </button>
          <button
            ref={confirmBtnRef}
            onClick={submit}
            style={{
              padding: '8px 18px', borderRadius: 8,
              background: meta.color, border: `1px solid ${meta.color}`,
              color: 'white', fontSize: '0.82rem', fontWeight: 700,
              cursor: 'pointer',
              boxShadow: `0 2px 8px ${meta.color}40`,
            }}
          >
            {request.confirmLabel || 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null)
  const resolverRef = useRef(null)

  const confirm = useCallback((opts) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve
      setRequest(opts || {})
    })
  }, [])

  function handleResolve(v) {
    const r = resolverRef.current
    resolverRef.current = null
    setRequest(null)
    if (r) r(v)
  }

  const api = useMemo(() => ({ confirm }), [confirm])

  useEffect(() => {
    registerConfirm(confirm)
    return () => registerConfirm(null)
  }, [confirm])

  const portal = typeof document !== 'undefined' && request
    ? createPortal(<DialogBody request={request} onResolve={handleResolve} />, document.body)
    : null

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      {portal}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) {
    // Fallback: retombe sur window.confirm/prompt si provider absent
    return async (opts) => {
      if (opts?.requireInput) {
        const r = typeof window !== 'undefined' ? window.prompt(opts.message || opts.title || '') : null
        return r
      }
      const ok = typeof window !== 'undefined' ? window.confirm(opts?.message || opts?.title || 'Confirmer ?') : false
      return ok ? true : null
    }
  }
  return ctx.confirm
}

export default ConfirmProvider
