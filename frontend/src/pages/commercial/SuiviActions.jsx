import React, { useEffect, useState, useCallback } from 'react'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { CheckCircle2, Clock, AlertTriangle, Edit3, X, ListChecks } from 'lucide-react'
import { BRAND_GRADIENT, BRAND_NAVY, BRAND_RED } from '../../theme'

const READONLY = ['DG', 'PCA', 'AG', 'ADMIN']

export default function SuiviActions() {
  const { user } = useAuth()
  const role = String(user?.role || '').toUpperCase()
  const isReadOnly = READONLY.includes(role)

  const [actions, setActions] = useState([])
  const [filters, setFilters] = useState({ statut: '', responsable_matricule: '', charge_matricule: '', en_retard: false })
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // {memo_id, id, ...}
  const [editForm, setEditForm] = useState(null)

  const load = useCallback(async () => {
    try {
      const params = {}
      if (filters.statut) params.statut = filters.statut
      if (filters.responsable_matricule) params.responsable_matricule = filters.responsable_matricule
      if (filters.charge_matricule) params.charge_matricule = filters.charge_matricule
      if (filters.en_retard) params.en_retard = true
      const r = await api.get('/api/commercial/actions', { params })
      setActions(Array.isArray(r.data) ? r.data : [])
    } catch (e) { setError(e?.response?.data?.detail || 'Erreur de chargement') }
  }, [filters])

  useEffect(() => { load() }, [load])

  function startEdit(a) {
    setEditing(a)
    setEditForm({
      statut: a.statut || 'OUVERT',
      date_depart: a.date_depart || '',
      date_effective_fin: a.date_effective_fin || '',
      justificatif: a.justificatif || '',
      commentaires: a.commentaires || '',
    })
  }
  async function submitEdit(e) {
    e.preventDefault()
    setError('')
    try {
      const payload = { ...editForm }
      if (!payload.date_depart) payload.date_depart = null
      if (!payload.date_effective_fin) payload.date_effective_fin = null
      await api.patch(`/api/commercial/call-memos/${editing.memo_id}/plans/${editing.id}`, payload)
      setEditing(null); setEditForm(null); load()
    } catch (err) { setError(err?.response?.data?.detail || 'Erreur') }
  }

  const total = actions.length
  const ouvert = actions.filter((a) => a.statut === 'OUVERT' && !a.en_retard).length
  const ferme = actions.filter((a) => a.statut === 'FERME').length
  const enRetard = actions.filter((a) => a.en_retard).length

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: BRAND_NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ListChecks size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: BRAND_NAVY }}>Suivi des actions</h1>
            <p style={{ margin: '2px 0 0', color: '#667085', fontSize: '0.85rem' }}>Plans d’action issus de tous les call memos — vue globale</p>
          </div>
        </div>
      </div>

      <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
          <Kpi icon={<ListChecks size={20} />} label="Total" value={total} color={BRAND_NAVY} />
          <Kpi icon={<Clock size={20} />} label="Ouvertes" value={ouvert} color="#c47a1d" />
          <Kpi icon={<CheckCircle2 size={20} />} label="Fermées" value={ferme} color="#1f7a3d" />
          <Kpi icon={<AlertTriangle size={20} />} label="En retard" value={enRetard} color={BRAND_RED} />
        </div>

        <div style={{ background: '#fff', padding: 16, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={lblFilter}>Statut :
            <select value={filters.statut} onChange={(e) => setFilters({ ...filters, statut: e.target.value })} style={inp}>
              <option value="">Tous</option>
              <option value="OUVERT">Ouvert</option>
              <option value="FERME">Fermé</option>
              <option value="EN_RETARD">En retard</option>
            </select>
          </label>
          <label style={lblFilter}>Responsable (matricule) :
            <input value={filters.responsable_matricule} onChange={(e) => setFilters({ ...filters, responsable_matricule: e.target.value })} style={inp} placeholder="—" />
          </label>
          <label style={lblFilter}>Chargé (matricule) :
            <input value={filters.charge_matricule} onChange={(e) => setFilters({ ...filters, charge_matricule: e.target.value })} style={inp} placeholder="—" />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <input type="checkbox" checked={filters.en_retard} onChange={(e) => setFilters({ ...filters, en_retard: e.target.checked })} />
            <span style={{ fontSize: '0.88rem' }}>En retard uniquement</span>
          </label>
        </div>

        {error && <div style={{ padding: '10px 14px', background: '#fee', color: '#9a1010', borderRadius: 6, marginBottom: 12 }}>{error}</div>}

        <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={th}>Client</th>
                <th style={th}>Action</th>
                <th style={th}>Montant</th>
                <th style={th}>Délai</th>
                <th style={th}>Responsable</th>
                <th style={th}>Statut</th>
                <th style={th}>Date fin réelle</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {actions.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#888' }}>Aucune action</td></tr>}
              {actions.map((a) => (
                <tr key={a.id} style={{ borderBottom: '1px solid #f0f1f3', background: '#fff', borderLeft: a.en_retard ? `3px solid ${BRAND_RED}` : '3px solid transparent' }}>
                  <td style={td}><strong style={{ color: BRAND_NAVY }}>{a.nom_client || '-'}</strong><div style={{ fontSize: '0.78rem', color: '#667085' }}>{a.memo_date_visite}</div></td>
                  <td style={{ ...td, maxWidth: 350 }}>{a.libelle}</td>
                  <td style={td}>{a.montant ? Number(a.montant).toLocaleString('fr-FR') + ' ' + (a.devise || 'XOF') : '-'}</td>
                  <td style={td}>{a.delai_execution || '-'}</td>
                  <td style={td}>{a.responsable || '-'}</td>
                  <td style={td}>
                    <StatusTag statut={a.statut} enRetard={a.en_retard} />
                  </td>
                  <td style={td}>{a.date_effective_fin || '-'}</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    {!isReadOnly && (
                      <button onClick={() => startEdit(a)} style={{ background: 'transparent', border: 0, padding: 6, cursor: 'pointer', color: BRAND_NAVY }} title="Mettre à jour"><Edit3 size={14} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && editForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,22,46,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <form onSubmit={submitEdit} style={{ background: '#fff', borderRadius: 10, width: '100%', maxWidth: 560, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: BRAND_NAVY }}>Mettre à jour l’action</h2>
              <button type="button" onClick={() => { setEditing(null); setEditForm(null) }} style={{ background: 'transparent', border: 0, color: '#667085', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ padding: 20, display: 'grid', gap: 10 }}>
              <div style={{ fontSize: '0.85rem', color: '#667085', background: '#f9fafb', padding: '8px 10px', borderRadius: 6 }}>
                <strong>{editing.nom_client}</strong> · {editing.libelle}
              </div>
              <Field label="Statut">
                <select value={editForm.statut} onChange={(e) => setEditForm({ ...editForm, statut: e.target.value })} style={inp}>
                  <option value="OUVERT">Ouvert</option>
                  <option value="FERME">Fermé</option>
                  <option value="EN_RETARD">En retard</option>
                </select>
              </Field>
              <div style={{ display: 'flex', gap: 10 }}>
                <Field label="Date départ" full><input type="date" value={editForm.date_depart || ''} onChange={(e) => setEditForm({ ...editForm, date_depart: e.target.value })} style={inp} /></Field>
                <Field label="Date fin effective" full><input type="date" value={editForm.date_effective_fin || ''} onChange={(e) => setEditForm({ ...editForm, date_effective_fin: e.target.value })} style={inp} /></Field>
              </div>
              <Field label="Justificatif"><textarea rows={2} value={editForm.justificatif} onChange={(e) => setEditForm({ ...editForm, justificatif: e.target.value })} style={{ ...inp, fontFamily: 'inherit' }} /></Field>
              <Field label="Commentaires"><textarea rows={3} value={editForm.commentaires} onChange={(e) => setEditForm({ ...editForm, commentaires: e.target.value })} style={{ ...inp, fontFamily: 'inherit' }} /></Field>
              {error && <div style={{ color: '#9a1010', fontSize: '0.85rem' }}>{error}</div>}
            </div>
            <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #f0f1f3' }}>
              <button type="button" onClick={() => { setEditing(null); setEditForm(null) }} style={btnSecondary}>Annuler</button>
              <button type="submit" style={btnPrimary}>Mettre à jour</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

const inp = { padding: '7px 10px', border: '1px solid #d0d5dd', borderRadius: 6, fontSize: '0.88rem', boxSizing: 'border-box', width: '100%' }
const lblFilter = { display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }
const th = { padding: '12px 14px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 600, color: '#475467', textTransform: 'uppercase', letterSpacing: '0.04em' }
const td = { padding: '10px 14px', color: '#1d2939', verticalAlign: 'top' }
const btnPrimary = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: BRAND_NAVY, color: '#fff', border: 0, borderRadius: 6, cursor: 'pointer', fontWeight: 600 }
const btnSecondary = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: '#fff', color: BRAND_NAVY, border: `1px solid ${BRAND_NAVY}`, borderRadius: 6, cursor: 'pointer', fontWeight: 600 }

function StatusTag({ statut, enRetard }) {
  if (enRetard) return <span style={{ display: 'inline-block', padding: '3px 9px', background: `${BRAND_RED}15`, color: BRAND_RED, borderRadius: 4, fontSize: '0.78rem', fontWeight: 600 }}>EN RETARD</span>
  const map = {
    OUVERT: { c: '#c47a1d', label: 'Ouvert' },
    FERME: { c: '#1f7a3d', label: 'Fermé' },
    EN_RETARD: { c: BRAND_RED, label: 'En retard' },
  }
  const m = map[statut] || map.OUVERT
  return <span style={{ display: 'inline-block', padding: '3px 9px', background: `${m.c}15`, color: m.c, borderRadius: 4, fontSize: '0.78rem', fontWeight: 600 }}>{m.label.toUpperCase()}</span>
}
function Kpi({ icon, label, value, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: 16, borderLeft: `4px solid ${color}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ color, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: '0.78rem', color: '#667085', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color, marginTop: 4 }}>{value}</div>
    </div>
  )
}
function Field({ label, full, children }) {
  return (
    <div style={{ flex: full ? '1 1 0' : 'auto' }}>
      <label style={{ display: 'block', fontSize: '0.78rem', color: '#475467', marginBottom: 4, fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  )
}
