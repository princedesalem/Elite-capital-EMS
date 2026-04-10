import React, { useEffect, useState } from 'react'
import { X, CheckCircle2, XCircle, AlertTriangle, Plane, Bell, Briefcase, MessageSquare, Clock, Star, Home, ArrowRight, Banknote } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const DURATION = 10000

const TYPE_META = {
  VALIDATION:          { color: '#60a5fa', Icon: CheckCircle2,   label: 'Validation' },
  PAIEMENT:            { color: '#059669', Icon: Banknote,        label: 'Paiement' },
  REFUS:               { color: '#f87171', Icon: XCircle,        label: 'Refus' },
  ALERTE_CONGES:       { color: '#fbbf24', Icon: AlertTriangle,  label: 'Alerte congés' },
  RAPPEL_DEPART:       { color: '#38bdf8', Icon: Plane,          label: 'Départ mission' },
  RAPPEL_RETOUR:       { color: '#38bdf8', Icon: Home,           label: 'Retour mission' },
  DEMANDE_MISSION:     { color: '#818cf8', Icon: Briefcase,      label: 'Mission' },
  DEMANDE_EXPLICATION: { color: '#fb923c', Icon: MessageSquare,  label: 'Explication' },
  EVALUATION:          { color: '#a78bfa', Icon: Star,           label: 'Évaluation' },
  CLOTURE_REQUISE:     { color: '#f472b6', Icon: Clock,          label: 'Clôture requise' },
  AUTRE:               { color: '#60a5fa', Icon: Bell,           label: 'Notification' },
}

function getMeta(typeKey, notif) {
  const key = (typeKey || '').replace('TypeNotificationEnum.', '').toUpperCase()
  // Override to financial icon if notification is payment-related
  if (notif) {
    const content = ((notif.titre || '') + ' ' + (notif.message || '')).toLowerCase()
    if (content.includes('paiement') || content.includes('payé') || content.includes('frais')) {
      return TYPE_META.PAIEMENT
    }
  }
  return TYPE_META[key] || TYPE_META.AUTRE
}

/** Maps type_demande → the right page with operationId and optional tab query params */
function getOperationRoute(typeDemande, operationId, tab) {
  const t = (typeDemande || '').toLowerCase()
    .replace(/[éè]/g, 'e').replace(/[àâ]/g, 'a').replace(/_/g, ' ')
  const tabParam = tab ? `&tab=${tab}` : ''
  if (t.includes('conge'))      return `/rh/conges?operationId=${operationId}${tabParam}`
  if (t.includes('permission')) return `/rh/permissions?operationId=${operationId}${tabParam}`
  if (t.includes('frais'))      return `/rh/frais?operationId=${operationId}${tabParam}`
  if (t.includes('mission'))    return `/rh/missions?operationId=${operationId}${tabParam}`
  if (t.includes('sortie'))     return `/rh/sorties?operationId=${operationId}${tabParam}`
  return `/rh/operations?operationId=${operationId}&tab=demandes`
}

export default function NotificationToast({ notification, onDismiss }) {
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 20)
    const t3 = setTimeout(() => setExiting(true), DURATION - 420)
    const t4 = setTimeout(() => onDismiss?.(), DURATION)
    return () => [t1, t3, t4].forEach(clearTimeout)
  }, [])

  function dismiss() {
    setExiting(true)
    setTimeout(() => onDismiss?.(), 420)
  }

  const meta = getMeta(notification?.type_notification, notification)
  const { Icon } = meta
  const isVisible = visible && !exiting

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 9999,
        width: 400,
        borderRadius: 16,
        overflow: 'hidden',
        background: '#ffffff',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid #e2e8f0',
        boxShadow: '0 10px 40px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.04)',
        transform: isVisible ? 'translateX(0) scale(1)' : 'translateX(calc(100% + 28px)) scale(0.95)',
        opacity: isVisible ? 1 : 0,
        transition: 'transform 0.48s cubic-bezier(0.34,1.56,0.64,1), opacity 0.42s ease',
        userSelect: 'none',
      }}
    >
      {/* Left accent stripe */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
        background: `linear-gradient(180deg, ${meta.color} 0%, ${meta.color}55 100%)`,
      }} />

      <div style={{ padding: '14px 14px 14px 18px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
          {/* Icon bubble */}
          <div style={{
            width: 40, height: 40, borderRadius: 11, flexShrink: 0,
            background: meta.color + '12',
            border: `1px solid ${meta.color}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={18} color={meta.color} />
          </div>

          {/* Text content */}
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
                {meta.label}
              </span>
              <span style={{ fontSize: '0.62rem', color: '#94a3b8', flexShrink: 0, marginLeft: 8 }}>
                À l'instant
              </span>
            </div>

            <div style={{
              fontWeight: 700, fontSize: '0.9rem', color: '#0f172a',
              lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {notification?.titre || 'Nouvelle notification'}
            </div>
          </div>

          {/* Dismiss */}
          <button
            onClick={dismiss}
            aria-label="Fermer"
            style={{
              width: 26, height: 26, border: 'none',
              background: '#f1f5f9',
              cursor: 'pointer', borderRadius: 7,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#94a3b8', flexShrink: 0, padding: 0,
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#475569' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#94a3b8' }}
          >
            <X size={12} />
          </button>
        </div>

        {/* Message body */}
        <p style={{
          margin: '10px 0 0',
          paddingLeft: 51,
          fontSize: '0.8rem', color: '#64748b', lineHeight: 1.6,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {notification?.message || ''}
        </p>

        {/* CTA — navigate to the correct type-specific page */}
        {notification?.id_operation && (
          <div style={{ paddingLeft: 51, marginTop: 12 }}>
            <button
              onClick={() => {
                navigate(getOperationRoute(notification.type_demande, notification.id_operation, notification.workflow_bucket))
                dismiss()
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 8,
                background: meta.color + '12',
                border: `1.5px solid ${meta.color}30`,
                color: meta.color, fontSize: '0.76rem', fontWeight: 700,
                cursor: 'pointer', letterSpacing: '0.01em',
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = meta.color + '22'; e.currentTarget.style.borderColor = meta.color }}
              onMouseLeave={e => { e.currentTarget.style.background = meta.color + '12'; e.currentTarget.style.borderColor = meta.color + '30' }}
            >
              Voir #{notification.id_operation}
              <ArrowRight size={11} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

