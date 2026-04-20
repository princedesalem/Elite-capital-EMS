import React, { useState } from 'react'
import CongesPage from './CongesPage'
import PermissionsPage from './PermissionsPage'
import SortiesPage from './SortiesPage'
import RemplacantsPage from './RemplacantsPage'
import { CalendarDays, Clock, LogOut, Users } from 'lucide-react'
export default function AbsencesPage() {
  const [activeTab, setActiveTab] = useState('conges')

  const TABS = [
    { id: 'conges',       label: "Congés",        Icon: CalendarDays },
    { id: 'permissions',  label: "Permissions",   Icon: Clock },
    { id: 'sorties',      label: "Demandes de Sorties",         Icon: LogOut },
    { id: 'remplacants',  label: "Remplaçants",  Icon: Users },
  ]

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(90deg, #021630 0%, #ce2b2b 100%)',
        color: 'white',
        padding: '16px 20px',
        borderRadius: '10px',
        marginBottom: '14px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      }}>
        <h1 style={{ margin: 0, marginBottom: 4, fontSize: '1.2rem', fontWeight: 700 }}>
          {"Gestion des Absences"}
        </h1>
        <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.9 }}>
          {"Congés, permissions, sorties et remplacements"}
        </p>
      </div>

      {/* Tab switcher */}
      <div style={{
        display: 'flex', gap: 4,
        background: 'var(--bg)', borderRadius: 10, padding: 4,
        marginBottom: 16, width: 'fit-content',
      }}>
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', border: 'none', borderRadius: 8, cursor: 'pointer',
              fontWeight: activeTab === id ? 700 : 500, fontSize: '0.85rem',
              background: activeTab === id ? 'white' : 'transparent',
              color: activeTab === id ? '#ce2b2b' : '#64748b',
              boxShadow: activeTab === id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'conges'      && <CongesPage />}
        {activeTab === 'permissions' && <PermissionsPage />}
        {activeTab === 'sorties'     && <SortiesPage />}
        {activeTab === 'remplacants' && <RemplacantsPage />}
      </div>
    </div>
  )
}
