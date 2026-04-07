import React from 'react'
import ProgressionValidation from './ProgressionValidation'

export default function WorkflowModal({ isOpen, operationId, onClose }) {
  if (!isOpen) return null

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingRight: '325px',
      zIndex: 5000
    }} onClick={handleOverlayClick}>
      <div style={{
        background: 'transparent',
        borderRadius: '12px',
        padding: '8px',
        maxWidth: '380px',
        width: '80%',
        boxShadow: 'none',
        position: 'relative'
      }}>
        <ProgressionValidation idOperation={operationId} onClose={onClose} />
      </div>
    </div>
  )
}

