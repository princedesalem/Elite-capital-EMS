import React from 'react'

export default function ModifiedBadge({ estModifie, dateModification = null }) {
  if (!estModifie) return null

  const title = dateModification
    ? `Demande modifiée le ${new Date(dateModification).toLocaleString('fr-FR')}`
    : 'Demande modifiée'

  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: '0.66rem',
        fontWeight: 700,
        letterSpacing: '0.01em',
        color: '#9a3412',
        background: '#ffedd5',
        border: '1px solid #fdba74'
      }}
    >
      Modifiée
    </span>
  )
}