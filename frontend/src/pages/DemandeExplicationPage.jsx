import React, { useEffect, useState, useCallback, useRef } from 'react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ui/ToastProvider'
import {
  FileText, Plus, Clock, CheckCircle2, XCircle, Send,
  ChevronDown, ChevronUp, Loader, RefreshCw, X,
} from 'lucide-react'

const ROLES_INITIATEURS = ['RH', 'ADMIN', 'DIRECTEUR', 'DG', 'PCA']

// ── Statut badges ────────────────────────────────────────────────────────────
const STATUT_CONFIG = {
  EN_ATTENTE: { label: 'En attente',  bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  REPONDU:    { label: 'Répondu',     bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  CLOS:       { label: 'Clos',        bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
}

function StatutBadge({ statut }) {
  const c = STATUT_CONFIG[statut] || { label: statut, bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 20,
      fontSize: '0.77rem', fontWeight: 600,
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
    }}>
      {c.label}
    </span>
  )
}

// ── EmployeeAutocomplete (local copy for this page) ──────────────────────────
function EmployeeAutocomplete({ value, onChange }) {
  const [query, setQuery] = useState('')
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
      const r = await api.get('/employees/autocomplete/employes', {
        params: { q: q || '', limit: 20 },
      })
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
    <div ref={ref} style={{ position: 'relative', flex: 1 }}>
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); if (!e.target.value) onChange('') }}
        onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
        placeholder="Nom ou matricule de l'employé"
        autoComplete="off"
        style={{
          width: '100%', boxSizing: 'border-box', padding: '8px 12px',
          borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.88rem',
        }}
      />
      {loading && (
        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: '#94a3b8' }}>…</span>
      )}
      {open && suggestions.length > 0 && (
        <ul style={{
          position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 200,
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
              <div style={{ fontSize: '0.88rem', color: '#021630' }}>
                {(emp.nom || '').toUpperCase()} {emp.prenom}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{emp.matricule}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Modale Créer DE ───────────────────────────────────────────────────────────
function ModalCreerDE({ onClose, onCreated }) {
  const [matricule, setMatricule] = useState('')
  const [motif, setMotif] = useState('')
  const [delai, setDelai] = useState(72)
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const submit = async () => {
    if (!matricule || !motif.trim()) {
      toast.warning('Veuillez renseigner l\'employé et le motif.')
      return
    }
    setLoading(true)
    try {
      await api.post('/api/de/initier',
        { matricule_employe: matricule, motif: motif.trim(), delai_heures: delai }
      )
      toast.success('Demande d\'explication créée.')
      onCreated()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Erreur lors de la création.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 500,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, padding: 32, width: 480, maxWidth: '95vw',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#02162e' }}>
            Initier une demande d'explication
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
            Employé concerné *
          </label>
          <EmployeeAutocomplete value={matricule} onChange={setMatricule} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
            Motif *
          </label>
          <textarea
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            rows={4}
            placeholder="Décrivez le motif de la demande d'explication..."
            style={{
              width: '100%', boxSizing: 'border-box', padding: '8px 12px',
              borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.88rem',
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
            Délai de réponse
          </label>
          <select
            value={delai}
            onChange={(e) => setDelai(Number(e.target.value))}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
          >
            <option value={24}>24 heures</option>
            <option value={48}>48 heures</option>
            <option value={72}>72 heures (défaut)</option>
            <option value={120}>5 jours</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 20px', borderRadius: 8, border: '1.5px solid #cbd5e1',
              background: '#fff', cursor: 'pointer', fontSize: '0.88rem', color: '#64748b',
            }}
          >
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={loading}
            style={{
              padding: '9px 20px', borderRadius: 8, border: 'none',
              background: '#02162e', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.88rem', fontWeight: 600, opacity: loading ? 0.7 : 1,
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            {loading ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
            Envoyer
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Carte DE (détail expand) ──────────────────────────────────────────────────
function DECard({ de, isRH, onAction }) {
  const [expanded, setExpanded] = useState(false)
  const [reponse, setReponse] = useState('')
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const submitReponse = async () => {
    if (!reponse.trim()) { toast.warning('La réponse ne peut pas être vide.'); return }
    setLoading(true)
    try {
      await api.post(`/api/de/${de.id_de}/repondre`,
        { reponse: reponse.trim() }
      )
      toast.success('Réponse envoyée.')
      onAction()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Erreur lors de l\'envoi.')
    } finally {
      setLoading(false)
    }
  }

  const clore = async () => {
    setLoading(true)
    try {
      await api.put(`/api/de/${de.id_de}/clore`, {})
      toast.success('Demande d\'explication clôturée.')
      onAction()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Erreur.')
    } finally {
      setLoading(false)
    }
  }

  const dateLimit = de.date_limite_reponse ? new Date(de.date_limite_reponse) : null
  const isOverdue = dateLimit && de.statut === 'EN_ATTENTE' && dateLimit < new Date()

  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
      marginBottom: 12, overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      {/* Header card */}
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{
          padding: '14px 20px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: expanded ? '1px solid #f1f5f9' : 'none',
          background: expanded ? '#fafbfc' : '#fff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <FileText size={16} color="#94a3b8" />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>
              {isRH ? de.nom_employe : `DE #${de.id_de}`}
              {isRH && <span style={{ marginLeft: 8, fontSize: '0.78rem', color: '#94a3b8' }}>({de.matricule_employe})</span>}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 2 }}>
              {isRH ? `Créé par ${de.nom_createur}` : `De ${de.nom_createur}`}
              {' · '}
              {de.cree_le ? new Date(de.cree_le).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isOverdue && (
            <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>En retard</span>
          )}
          <StatutBadge statut={de.statut} />
          {expanded ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
        </div>
      </div>

      {/* Corps expandable */}
      {expanded && (
        <div style={{ padding: '16px 20px' }}>
          {/* Motif */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Motif
            </div>
            <div style={{
              background: '#fef3c7', borderRadius: 8, padding: '10px 14px',
              fontSize: '0.88rem', color: '#1e293b', borderLeft: '3px solid #f59e0b',
            }}>
              {de.motif}
            </div>
          </div>

          {/* Délai */}
          {de.date_limite_reponse && (
            <div style={{ marginBottom: 14, fontSize: '0.82rem', color: isOverdue ? '#dc2626' : '#64748b' }}>
              <Clock size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Délai : {new Date(de.date_limite_reponse).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}

          {/* Réponse existante */}
          {de.reponse_employe && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Réponse de l'employé
              </div>
              <div style={{
                background: '#eff6ff', borderRadius: 8, padding: '10px 14px',
                fontSize: '0.88rem', color: '#1e293b', borderLeft: '3px solid #3b82f6',
              }}>
                {de.reponse_employe}
              </div>
              {de.date_reponse && (
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>
                  Répondu le {new Date(de.date_reponse).toLocaleString('fr-FR')}
                </div>
              )}
            </div>
          )}

          {/* Clôture */}
          {de.statut === 'CLOS' && de.clos_le && (
            <div style={{ fontSize: '0.78rem', color: '#15803d' }}>
              <CheckCircle2 size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Clôturé le {new Date(de.clos_le).toLocaleString('fr-FR')} par {de.clos_par}
            </div>
          )}

          {/* Action : répondre (employé, statut EN_ATTENTE) */}
          {!isRH && de.statut === 'EN_ATTENTE' && (
            <div style={{ marginTop: 14 }}>
              <textarea
                value={reponse}
                onChange={(e) => setReponse(e.target.value)}
                rows={3}
                placeholder="Votre réponse..."
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '8px 12px',
                  borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.88rem',
                  resize: 'vertical', marginBottom: 10,
                }}
              />
              <button
                onClick={submitReponse}
                disabled={loading}
                style={{
                  padding: '8px 18px', borderRadius: 8, border: 'none',
                  background: '#02162e', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? <Loader size={13} /> : <Send size={13} />}
                Soumettre ma réponse
              </button>
            </div>
          )}

          {/* Action : clore (RH, statut REPONDU) */}
          {isRH && de.statut === 'REPONDU' && (
            <button
              onClick={clore}
              disabled={loading}
              style={{
                marginTop: 10, padding: '8px 18px', borderRadius: 8, border: 'none',
                background: '#15803d', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? <Loader size={13} /> : <CheckCircle2 size={13} />}
              Clore la demande
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function DemandeExplicationPage() {
  const { user } = useAuth()
  const [des, setDes] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState('tous')
  const toast = useToast()

  const isRH = ROLES_INITIATEURS.includes((user?.role || '').toUpperCase())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const endpoint = isRH ? '/api/de/' : '/api/de/mes-demandes'
      const r = await api.get(endpoint)
      setDes(Array.isArray(r.data) ? r.data : [])
    } catch {
      toast.error('Impossible de charger les demandes d\'explication.')
    } finally {
      setLoading(false)
    }
  }, [isRH])

  useEffect(() => { load() }, [load])

  const filtered = des.filter((d) => {
    if (filter === 'tous') return true
    return d.statut === filter
  })

  const counts = {
    EN_ATTENTE: des.filter((d) => d.statut === 'EN_ATTENTE').length,
    REPONDU:    des.filter((d) => d.statut === 'REPONDU').length,
    CLOS:       des.filter((d) => d.statut === 'CLOS').length,
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 860, margin: '0 auto' }}>
      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 700, color: '#02162e' }}>
            Demandes d'explication
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: '#64748b' }}>
            {isRH
              ? 'Gérez les demandes d\'explication de tous les employés'
              : 'Vos demandes d\'explication en cours'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={load}
            style={{
              padding: '8px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0',
              background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              fontSize: '0.85rem', color: '#64748b',
            }}
          >
            <RefreshCw size={14} /> Actualiser
          </button>
          {isRH && (
            <button
              onClick={() => setShowModal(true)}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: '#02162e', color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: '0.85rem', fontWeight: 600,
              }}
            >
              <Plus size={14} /> Nouvelle DE
            </button>
          )}
        </div>
      </div>

      {/* KPI rapides */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { key: 'EN_ATTENTE', label: 'En attente', icon: Clock, color: '#c2410c', bg: '#fff7ed' },
          { key: 'REPONDU',    label: 'Répondues',  icon: Send,  color: '#1d4ed8', bg: '#eff6ff' },
          { key: 'CLOS',       label: 'Clôturées',  icon: CheckCircle2, color: '#15803d', bg: '#f0fdf4' },
        ].map(({ key, label, icon: Icon, color, bg }) => (
          <button
            key={key}
            onClick={() => setFilter(filter === key ? 'tous' : key)}
            style={{
              background: filter === key ? bg : '#fff',
              border: `1.5px solid ${filter === key ? color : '#e2e8f0'}`,
              borderRadius: 10, padding: '12px 16px', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Icon size={16} color={color} />
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{label}</span>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color }}>{counts[key]}</div>
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
          <Loader size={24} style={{ marginBottom: 8 }} />
          <div>Chargement…</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 48, background: '#f8fafc',
          borderRadius: 12, border: '1px dashed #cbd5e1', color: '#94a3b8',
        }}>
          <FileText size={32} style={{ marginBottom: 10 }} />
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Aucune demande d'explication</div>
          <div style={{ fontSize: '0.85rem' }}>
            {filter !== 'tous' ? 'Modifiez le filtre pour voir les autres DEs.' : isRH ? 'Créez la première avec le bouton "Nouvelle DE".' : 'Aucune DE ne vous a été adressée.'}
          </div>
        </div>
      ) : (
        <div>
          {filter !== 'tous' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <StatutBadge statut={filter} />
              <span style={{ fontSize: '0.82rem', color: '#64748b' }}>{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</span>
              <button
                onClick={() => setFilter('tous')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.82rem', marginLeft: 4 }}
              >
                × Effacer
              </button>
            </div>
          )}
          {filtered.map((de) => (
            <DECard key={de.id_de} de={de} isRH={isRH} onAction={load} />
          ))}
        </div>
      )}

      {showModal && (
        <ModalCreerDE
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}
