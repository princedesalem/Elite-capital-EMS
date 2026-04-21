import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { Code, RefreshCw, Play, Trash2, Plus, X } from 'lucide-react'
import { toast, confirmDialog } from '../components/ui/bridge'

const ACCENT = '#ce2b2b'
const DARK = '#021630'

const SAMPLE_ENDPOINTS = [
  { label: 'GET /employees', method: 'GET', path: '/employees' },
  { label: 'GET /dashboard/stats', method: 'GET', path: '/dashboard/stats' },
  { label: 'GET /missions/list', method: 'GET', path: '/missions/list' },
  { label: 'GET /conges', method: 'GET', path: '/conges' },
  { label: 'GET /operations', method: 'GET', path: '/operations' },
]

const LS_SANDBOX_KEY = 'ems_sandbox_notes_v1'
const loadNotes = () => { try { return JSON.parse(localStorage.getItem(LS_SANDBOX_KEY) || '[]') } catch { return [] } }
const saveNotes = (n) => localStorage.setItem(LS_SANDBOX_KEY, JSON.stringify(n))

const FLAG_FEATURES = [
  { key: 'dark_mode', label: 'Mode sombre (expérimental)', description: 'Interface en thème sombre — pas encore disponible' },
  { key: 'ai_suggestions', label: 'Suggestions IA', description: 'Suggestions automatiques dans les formulaires' },
  { key: 'bulk_actions', label: 'Actions en masse', description: 'Sélection multiple et actions groupées sur les listes' },
  { key: 'export_excel', label: 'Export Excel natif', description: 'Exporter les tableaux directement en .xlsx' },
  { key: 'advanced_search', label: 'Recherche avancée', description: 'Filtres multi-critères dans toutes les pages' },
  { key: 'inline_edit', label: 'Édition inline', description: 'Modifier les données directement dans les tableaux' },
]

const FLAGS_KEY = 'ems_feature_flags_v1'
const loadFlags = () => { try { return JSON.parse(localStorage.getItem(FLAGS_KEY) || '{}') } catch { return {} } }
const saveFlags = (f) => localStorage.setItem(FLAGS_KEY, JSON.stringify(f))

export default function SandboxPage() {
  const { user } = useAuth()
  const isAdmin = ['RH', 'DG', 'PCA', 'ADMIN'].includes(user?.role || '')

  // API tester
  const [method, setMethod] = useState('GET')
  const [path, setPath] = useState('/employees')
  const [body, setBody] = useState('')
  const [apiResult, setApiResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState(null)

  // Notes
  const [notes, setNotes] = useState(() => loadNotes())
  const [noteText, setNoteText] = useState('')

  // Feature flags
  const [flags, setFlags] = useState(() => loadFlags())

  // Stats
  const [lsStats, setLsStats] = useState(null)

  const testApi = async (e) => {
    e.preventDefault()
    setLoading(true); setApiResult(null); setApiError(null)
    try {
      let res
      if (method === 'GET') res = await api.get(path)
      else if (method === 'POST') res = await api.post(path, body ? JSON.parse(body) : undefined)
      else if (method === 'PUT') res = await api.put(path, body ? JSON.parse(body) : undefined)
      else if (method === 'DELETE') res = await api.delete(path)
      setApiResult(res.data)
    } catch (err) {
      setApiError(err?.response?.data || err?.message || "Erreur inconnue")
    } finally {
      setLoading(false)
    }
  }

  const addNote = () => {
    if (!noteText.trim()) return
    const updated = [{ id: Date.now(), text: noteText.trim(), at: new Date().toISOString() }, ...notes]
    setNotes(updated); saveNotes(updated); setNoteText('')
  }

  const deleteNote = (id) => {
    const updated = notes.filter(n => n.id !== id); setNotes(updated); saveNotes(updated)
  }

  const toggleFlag = (key) => {
    const updated = { ...flags, [key]: !flags[key] }; setFlags(updated); saveFlags(updated)
  }

  const resetAllLS = async () => {
    const ok = await confirmDialog({ title: 'Vider le cache', message: 'Êtes-vous sûr de vouloir vider le cache local ?', variant: 'warning', confirmLabel: 'Vider le cache' })
    if (!ok) return
    const toKeep = ['auth_token', 'ems_user']
    Object.keys(localStorage).forEach(k => { if (!toKeep.some(s => k.startsWith(s))) localStorage.removeItem(k) })
    toast.success('Cache vidé avec succès')
    window.location.reload()
  }

  const computeLsStats = () => {
    const keys = Object.keys(localStorage)
    const items = keys.map(k => {
      const val = localStorage.getItem(k) || ''
      return { key: k, size: (val.length * 2 / 1024).toFixed(1) + ' KB' }
    }).filter(x => x.key.startsWith('ems_'))
    setLsStats(items)
  }

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(90deg, ${DARK} 0%, #112033 100%)`, color: 'white', padding: '20px 24px', borderRadius: 10, marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Code size={22} /> {"Sandbox"}
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: '0.85rem', opacity: 0.8 }}>{"Espace de test et développement"}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* API Tester */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' }}>
          <h3 style={{ margin: '0 0 14px', color: DARK, fontSize: '0.95rem', fontWeight: 700 }}>{"Testeur d'API"}</h3>

          {/* Quick shortcuts */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {SAMPLE_ENDPOINTS.map(ep => (
              <button key={ep.path} onClick={() => { setMethod(ep.method); setPath(ep.path) }} style={{ padding: '3px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 5, fontSize: '0.7rem', cursor: 'pointer', color: '#334155', fontFamily: 'monospace' }}>
                {ep.label}
              </button>
            ))}
          </div>

          <form onSubmit={testApi} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={method} onChange={e => setMethod(e.target.value)} style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 7, fontSize: '0.82rem', fontWeight: 700, color: method === 'DELETE' ? ACCENT : DARK, width: 90 }}>
                {['GET', 'POST', 'PUT', 'DELETE'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <input value={path} onChange={e => setPath(e.target.value)} style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 7, fontSize: '0.82rem', fontFamily: 'monospace' }} placeholder="/endpoint" />
              <button type="submit" disabled={loading} style={{ padding: '7px 14px', background: DARK, color: 'white', border: 'none', borderRadius: 7, cursor: loading ? 'wait' : 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Play size={13} /> {loading ? '...' : 'Go'}
              </button>
            </div>
            {['POST', 'PUT'].includes(method) && (
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 7, fontSize: '0.78rem', fontFamily: 'monospace', resize: 'vertical' }} placeholder='{"key": "value"}' />
            )}
          </form>

          {(apiResult !== null || apiError) && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: apiError ? ACCENT : DARK }}>{apiError ? 'ERREUR' : 'RÉPONSE'}</span>
                <button onClick={() => { setApiResult(null); setApiError(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.7rem' }}>{"Effacer"}</button>
              </div>
              <pre style={{ background: apiError ? '#fef2f2' : '#f8fafc', padding: '10px', borderRadius: 7, fontSize: '0.72rem', maxHeight: 200, overflow: 'auto', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: apiError ? ACCENT : DARK }}>
                {JSON.stringify(apiError || apiResult, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Feature Flags */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' }}>
          <h3 style={{ margin: '0 0 14px', color: DARK, fontSize: '0.95rem', fontWeight: 700 }}>{"Flags de fonctionnalités"}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {FLAG_FEATURES.map(f => (
              <div key={f.key} title="Fonctionnalité en cours de développement" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--bg)', borderRadius: 8, opacity: 0.7 }}>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: DARK, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {f.label}
                    <span style={{ padding: '2px 8px', background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', borderRadius: 999, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.02em' }}>Bientôt</span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{f.description}</div>
                </div>
                <button
                  disabled
                  title="Bientôt disponible"
                  aria-disabled="true"
                  style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'not-allowed', background: '#e2e8f0', transition: 'background 0.2s', position: 'relative', flexShrink: 0 }}>
                  <span style={{ position: 'absolute', top: 3, left: 3, width: 16, height: 16, borderRadius: '50%', background: 'var(--card)', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Notes Dev */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' }}>
          <h3 style={{ margin: '0 0 12px', color: DARK, fontSize: '0.95rem', fontWeight: 700 }}>{"Notes de développement"}</h3>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <input value={noteText} onChange={e => setNoteText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote()} style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 7, fontSize: '0.82rem' }} placeholder="Ajouter une note..." />
            <button onClick={addNote} style={{ padding: '7px 12px', background: DARK, color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer' }}><Plus size={13} /></button>
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {notes.length === 0 ? <div style={{ fontSize: '0.78rem', color: '#94a3b8', textAlign: 'center', padding: '16px' }}>{"Aucune note"}</div> : (
              notes.map(n => (
                <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 10px', background: 'var(--bg)', borderRadius: 7, border: '1px solid var(--border)' }}>
                  <span style={{ flex: 1, fontSize: '0.78rem', color: '#334155' }}>{n.text}</span>
                  <span style={{ fontSize: '0.65rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>{new Date(n.at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  <button onClick={() => deleteNote(n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 0 }}><X size={12} /></button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Data Management */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' }}>
          <h3 style={{ margin: '0 0 14px', color: DARK, fontSize: '0.95rem', fontWeight: 700 }}>{"Données locales"}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={computeLsStats} style={{ padding: '8px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#334155', textAlign: 'left' }}>
              Voir les données stockées (localStorage)
            </button>
            {lsStats && (
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px', maxHeight: 140, overflowY: 'auto' }}>
                {lsStats.length === 0 ? <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Aucune donnée EMS stockée</div> : (
                  lsStats.map(item => (
                    <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', padding: '2px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ fontFamily: 'monospace', color: '#334155' }}>{item.key}</span>
                      <span style={{ color: '#94a3b8' }}>{item.size}</span>
                    </div>
                  ))
                )}
              </div>
            )}
            <button onClick={resetAllLS} style={{ padding: '8px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: ACCENT, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Trash2 size={14} /> Réinitialiser toutes les données locales
            </button>
              <div style={{ padding: '8px 12px', background: 'var(--bg)', borderRadius: 8, fontSize: '0.72rem', color: '#64748b', border: '1px solid var(--border)' }}>
              La réinitialisation efface les tâches, événements, clubs, évaluations 360°, etc. stockées localement. Les données backend sont préservées.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
