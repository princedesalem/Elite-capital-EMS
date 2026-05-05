import React, { useEffect, useState } from 'react'
import ProgressionValidation from './ProgressionValidation'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'

export default function WorkflowModal({ isOpen, operationId, onClose }) {
  const { user } = useAuth()
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Enregistre la consultation en DB, puis re-fetch silencieux de la progression
  useEffect(() => {
    if (!isOpen || !operationId || !user?.matricule) return
    api.post(`/api/workflow/marquer-vu/${operationId}`, null, {
      params: { matricule_observateur: user.matricule },
    })
      .then(res => {
        // Re-fetch silencieux pour afficher la date_vue dans le tooltip
        if (!res?.data?.already) setRefreshTrigger(t => t + 1)
      })
      .catch(() => {})
  }, [isOpen, operationId, user?.matricule])

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
        <ProgressionValidation idOperation={operationId} onClose={onClose} refreshTrigger={refreshTrigger} />
      </div>
    </div>
  )
}

