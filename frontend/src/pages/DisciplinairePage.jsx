import React, { useState, useCallback, useEffect, useRef } from 'react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ui/ToastProvider'
import { ShieldAlert, Plus, Pencil, Trash2, Loader, RefreshCw, X } from 'lucide-react'
const ROLES_RH = ['RH', 'DIRECTEUR', 'DG', 'PCA', 'AG', 'RESPONSABLE']

// ── Autocomplete employé (réutilisable, même pattern que DemandeExplicationPage) ──
function EmployeeAutocomplete({ value, onChange, initialQuery }) {
  const [query, setQuery] = useState(initialQuery || '')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef()

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchSuggestions = useCallback(async (q) => {
    setLoading(true)
    try {
      const r = await api.get('/employees/autocomplete/employes', { params: { q: q || '', limit: 20 } })
      setSuggestions(Array.isArray(r.data) ? r.data : [])
      setOpen(true)
    } catch { setSuggestions([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (!query.trim()) { setSuggestions([]); setOpen(false); return }
    const timer = setTimeout(() => fetchSuggestions(query), 180)
    return () => clearTimeout(timer)
  }, [query, fetchSuggestions])

  const select = (emp) => {
    onChange(emp.matricule)
    setQuery(`${emp.matricule} — ${(emp.nom || '').toUpperCase()} ${emp.prenom || ''}`.trim())
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); if (!e.target.value) onChange('') }}
        onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
        placeholder="Nom ou matricule de l'employé"
        autoComplete="off"
        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
      />
      {loading && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: '#94a3b8' }}>…</span>}
      {open && suggestions.length > 0 && (
        <ul style={{
          position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 300,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', margin: 0, padding: 0,
          listStyle: 'none', maxHeight: 240, overflowY: 'auto',
        }}>
          {suggestions.map((emp) => (
            <li
              key={emp.matricule}
              onMouseDown={() => select(emp)}
              style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#fff' }}
            >
              <div style={{ fontSize: '0.88rem', color: '#021630' }}>{(emp.nom || '').toUpperCase()} {emp.prenom}</div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{emp.matricule}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const TYPE_LABELS = {
  blame: 'Blâme',
  avertissement: 'Avertissement',
  sanction: 'Sanction',
  conseil_discipline: 'Conseil de discipline',
}

const TYPE_COLORS = {
  blame:              { color: '#92400e', bg: '#fef3c7', border: '#fde68a' },
  avertissement:      { color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
  sanction:           { color: '#991b1b', bg: '#fef2f2', border: '#fecaca' },
  conseil_discipline: { color: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe' },
}

function GraviteStars({ value }) {
  return (
    <span>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ color: i <= value ? '#f59e0b' : '#e2e8f0', fontSize: '0.85rem' }}>★</span>
      ))}
    </span>
  )
}

function ModalMesure({ initial, onClose, onSaved }) {
  const [form, setForm] = useState({
    matricule: initial?.matricule || '',
    type_mesure: initial?.type_mesure || 'avertissement',
    motif: initial?.motif || '',
    gravite: initial?.gravite || 1,
    date_mesure: initial?.date_mesure || new Date().toISOString().split('T')[0],
  })
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const submit = async () => {
    if (!form.matricule || !form.motif.trim()) {
      toast.warning('Matricule et motif sont requis.')
      return
    }
    setLoading(true)
    try {
      if (initial?.id_mesure) {
        await api.put(`/api/disciplinaire/${initial.id_mesure}`, form)
        toast.success('Mesure modifiée.')
      } else {
        await api.post('/api/disciplinaire/', form)
        toast.success('Mesure créée.')
      }
      onSaved()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Erreur lors de l\'enregistrement.')
    } finally {
      setLoading(false)
    }
  }

  const field = (label, key, type = 'text', opts = {}) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: 5 }}>
        {label}
      </label>
      {opts.select ? (
        <select
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
          style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
        >
          {opts.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : opts.textarea ? (
        <textarea
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          rows={3}
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.88rem', resize: 'vertical' }}
        />
      ) : (
        <input
          type={type}
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
        />
      )}
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 460, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#02162e' }}>
            {initial?.id_mesure ? 'Modifier la mesure' : 'Nouvelle mesure disciplinaire'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: 5 }}>
            Employé concerné *
          </label>
          <EmployeeAutocomplete
            value={form.matricule}
            onChange={(m) => setForm((f) => ({ ...f, matricule: m }))}
            initialQuery={initial?.matricule || ''}
          />
        </div>
        {field('Type de mesure *', 'type_mesure', 'text', {
          select: true,
          options: Object.entries(TYPE_LABELS).map(([v, l]) => ({ value: v, label: l })),
        })}
        {field('Motif *', 'motif', 'text', { textarea: true })}
        {field('Gravité (1-5) *', 'gravite', 'number', {
          select: true,
          options: [1, 2, 3, 4, 5].map((v) => ({ value: v, label: `${v} — ${'★'.repeat(v)}` })),
        })}
        {field('Date de la mesure *', 'date_mesure', 'date')}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1.5px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: '0.85rem', color: '#64748b' }}>
            Annuler
          </button>
          <button onClick={submit} disabled={loading} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#02162e', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 600, opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            {loading ? <Loader size={13} /> : null}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DisciplinairePage() {
  const { user } = useAuth()
  const [mesures, setMesures] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const toast = useToast()

  const isRH = ROLES_RH.includes((user?.role || '').toUpperCase())
  const matricule = user?.matricule || user?.sub

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const endpoint = isRH ? '/api/disciplinaire/' : `/api/disciplinaire/employe/${matricule}`
      const r = await api.get(endpoint)
      setMesures(Array.isArray(r.data) ? r.data : [])
    } catch {
      toast.error('Impossible de charger les mesures disciplinaires.')
    } finally {
      setLoading(false)
    }
  }, [isRH, matricule])

  useEffect(() => { load() }, [load])

  const deleteMesure = async (id) => {
    if (!window.confirm('Supprimer cette mesure ?')) return
    try {
      await api.delete(`/api/disciplinaire/${id}`)
      toast.success('Mesure supprimée.')
      load()
    } catch {
      toast.error('Erreur lors de la suppression.')
    }
  }

  const filtered = mesures.filter((m) => {
    if (!search) return true
    const q = search.toLowerCase()
    return m.matricule.toLowerCase().includes(q)
      || (m.nom_employe || '').toLowerCase().includes(q)
      || m.motif.toLowerCase().includes(q)
  })

  return (
    <div style={{ padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert size={20} color="#991b1b" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: '#02162e' }}>Gestion Disciplinaire</h1>
            <p style={{ margin: '2px 0 0', fontSize: '0.83rem', color: '#64748b' }}>Blâmes, avertissements, sanctions et conseils de discipline</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.83rem', color: '#64748b' }}>
            <RefreshCw size={13} /> Actualiser
          </button>
          {isRH && (
            <button onClick={() => { setEditing(null); setShowModal(true) }} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#02162e', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 600 }}>
              <Plus size={14} /> Nouvelle mesure
            </button>
          )}
        </div>
      </div>

      {/* Recherche */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher par matricule, nom ou motif…"
        style={{ width: '100%', boxSizing: 'border-box', padding: '9px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.88rem', marginBottom: 16 }}
      />

      {/* Tableau */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}><Loader size={24} /></div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, background: '#f8fafc', borderRadius: 12, border: '1px dashed #cbd5e1', color: '#94a3b8' }}>
          <ShieldAlert size={32} style={{ marginBottom: 10, opacity: 0.4 }} />
          <div style={{ fontWeight: 600 }}>Aucune mesure disciplinaire</div>
          {isRH && <div style={{ fontSize: '0.85rem', marginTop: 4 }}>Créez la première avec le bouton ci-dessus.</div>}
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.87rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Employé', 'Type', 'Gravité', 'Motif', 'Date', isRH ? 'Actions' : ''].filter(Boolean).map((h) => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const tc = TYPE_COLORS[m.type_mesure] || { color: '#475569', bg: '#f1f5f9', border: '#e2e8f0' }
                return (
                  <tr key={m.id_mesure} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{m.nom_employe}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{m.matricule}</div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: '0.77rem', fontWeight: 600, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>
                        {TYPE_LABELS[m.type_mesure] || m.type_mesure}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}><GraviteStars value={m.gravite} /></td>
                    <td style={{ padding: '10px 14px', maxWidth: 240, color: '#475569' }}>{m.motif}</td>
                    <td style={{ padding: '10px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {m.date_mesure ? new Date(m.date_mesure).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    {isRH && (
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => { setEditing(m); setShowModal(true) }} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#475569' }}>
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => deleteMesure(m.id_mesure)} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', color: '#991b1b' }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <ModalMesure
          initial={editing}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSaved={() => { setShowModal(false); setEditing(null); load() }}
        />
      )}
    </div>
  )
}
