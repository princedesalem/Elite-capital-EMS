import React, { useEffect, useMemo, useState } from 'react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'

const th = { padding: '8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontSize: '0.7rem', color: '#64748b', fontWeight: 700, whiteSpace: 'nowrap' }
const td = { padding: '8px', borderBottom: '1px solid #f1f5f9', fontSize: '0.76rem', color: '#111827', verticalAlign: 'middle', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const rowBtn = { padding: '4px 7px', border: 'none', borderRadius: 5, fontWeight: 700, cursor: 'pointer', fontSize: '0.68rem', color: '#fff' }
const primaryBtn = { ...rowBtn, background: '#2563eb' }
const dangerBtn = { ...rowBtn, background: '#ef4444' }
const okBtn = { ...rowBtn, background: '#10b981' }
const warnBtn = { ...rowBtn, background: '#f59e0b' }

const fmtDate = value => value ? new Date(value).toLocaleDateString('fr-FR') : '-'
const isValidated = value => ['valide', 'validé'].includes((value || '').toLowerCase())
const statusColor = (value) => ({
  'en attente': '#f59e0b',
  'en cours': '#3b82f6',
  'validé': '#10b981',
  'valide': '#10b981',
  'refusé': '#ef4444',
  'annulé': '#6b7280',
}[String(value || '').toLowerCase()] || '#64748b')
const renderStatusBadge = (value) => {
  const label = value || 'en attente'
  const color = statusColor(label)
  return <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color, background: `${color}22` }}>{label}</span>
}
const fieldLabel = { fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 4, display: 'block' }
const calcDurationHours = (heureSortie, heureRetour) => {
  if (!heureSortie || !heureRetour) return '-'
  const [hs, ms] = String(heureSortie).split(':').map(Number)
  const [hr, mr] = String(heureRetour).split(':').map(Number)
  if (Number.isNaN(hs) || Number.isNaN(ms) || Number.isNaN(hr) || Number.isNaN(mr)) return '-'
  let minutes = (hr * 60 + mr) - (hs * 60 + ms)
  if (minutes < 0) minutes += 24 * 60
  const hours = (minutes / 60)
  return `${hours.toFixed(2)} h`
}

function Tabs({ active, setActive, counts }) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
      {[['envoye', 'Envoye', counts.envoye], ['recu', 'Recu', counts.recu]].map(([key, label, count]) => (
        <button key={key} onClick={() => setActive(key)} style={{ flex: 1, padding: '10px 8px', border: 'none', cursor: 'pointer', background: active === key ? '#fff' : '#f9fafb', fontWeight: active === key ? 700 : 500, fontSize: '0.82rem', borderBottom: active === key ? '2px solid #ce2b2b' : '2px solid transparent', color: active === key ? '#ce2b2b' : '#6b7280' }}>
          {label}
          {count > 0 && <span style={{ marginLeft: 5, padding: '1px 6px', borderRadius: 999, fontSize: '0.68rem', background: active === key ? '#ce2b2b' : '#e5e7eb', color: active === key ? '#fff' : '#374151' }}>{count}</span>}
        </button>
      ))}
    </div>
  )
}

function FilterBar({ date, setDate, statut, setStatut, source, setSource, emetteur, setEmetteur, etat, setEtat }) {
  return (
    <div style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6', background: '#fafafa', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="month" value={date} onChange={e => setDate(e.target.value)} style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: '0.78rem', minWidth: 120 }} />
      <select value={statut} onChange={e => setStatut(e.target.value)} style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: '0.78rem', minWidth: 110 }}>
        <option value="">Tous statuts</option>
        {['en attente', 'en cours', 'validé', 'refusé', 'annulé'].map(value => <option key={value} value={value}>{value}</option>)}
      </select>
      <input type="text" value={source} onChange={e => setSource(e.target.value)} placeholder="Source" style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: '0.78rem', minWidth: 100 }} />
      <input type="text" value={emetteur} onChange={e => setEmetteur(e.target.value)} placeholder="Emetteur" style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: '0.78rem', minWidth: 120 }} />
      <select value={etat} onChange={e => setEtat(e.target.value)} style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: '0.78rem', minWidth: 100 }}>
        <option value="">Tous etats</option>
        {['--', 'Active', 'Cloturee'].map(value => <option key={value} value={value}>{value}</option>)}
      </select>
      {(date || statut || source || emetteur || etat) && <button onClick={() => { setDate(''); setStatut(''); setSource(''); setEmetteur(''); setEtat('') }} style={{ padding: '5px 9px', borderRadius: 5, border: '1px solid #f87171', background: '#fee2e2', color: '#991b1b', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}>Reinitialiser</button>}
    </div>
  )
}

export default function SortiesPage() {
  const { user } = useAuth()
  const today = new Date().toISOString().split('T')[0]

  const [activeTab, setActiveTab] = useState('envoye')
  const [showNewForm, setShowNewForm] = useState(false)
  const [form, setForm] = useState({ date_sortie: today, heure_sortie: '', heure_retour: '', commentaire: '' })
  const [items, setItems] = useState([])
  const [rowEtat, setRowEtat] = useState({})
  const [filterDate, setFilterDate] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterEmetteur, setFilterEmetteur] = useState('')
  const [filterEtat, setFilterEtat] = useState('')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)

  const senderName = useMemo(() => [user?.prenom, user?.nom].filter(Boolean).join(' ').trim() || user?.nom || 'Utilisateur', [user])

  useEffect(() => {
    if (!user?.matricule) { setLoading(false); return }
    api.get('/api/sorties', { params: { matricule: user.matricule } }).then(r => {
      setItems(Array.isArray(r.data) ? r.data : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [user?.matricule])

  const applyFilters = list => list.filter(item => {
    const dateValue = item.date_creation || item.date_sortie || ''
    const statusValue = (item.statut || '').toLowerCase()
    const sourceValue = 'sortie'
    const emetteurValue = senderName.toLowerCase()
    const etatValue = (rowEtat[item.id_sortie] || '--').toLowerCase()
    return (!filterDate || String(dateValue).startsWith(filterDate))
      && (!filterStatut || statusValue === filterStatut)
      && (!filterSource || sourceValue.includes(filterSource.toLowerCase()))
      && (!filterEmetteur || emetteurValue.includes(filterEmetteur.toLowerCase()))
      && (!filterEtat || etatValue === filterEtat.toLowerCase())
  })

  const envoye = useMemo(() => applyFilters(items), [items, filterDate, filterStatut, filterSource, filterEmetteur, filterEtat, rowEtat, senderName])
  const recu = []

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.heure_sortie) {
      setMsg({ type: 'error', text: 'Veuillez indiquer heure de sortie.' })
      return
    }

    try {
      const res = await api.post('/api/sorties', { matricule: user?.matricule, ...form })
      setItems(prev => [{ ...res.data, heure_retour: form.heure_retour, duree_heures: calcDurationHours(form.heure_sortie, form.heure_retour) }, ...prev])
      setForm({ date_sortie: today, heure_sortie: '', heure_retour: '', commentaire: '' })
      setShowNewForm(false)
      setMsg({ type: 'success', text: 'Demande de sortie enregistree.' })
    } catch (err) {
      setMsg({ type: 'error', text: err?.response?.data?.detail || 'Erreur lors de la creation.' })
    }
  }

  const handleAnnulerLocal = (id) => {
    setItems(prev => prev.map(item => item.id_sortie === id ? { ...item, statut: 'annulé' } : item))
  }

  const handleActiverLocal = (id) => setRowEtat(prev => ({ ...prev, [id]: 'Active' }))
  const handleCloturerLocal = (id) => setRowEtat(prev => ({ ...prev, [id]: 'Cloturee' }))

  const renderActionButtons = (item, isRecu) => {
    if (isRecu) {
      return (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button style={okBtn} disabled>Approuver</button>
          <button style={dangerBtn} disabled>Refuser</button>
        </div>
      )
    }

    const etat = rowEtat[item.id_sortie] || '--'
    const validated = isValidated(item.statut || item.status)
    const canCloture = etat === 'Active'

    return (
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button onClick={() => { setShowNewForm(true); set('date_sortie', item.date_sortie || today); set('heure_sortie', item.heure_sortie || ''); set('heure_retour', item.heure_retour || ''); set('commentaire', item.commentaire || '') }} style={primaryBtn}>Modifier</button>
        <button onClick={() => handleAnnulerLocal(item.id_sortie)} style={dangerBtn}>Annuler</button>
        {canCloture ? (
          <button onClick={() => handleCloturerLocal(item.id_sortie)} style={warnBtn}>Cloturer</button>
        ) : (
          <button onClick={() => handleActiverLocal(item.id_sortie)} disabled={!validated} style={{ ...okBtn, opacity: validated ? 1 : 0.45, cursor: validated ? 'pointer' : 'not-allowed' }}>Activer</button>
        )}
      </div>
    )
  }

  const renderRows = (rows, isRecu) => {
    if (!rows.length) return <tr><td colSpan={10} style={{ ...td, textAlign: 'center', color: '#9ca3af' }}>Aucune demande</td></tr>
    return rows.map(item => (
      <tr key={item.id_sortie || item.id_operation}>
        <td style={{ ...td, fontWeight: 600 }}>{`Sortie #${item.id_sortie || '-'}`}</td>
        <td style={td}>{isRecu ? 'Approbations' : 'Sortie'}</td>
        <td style={td}>{renderStatusBadge(item.statut || 'en attente')}</td>
        <td style={td}>{fmtDate(item.date_creation || item.date_sortie)}</td>
        <td style={td}>{senderName}</td>
        <td style={td}>{item.heure_sortie || '-'}</td>
        <td style={td}>{item.heure_retour || '-'}</td>
        <td style={td}>{item.duree_heures || calcDurationHours(item.heure_sortie, item.heure_retour)}</td>
        <td style={td}>{rowEtat[item.id_sortie] || '--'}</td>
        <td style={td}>{renderActionButtons(item, isRecu)}</td>
      </tr>
    ))
  }

  if (loading) return <div style={{ padding: 28 }}>Chargement...</div>

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#021630' }}>Demandes de Sortie</h1>
        <button onClick={() => setShowNewForm(prev => !prev)} style={{ padding: '9px 14px', background: '#ce2b2b', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>Nouvelle demande</button>
      </div>

      {msg && <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 6, background: msg.type === 'success' ? '#dcfce7' : '#fee2e2', color: msg.type === 'success' ? '#166534' : '#991b1b', border: `1px solid ${msg.type === 'success' ? '#86efac' : '#fca5a5'}` }}>{msg.text}</div>}

      {showNewForm && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(15,23,42,0.07)', padding: '24px 28px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ width: 4, height: 20, background: '#ce2b2b', borderRadius: 2, marginRight: 10, flexShrink: 0 }} />
            <span style={{ fontWeight: 700, fontSize: '0.97rem', color: '#0f172a' }}>Nouvelle demande de sortie</span>
          </div>
          <form onSubmit={handleCreate} style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div>
              <label style={fieldLabel}>Date de sortie</label>
              <input type="date" value={form.date_sortie} min={today} onChange={e => set('date_sortie', e.target.value)} style={{ padding: '9px 12px', borderRadius: 7, border: '1.5px solid #d1d5db', width: '100%', boxSizing: 'border-box', fontSize: '0.9rem', color: '#1e293b' }} required />
            </div>
            <div>
              <label style={fieldLabel}>Heure de départ</label>
              <input type="time" value={form.heure_sortie} onChange={e => set('heure_sortie', e.target.value)} style={{ padding: '9px 12px', borderRadius: 7, border: '1.5px solid #d1d5db', width: '100%', boxSizing: 'border-box', fontSize: '0.9rem', color: '#1e293b' }} required />
            </div>
            <div>
              <label style={fieldLabel}>Heure de retour</label>
              <input type="time" value={form.heure_retour} onChange={e => set('heure_retour', e.target.value)} style={{ padding: '9px 12px', borderRadius: 7, border: '1.5px solid #d1d5db', width: '100%', boxSizing: 'border-box', fontSize: '0.9rem', color: '#1e293b' }} required />
            </div>
            <div>
              <label style={{ ...fieldLabel, color: '#64748b' }}>Durée estimée</label>
              <div style={{ padding: '9px 12px', borderRadius: 7, border: '1.5px solid #e2e8f0', background: '#f8fafc', fontSize: '0.9rem', fontWeight: 700, color: '#0f766e', minHeight: 38, display: 'flex', alignItems: 'center' }}>
                {calcDurationHours(form.heure_sortie, form.heure_retour)}
              </div>
            </div>
            <div style={{ gridColumn: '2 / -1' }}>
              <label style={fieldLabel}>Commentaire <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: '0.76rem' }}>(optionnel)</span></label>
              <input type="text" value={form.commentaire} onChange={e => set('commentaire', e.target.value)} placeholder="Ajouter un commentaire..." style={{ padding: '9px 12px', borderRadius: 7, border: '1.5px solid #d1d5db', width: '100%', boxSizing: 'border-box', fontSize: '0.9rem', color: '#1e293b' }} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4, borderTop: '1px solid #f1f5f9', marginTop: 4 }}>
              <button type="button" onClick={() => setShowNewForm(false)} style={{ padding: '9px 18px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 7, fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>Annuler</button>
              <button type="submit" style={{ padding: '9px 22px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>Soumettre la demande</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Tabs active={activeTab} setActive={tab => { setActiveTab(tab); setFilterDate(''); setFilterStatut(''); setFilterSource(''); setFilterEmetteur(''); setFilterEtat('') }} counts={{ envoye: items.length, recu: 0 }} />
        <FilterBar date={filterDate} setDate={setFilterDate} statut={filterStatut} setStatut={setFilterStatut} source={filterSource} setSource={setFilterSource} emetteur={filterEmetteur} setEmetteur={setFilterEmetteur} etat={filterEtat} setEtat={setFilterEtat} />
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: '16%' }}>Titre de demande</th>
              <th style={{ ...th, width: '9%' }}>Source</th>
              <th style={{ ...th, width: '9%' }}>Statut</th>
              <th style={{ ...th, width: '9%' }}>Date creation</th>
              <th style={{ ...th, width: '10%' }}>Envoye par</th>
              <th style={{ ...th, width: '8%' }}>Heure depart</th>
              <th style={{ ...th, width: '8%' }}>Heure retour</th>
              <th style={{ ...th, width: '5%' }}>Duree</th>
              <th style={{ ...th, width: '5%' }}>Etat</th>
              <th style={{ ...th, width: '21%' }}>Actions</th>
            </tr>
          </thead>
          <tbody>{activeTab === 'envoye' ? renderRows(envoye, false) : renderRows(recu, true)}</tbody>
        </table>
      </div>
    </div>
  )
}
