import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'

export const LS_TZ_KEY = 'ems_timezone'

const TIMEZONES = [
  { value: 'auto',                  label: 'Automatique (appareil)' },
  { value: 'Africa/Douala',         label: 'Afrique/Douala (UTC+1)' },
  { value: 'Africa/Lagos',          label: 'Afrique/Lagos (UTC+1)' },
  { value: 'Africa/Libreville',     label: 'Afrique/Libreville (UTC+1)' },
  { value: 'Africa/Brazzaville',    label: 'Afrique/Brazzaville (UTC+1)' },
  { value: 'Africa/Kinshasa',       label: 'Afrique/Kinshasa (UTC+1)' },
  { value: 'Africa/Lusaka',         label: 'Afrique/Lusaka (UTC+2)' },
  { value: 'Africa/Nairobi',        label: 'Afrique/Nairobi (UTC+3)' },
  { value: 'Africa/Johannesburg',   label: 'Afrique/Johannesburg (UTC+2)' },
  { value: 'Africa/Abidjan',        label: 'Afrique/Abidjan (UTC+0)' },
  { value: 'Africa/Dakar',          label: 'Afrique/Dakar (UTC+0)' },
  { value: 'Europe/Paris',          label: 'Europe/Paris (UTC+1/+2)' },
  { value: 'Europe/London',         label: 'Europe/Londres (UTC+0/+1)' },
  { value: 'UTC',                   label: 'UTC (UTC+0)' },
  { value: 'America/New_York',      label: 'Amérique/New York (UTC-5/-4)' },
  { value: 'America/Chicago',       label: 'Amérique/Chicago (UTC-6/-5)' },
  { value: 'America/Los_Angeles',   label: 'Amérique/Los Angeles (UTC-8/-7)' },
  { value: 'Asia/Dubai',            label: 'Asie/Dubaï (UTC+4)' },
  { value: 'Asia/Shanghai',         label: 'Asie/Shanghai (UTC+8)' },
]

const AVAILABLE_BACKEND_LINKED = new Set([
  'Demandes de congé en attente de validation',
  'Missions créées / modifiées',
  'Commentaires de mission à traiter',
  'Alertes de relance automatiques',
  'Afficher les données de diagnostic',
  'Fuseau horaire',
])

const MENU = [
  'Général',
  'Apparence',
  'Notifications',
  'Missions et validations',
  'Congés et absences',
  'Confidentialité',
  'Accessibilité',
]

const DATA = {
  'Général': [
    {
      title: 'Session EMS',
      rows: [
        { type: 'toggle', label: 'Maintenir la session active', defaultOn: true },
        { type: 'toggle', label: 'Me prévenir avant expiration de session', defaultOn: true },
        { type: 'toggle', label: 'Ouvrir la page Tableau de bord au démarrage', defaultOn: true },
        { type: 'toggle', label: 'Confirmer avant de quitter une page avec modifications non enregistrées', defaultOn: true },
      ],
    },
    {
      title: 'Langue et format',
      rows: [
        { type: 'select', label: 'Langue de l’interface', options: ['Français (France)', 'English'], value: 'Français (France)' },
        { type: 'select', label: 'Format de date', options: ['31/01/2026', '2026-01-31'], value: '31/01/2026' },
        { type: 'select', label: 'Format de l’heure', options: ['01:01 - 23:59', '01:01 AM - 11:59 PM'], value: '01:01 - 23:59' },
        { type: 'timezone', label: 'Fuseau horaire' },
      ],
    },
  ],
  'Apparence': [
    {
      title: 'Affichage',
      rows: [
        { type: 'radio', label: 'Thème', options: ['Clair', 'Sombre'], defaultValue: 'Clair' },
        { type: 'select', label: 'Densité d’affichage', options: ['Compact', 'Normal', 'Confort'], value: 'Compact' },
        { type: 'toggle', label: 'Afficher les infos secondaires dans les listes', defaultOn: true },
        { type: 'toggle', label: 'Réduire les animations', defaultOn: false },
      ],
    },
  ],
  'Notifications': [
    {
      title: 'Alertes métier EMS',
      rows: [
        { type: 'toggle', label: 'Demandes de congé en attente de validation', defaultOn: true },
        { type: 'toggle', label: 'Missions créées / modifiées', defaultOn: true },
        { type: 'toggle', label: 'Commentaires de mission à traiter', defaultOn: true },
        { type: 'toggle', label: 'Alertes de relance automatiques', defaultOn: true },
        { type: 'select', label: 'Canal de notification', options: ['Bannière + centre de notifications', 'Centre de notifications uniquement'], value: 'Bannière + centre de notifications' },
      ],
    },
    {
      title: 'Fréquence',
      rows: [
        { type: 'select', label: 'Résumé des activités manquées', options: ['Toutes les heures', 'Toutes les 4 heures', 'Jamais'], value: 'Toutes les heures' },
        { type: 'select', label: 'Durée d’affichage des notifications', options: ['5 secondes', '10 secondes', '15 secondes'], value: '5 secondes' },
      ],
    },
  ],
  'Missions et validations': [
    {
      title: 'Flux de mission',
      rows: [
        { type: 'toggle', label: 'Afficher la progression de validation dans les cartes mission', defaultOn: true },
        { type: 'toggle', label: 'Demander confirmation avant clôture de mission', defaultOn: true },
        { type: 'toggle', label: 'Afficher les détails multi-destinations par défaut', defaultOn: true },
        { type: 'toggle', label: 'Afficher les coûts de mission dans les listes', defaultOn: true },
      ],
    },
    {
      title: 'Commentaires et relances',
      rows: [
        { type: 'toggle', label: 'Notifier les relances de commentaires en retard', defaultOn: true },
        { type: 'select', label: 'Tri par défaut des missions', options: ['Date la plus récente', 'Priorité', 'Statut'], value: 'Date la plus récente' },
      ],
    },
  ],
  'Congés et absences': [
    {
      title: 'Demandes de congé',
      rows: [
        { type: 'toggle', label: 'Afficher le solde de congés au-dessus du formulaire', defaultOn: true },
        { type: 'toggle', label: 'Alerter en cas de solde insuffisant', defaultOn: true },
        { type: 'toggle', label: 'Demander une confirmation avant annulation d’une demande', defaultOn: true },
        { type: 'select', label: 'Tri par défaut des demandes', options: ['Plus récentes', 'En attente', 'Par employé'], value: 'Plus récentes' },
      ],
    },
  ],
  'Confidentialité': [
    {
      title: 'Protection des données',
      rows: [
        { type: 'toggle', label: 'Masquer les données sensibles dans les notifications', defaultOn: true },
        { type: 'toggle', label: 'Masquer les identifiants internes dans les listes', defaultOn: false },
        { type: 'toggle', label: 'Activer la déconnexion automatique après inactivité', defaultOn: true },
      ],
    },
    {
      title: 'Journalisation',
      rows: [
        { type: 'action', label: 'Afficher les données de diagnostic' },
        { type: 'toggle', label: 'Activer les données de diagnostic étendues (support)', defaultOn: false },
      ],
    },
  ],
  'Accessibilité': [
    {
      title: 'Navigation',
      rows: [
        { type: 'toggle', label: 'Utiliser Entrée/Espace pour ouvrir un élément de liste', defaultOn: true },
        { type: 'select', label: 'Taille de police', options: ['Normale', 'Grande', 'Très grande'], value: 'Normale' },
        { type: 'toggle', label: 'Mode contraste renforcé', defaultOn: false },
      ],
    },
  ],
}

// Module-level save callback (set by Parametrage component)
let _saveSettings = () => {}

export default function Parametrage() {
  const [active, setActive] = useState('Général')
  const [search, setSearch] = useState('')
  const { theme, setTheme } = useTheme()
  const { user } = useAuth()
  const matricule = user?.matricule || user?.sub
  const saveTimer = useRef(null)

  // Load settings from DB on mount
  useEffect(() => {
    if (!matricule) return
    api.get(`/api/settings/${matricule}`).then(res => {
      const s = res.data?.settings || {}
      if (s.theme) setTheme(s.theme)
      if (s.timezone) {
        if (s.timezone === 'auto') localStorage.removeItem(LS_TZ_KEY)
        else localStorage.setItem(LS_TZ_KEY, s.timezone)
        window.dispatchEvent(new Event('ems_tz_changed'))
      }
    }).catch(() => {})
  }, [matricule])

  // Save settings to DB (debounced)
  function saveSettings(patch) {
    if (!matricule) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      api.get(`/api/settings/${matricule}`).then(res => {
        const current = res.data?.settings || {}
        return api.put(`/api/settings/${matricule}`, { settings: { ...current, ...patch } })
      }).catch(() => {})
    }, 500)
  }

  // Register module-level callback for sub-components
  useEffect(() => { _saveSettings = saveSettings }, [matricule])

  const filteredSections = useMemo(() => {
    const query = search.trim().toLowerCase()
    const sections = DATA[active] || []
    if (!query) return sections

    return sections
      .map((section) => ({
        ...section,
        rows: section.rows.filter((row) => {
          const haystack = `${section.title} ${row.label} ${row.sub || ''} ${row.value || ''}`.toLowerCase()
          return haystack.includes(query)
        }),
      }))
      .filter((section) => section.rows.length > 0)
  }, [active, search])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14, minHeight: 'calc(100vh - 110px)' }}>
      <aside style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, boxShadow: '0 4px 14px rgba(2,22,48,0.06)' }}>
        <div style={{ marginBottom: 10, fontSize: '0.94rem', fontWeight: 700, color: '#021630' }}>Paramètres</div>
        <div style={{ display: 'grid', gap: 4 }}>
          {MENU.map((item) => (
            <button
              key={item}
              onClick={() => setActive(item)}
              style={{
                textAlign: 'left',
                padding: '8px 10px',
                border: '1px solid transparent',
                borderRadius: 8,
                background: active === item ? '#021630' : 'transparent',
                color: active === item ? '#ffffff' : '#334155',
                fontSize: '0.82rem',
                fontWeight: active === item ? 700 : 600,
                cursor: 'pointer',
              }}
            >
              {item}
            </button>
          ))}
        </div>
      </aside>

      <section style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, boxShadow: '0 6px 18px rgba(15,23,42,0.06)' }}>
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.06rem', color: '#021630' }}>{active}</h2>
            <div style={{ marginTop: 2, fontSize: '0.76rem', color: '#64748b' }}>Menu contextuel | Trouver dans Paramètres (Ctrl+F)</div>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Trouver dans Paramètres (Ctrl+F)"
            style={{ minWidth: 280, width: '40%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
          />
        </div>

        <div style={{ marginBottom: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: '0.76rem', color: '#334155' }}>
          Légende: <strong style={{ color: '#166534' }}>Disponible EMS</strong> = fonctionnalité déjà active côté backend. <strong style={{ color: '#9a3412' }}>Bientôt disponible</strong> = préférence utilisateur non encore persistée côté backend.
        </div>

        {filteredSections.length === 0 && <EmptyState text="Aucun paramètre ne correspond à votre recherche." />}

        <div style={{ display: 'grid', gap: 10 }}>
          {filteredSections.map((section) => (
            <div key={section.title} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '8px 10px', fontWeight: 700, color: 'var(--text)', fontSize: '0.82rem' }}>
                {section.title}
              </div>
              <div style={{ padding: '8px 10px', display: 'grid', gap: 4 }}>
                {section.rows.map((row, idx) => (
                  <SettingRow key={`${section.title}-${row.label}-${idx}`} row={row} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function SettingRow({ row }) {
  const isAvailable = AVAILABLE_BACKEND_LINKED.has(row.label)
  const { theme, setTheme } = useTheme()

  return (
    <div style={{ borderBottom: '1px solid #f1f5f9', padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: '0.81rem', fontWeight: 600, color: 'var(--text)' }}>{row.label}</div>
        <span style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          borderRadius: 999,
          padding: '2px 8px',
          border: `1px solid ${isAvailable ? '#86efac' : '#fed7aa'}`,
          background: isAvailable ? '#dcfce7' : '#fff7ed',
          color: isAvailable ? '#166534' : '#9a3412',
        }}>
          {isAvailable ? 'Disponible EMS' : 'Bientôt disponible'}
        </span>
      </div>
      {row.sub && <div style={{ marginTop: 2, fontSize: '0.73rem', color: 'var(--text-secondary)' }}>{row.sub}</div>}

      {row.type === 'toggle' && <ToggleSwitch defaultOn={!!row.defaultOn} />}

      {row.type === 'select' && (
        <select defaultValue={row.value} style={{ marginTop: 6, padding: '6px 9px', borderRadius: 7, border: '1px solid #cbd5e1', fontSize: '0.8rem', background: 'var(--card)' }}>
          {(row.options || []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}

      {row.type === 'radio' && row.label === 'Thème' ? (
        <RadioInline
          options={row.options || []}
          value={theme === 'sombre' ? 'Sombre' : 'Clair'}
          onChange={(opt) => { const t = opt === 'Sombre' ? 'sombre' : 'clair'; setTheme(t); _saveSettings({ theme: t }) }}
        />
      ) : row.type === 'radio' ? (
        <RadioInline options={row.options || []} defaultValue={row.defaultValue} />
      ) : null}

      {row.type === 'action' && (
        <button style={{ marginTop: 6, padding: '6px 10px', borderRadius: 7, border: '1px solid #d1d5db', background: 'var(--bg)', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
          {row.label}
        </button>
      )}

      {row.type === 'static' && (
        <div style={{ marginTop: 4, fontSize: '0.8rem', color: 'var(--text)', fontWeight: 600 }}>{row.value}</div>
      )}

      {row.type === 'timezone' && <TimezoneSelect />}

      {row.type === 'chips' && (
        <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(row.values || []).map((value) => (
            <span key={value} style={{ background: '#dbeafe', color: '#1e3a8a', padding: '3px 8px', borderRadius: 999, fontSize: '0.74rem', fontWeight: 700 }}>
              {value}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function TimezoneSelect() {
  const [tz, setTz] = useState(() => localStorage.getItem(LS_TZ_KEY) || 'auto')
  const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone
  function handleChange(e) {
    const val = e.target.value
    setTz(val)
    if (val === 'auto') localStorage.removeItem(LS_TZ_KEY)
    else localStorage.setItem(LS_TZ_KEY, val)
    _saveSettings({ timezone: val })
  }
  return (
    <div style={{ marginTop: 6 }}>
      <select
        value={tz}
        onChange={handleChange}
        style={{ padding: '6px 9px', borderRadius: 7, border: '1px solid #cbd5e1', fontSize: '0.8rem', background: 'var(--card)', minWidth: 280 }}
      >
        {TIMEZONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <div style={{ marginTop: 4, fontSize: '0.72rem', color: '#64748b' }}>
        Fuseau de l’appareil : <strong>{deviceTz}</strong>
      </div>
    </div>
  )
}

function ToggleSwitch({ defaultOn }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <button
      onClick={() => setOn((p) => !p)}
      style={{
        marginTop: 6,
        width: 46,
        height: 24,
        borderRadius: 999,
        border: 'none',
        cursor: 'pointer',
        background: on ? '#0f766e' : '#cbd5e1',
        position: 'relative',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 25 : 3,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#ffffff',
          transition: 'left .2s',
        }}
      />
    </button>
  )
}

function RadioInline({ options, defaultValue, value: controlledValue, onChange }) {
  const [internalValue, setInternalValue] = useState(defaultValue || options[0])
  const isControlled = controlledValue !== undefined
  const selected = isControlled ? controlledValue : internalValue
  const handleClick = (opt) => {
    if (!isControlled) setInternalValue(opt)
    if (onChange) onChange(opt)
  }
  return (
    <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => handleClick(opt)}
          style={{
            border: `1px solid ${selected === opt ? '#021630' : '#d1d5db'}`,
            background: selected === opt ? '#eff6ff' : '#ffffff',
            color: selected === opt ? '#0f172a' : '#475569',
            borderRadius: 999,
            padding: '5px 10px',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function EmptyState({ text }) {
  return (
    <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', borderRadius: 8, padding: 10, marginBottom: 8, fontSize: '0.82rem' }}>
      {text}
    </div>
  )
}
