import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import '../styles/Operations.css'
import { ClipboardList, AlertTriangle } from 'lucide-react'

const th = { padding: '8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontSize: '0.7rem', color: '#64748b', fontWeight: 700, whiteSpace: 'nowrap' }
const td = { padding: '8px', borderBottom: '1px solid #f1f5f9', fontSize: '0.76rem', color: '#111827', verticalAlign: 'middle', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const rowBtn = { padding: '4px 7px', border: 'none', borderRadius: 5, fontWeight: 700, cursor: 'pointer', fontSize: '0.68rem', color: '#fff' }
const primaryBtn = { ...rowBtn, background: '#2563eb' }
const dangerBtn = { ...rowBtn, background: '#ef4444' }
const okBtn = { ...rowBtn, background: '#10b981' }
const warnBtn = { ...rowBtn, background: '#f59e0b' }
const fmtDate = value => value ? new Date(value).toLocaleDateString('fr-FR') : '-'
const durationDays = (start, end) => (start && end) ? `${Math.round((new Date(end) - new Date(start)) / 86400000) + 1} j` : '-'
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
const missionLabel = (item) => item?.objet || item?.titre || `Mission #${item?.id_operation || '-'}`
const getEmitterName = (item, isRecu, senderName) => {
  if (!isRecu) return senderName
  const full = [item?.demandeur?.prenom, item?.demandeur?.nom].filter(Boolean).join(' ').trim()
  return full || item?.demandeur?.nom_complet || item?.demandeur_nom || item?.demandeur?.nom || 'Inconnu'
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

export default function FraisPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('envoye')
  const [items, setItems] = useState([])
  const [aValider, setAValider] = useState([])
  const [rowEtat, setRowEtat] = useState({})
  const [filterDate, setFilterDate] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterEmetteur, setFilterEmetteur] = useState('')
  const [filterEtat, setFilterEtat] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const senderName = useMemo(() => [user?.prenom, user?.nom].filter(Boolean).join(' ').trim() || user?.nom || 'Utilisateur', [user])
  const matricule = useMemo(() => Number(user?.matricule || user?.sub || 0), [user])

  // All missions for frais selection
  const [missions, setMissions] = useState([])
  const [missionStatuts, setMissionStatuts] = useState({})

  // Frais form state
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [fraisForm, setFraisForm] = useState({ id_operation: '', frais_transport_unitaire: 0, frais_hotel_unitaire: 0, frais_deplacement_unitaire: 0, frais_mission_unitaire: 0, justificatif: '' })

  const fraisMissionCalculs = useMemo(() => {
    if (!fraisForm.id_operation || missions.length === 0) return { durationDays: 0, nuits: 0, frais_transport_total: 0, frais_hotel_total: 0, frais_deplacement_total: 0, frais_mission_total: 0, total_general: 0 }
    const mission = missions.find(m => m.id_operation === parseInt(fraisForm.id_operation))
    if (!mission) return { durationDays: 0, nuits: 0, frais_transport_total: 0, frais_hotel_total: 0, frais_deplacement_total: 0, frais_mission_total: 0, total_general: 0 }
    const dateDebut = new Date(mission.date_debut); const dateFin = new Date(mission.date_fin)
    const heure_arrivee = mission.heure_arrivee ? mission.heure_arrivee.split(':') : ['18', '00', '00']
    const heure_retour = mission.heure_retour ? mission.heure_retour.split(':') : ['17', '00', '00']
    const durationDays = Math.ceil((dateFin - dateDebut) / (1000 * 60 * 60 * 24)) + 1
    const dateArrivee = new Date(mission.date_debut); dateArrivee.setHours(parseInt(heure_arrivee[0]), parseInt(heure_arrivee[1]))
    const dateRetour = new Date(mission.date_fin); dateRetour.setHours(parseInt(heure_retour[0]), parseInt(heure_retour[1]))
    const nuits = Math.max(0, Math.ceil((dateRetour - dateArrivee) / (1000 * 60 * 60 * 24)))
    const frais_transport_total = Number(fraisForm.frais_transport_unitaire || 0)
    const frais_hotel_total = Number(fraisForm.frais_hotel_unitaire || 0) * Math.max(1, nuits)
    const frais_deplacement_total = Number(fraisForm.frais_deplacement_unitaire || 0) * durationDays
    const frais_mission_total = Number(fraisForm.frais_mission_unitaire || 0) * durationDays
    const total_general = frais_transport_total + frais_hotel_total + frais_deplacement_total + frais_mission_total
    return { durationDays, nuits, frais_transport_total, frais_hotel_total, frais_deplacement_total, frais_mission_total, total_general }
  }, [fraisForm.id_operation, fraisForm.frais_transport_unitaire, fraisForm.frais_hotel_unitaire, fraisForm.frais_deplacement_unitaire, fraisForm.frais_mission_unitaire, missions])

  // Auto-remplir transport si routier
  useEffect(() => {
    if (!fraisForm.id_operation || missions.length === 0) return
    const mission = missions.find(m => m.id_operation === parseInt(fraisForm.id_operation))
    if (!mission) return
    if (mission.moyens_transport && mission.moyens_transport.includes('routier')) {
      setFraisForm(prev => ({ ...prev, frais_transport_unitaire: 15000 }))
    } else { setFraisForm(prev => ({ ...prev, frais_transport_unitaire: 0 })) }
  }, [fraisForm.id_operation, missions])

  function loadData() {
    if (!user?.matricule) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      api.get(`/api/missions/mes-missions/${user.matricule}`).catch(() => ({ data: [] })),
      api.get(`/api/workflow/a-valider/${user.matricule}`).catch(() => ({ data: [] }))
    ]).then(([r1, r2]) => {
      const allMissions = Array.isArray(r1.data) ? r1.data : []
      setMissions(allMissions)
      const sent = allMissions.filter(m => !!m.a_des_frais)
      const recv = (Array.isArray(r2.data) ? r2.data : []).filter(d => d.type_demande === 'Mission')
      setItems(sent)
      setAValider(recv)
      setLoading(false)
    })
  }

  useEffect(() => { loadData() }, [user?.matricule])

  useEffect(() => {
    if (missions.length > 0) {
      missions.forEach(async m => {
        if (m.id_operation) {
          try { const res = await api.get(`/api/missions/${m.id_operation}/statut-mission`); setMissionStatuts(prev => ({ ...prev, [m.id_operation]: res.data })) } catch {}
        }
      })
    }
  }, [missions])

  async function submitFrais(e) {
    e.preventDefault(); setFormError(''); setFormSuccess('')
    if (!fraisForm.id_operation) { setFormError('Veuillez sélectionner une mission'); return }
    try {
      await api.post(`/api/missions/${fraisForm.id_operation}/demande-frais`, null, {
        params: { matricule, frais_transport: fraisMissionCalculs.frais_transport_total, frais_hotel: fraisMissionCalculs.frais_hotel_total, frais_deplacement: fraisMissionCalculs.frais_deplacement_total, frais_nutrition: fraisMissionCalculs.frais_mission_total, justificatif: fraisForm.justificatif || null }
      })
      setFormSuccess('Demande de frais soumise avec succès')
      setFraisForm({ id_operation: '', frais_transport_unitaire: 0, frais_hotel_unitaire: 0, frais_deplacement_unitaire: 0, frais_mission_unitaire: 0, justificatif: '' })
      loadData()
    } catch (err) { setFormError(err.response?.data?.detail || 'Erreur lors de la demande de frais') }
  }

  const applyFilters = list => list.filter(item => {
    const dateValue = item.date_creation || item.created_at || item.date_soumission || item.date_debut || ''
    const statusValue = (item.statut || item.status || '').toLowerCase()
    const sourceValue = (activeTab === 'recu' ? 'Approbations' : 'Frais mission').toLowerCase()
    const emetteurValue = getEmitterName(item, activeTab === 'recu', senderName).toLowerCase()
    const etatValue = (rowEtat[item.id_operation] || '--').toLowerCase()
    return (!filterDate || String(dateValue).startsWith(filterDate))
      && (!filterStatut || statusValue === filterStatut)
      && (!filterSource || sourceValue.includes(filterSource.toLowerCase()))
      && (!filterEmetteur || emetteurValue.includes(filterEmetteur.toLowerCase()))
      && (!filterEtat || etatValue === filterEtat.toLowerCase())
  })

  const envoye = useMemo(() => applyFilters(items), [items, filterDate, filterStatut, filterSource, filterEmetteur, filterEtat, rowEtat, activeTab, senderName])
  const recu = useMemo(() => applyFilters(aValider), [aValider, filterDate, filterStatut, filterSource, filterEmetteur, filterEtat, rowEtat, activeTab, senderName])

  const handleAnnuler = async (id) => {
    if (!confirm('Annuler cette demande ?')) return
    try {
      await api.put(`/api/missions/${id}`, { statut: 'annulé' })
      setItems(prev => prev.map(item => item.id_operation === id ? { ...item, statut: 'annulé' } : item))
    } catch (err) {
      alert('Erreur: ' + err.message)
    }
  }

  const handleWorkflow = async (id, statut) => {
    let commentaire = null
    if (statut === 'refusé') {
      commentaire = window.prompt('Motif du refus (obligatoire):')
      if (!commentaire?.trim()) return
    }
    try {
      await api.post(`/api/workflow/valider/${id}`, null, { params: { matricule_validateur: user.matricule, statut, ...(commentaire ? { commentaire } : {}) } })
      setAValider(prev => prev.filter(item => item.id_operation !== id))
    } catch (err) {
      alert('Erreur: ' + (err?.response?.data?.detail || err.message))
    }
  }

  const handleActiverLocal = (id) => setRowEtat(prev => ({ ...prev, [id]: 'Active' }))
  const handleCloturerLocal = (id) => setRowEtat(prev => ({ ...prev, [id]: 'Cloturee' }))

  const renderActionButtons = (item, isRecu) => {
    if (isRecu) {
      return (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button onClick={() => handleWorkflow(item.id_operation, 'validé')} style={okBtn}>Approuver</button>
          <button onClick={() => handleWorkflow(item.id_operation, 'refusé')} style={dangerBtn}>Refuser</button>
        </div>
      )
    }

    const etat = rowEtat[item.id_operation] || '--'
    const validated = isValidated(item.statut || item.status)
    const canCloture = etat === 'Active'

    return (
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button onClick={() => navigate(`/rh/missions/edit/${item.id_operation}`)} style={primaryBtn}>Modifier</button>
        <button onClick={() => handleAnnuler(item.id_operation)} style={dangerBtn}>Annuler</button>
        {canCloture ? (
          <button onClick={() => handleCloturerLocal(item.id_operation)} style={warnBtn}>Cloturer</button>
        ) : (
          <button onClick={() => handleActiverLocal(item.id_operation)} disabled={!validated} style={{ ...okBtn, opacity: validated ? 1 : 0.45, cursor: validated ? 'pointer' : 'not-allowed' }}>Activer</button>
        )}
      </div>
    )
  }

  const renderRows = (rows, isRecu) => {
    if (!rows.length) return <tr><td colSpan={11} style={{ ...td, textAlign: 'center', color: '#9ca3af' }}>Aucune demande</td></tr>
    return rows.map(item => (
      <tr key={item.id_operation}>
        <td style={{ ...td, fontWeight: 600 }}>{item.motif || `Frais mission #${item.id_operation}`}</td>
        <td style={td}>{missionLabel(item)}</td>
        <td style={td}>{isRecu ? 'Approbations' : 'Frais mission'}</td>
        <td style={td}>{renderStatusBadge(item.statut || item.status || 'en attente')}</td>
        <td style={td}>{fmtDate(item.date_creation || item.created_at || item.date_debut)}</td>
        <td style={td}>{getEmitterName(item, isRecu, senderName)}</td>
        <td style={td}>{fmtDate(item.date_debut)}</td>
        <td style={td}>{fmtDate(item.date_fin)}</td>
        <td style={td}>{durationDays(item.date_debut, item.date_fin)}</td>
        <td style={td}>{rowEtat[item.id_operation] || '--'}</td>
        <td style={td}>{renderActionButtons(item, isRecu)}</td>
      </tr>
    ))
  }

  if (loading) return <div style={{ padding: 28 }}>Chargement...</div>

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#021630' }}>Frais de Mission</h1>
        <button onClick={() => { setShowForm(true); setFormError(''); setFormSuccess('') }} style={{ padding: '9px 14px', background: '#ce2b2b', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>Nouvelle demande</button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>Nouvelle demande de frais de mission</strong>
            <button onClick={() => setShowForm(false)} style={{ padding: '7px 12px', background: '#eef2f7', color: '#334155', border: '1px solid #dbe2ea', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>Annuler</button>
          </div>
          {formError && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' }}>{formError}</div>}
          {formSuccess && <div style={{ background: '#d1fae5', color: '#065f46', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' }}>{formSuccess}</div>}

          <form className="form-card" onSubmit={submitFrais}>
            <h3>Demande de frais de mission</h3>
            <div style={{ background: '#fff3cd', padding: '12px', borderRadius: '6px', marginBottom: '15px', border: '1px solid #ffc107', display:'flex', alignItems:'flex-start', gap:6 }}>
              <AlertTriangle size={13} style={{flexShrink:0, marginTop:2}}/> <span><strong>Important:</strong> Vous ne pouvez demander les frais qu'après validation complète de votre mission par tous les validateurs.</span>
            </div>
            <div className="form-group">
              <label>Mission (ID opération)</label>
              <select value={fraisForm.id_operation} onChange={(e) => setFraisForm({ ...fraisForm, id_operation: e.target.value })} required>
                <option value="">Sélectionner une mission</option>
                {missions.filter(m => { const statut = missionStatuts[m.id_operation]; return statut?.validation_complete && !statut?.frais_deja_demandes }).map(m => (<option key={m.id_operation} value={m.id_operation}>#{m.id_operation} - {m.pays}, {m.ville || 'N/A'} (Validée)</option>))}
              </select>
              {missions.filter(m => missionStatuts[m.id_operation]?.validation_complete).length === 0 && <p style={{ fontSize: '0.85em', color: '#666', marginTop: '8px' }}>Aucune mission validée disponible</p>}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Frais transport (prix unitaire en FCFA)</label>
                <input type="number" step="0.01" value={fraisForm.frais_transport_unitaire} onChange={(e) => setFraisForm({ ...fraisForm, frais_transport_unitaire: e.target.value })} placeholder="Entrez le montant" />
                <p style={{fontSize: '0.85rem', color: '#666', margin: '5px 0 0 0'}}><strong>Total:</strong> {fraisMissionCalculs.frais_transport_total.toFixed(2)} FCFA (payé une fois)</p>
              </div>
              <div className="form-group">
                <label>Frais hôtel (prix unitaire/nuit en FCFA)</label>
                <input type="number" step="0.01" value={fraisForm.frais_hotel_unitaire} onChange={(e) => setFraisForm({ ...fraisForm, frais_hotel_unitaire: e.target.value })} placeholder="Entrez le montant" />
                <p style={{fontSize: '0.85rem', color: '#666', margin: '5px 0 0 0'}}><strong>Total:</strong> {fraisMissionCalculs.frais_hotel_total.toFixed(2)} FCFA pour {fraisMissionCalculs.nuits} nuit{fraisMissionCalculs.nuits > 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Frais déplacement (prix unitaire/jour en FCFA)</label>
                <input type="number" step="0.01" value={fraisForm.frais_deplacement_unitaire} onChange={(e) => setFraisForm({ ...fraisForm, frais_deplacement_unitaire: e.target.value })} placeholder="Entrez le montant" />
                <p style={{fontSize: '0.85rem', color: '#666', margin: '5px 0 0 0'}}><strong>Total:</strong> {fraisMissionCalculs.frais_deplacement_total.toFixed(2)} FCFA pour {fraisMissionCalculs.durationDays} jour{fraisMissionCalculs.durationDays > 1 ? 's' : ''}</p>
              </div>
              <div className="form-group">
                <label>Frais mission (prix unitaire/jour en FCFA)</label>
                <input type="number" step="0.01" value={fraisForm.frais_mission_unitaire} onChange={(e) => setFraisForm({ ...fraisForm, frais_mission_unitaire: e.target.value })} placeholder="Entrez le montant" />
                <p style={{fontSize: '0.85rem', color: '#666', margin: '5px 0 0 0'}}><strong>Total:</strong> {fraisMissionCalculs.frais_mission_total.toFixed(2)} FCFA pour {fraisMissionCalculs.durationDays} jour{fraisMissionCalculs.durationDays > 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="form-group">
              <label>Justificatif</label>
              <textarea value={fraisForm.justificatif} onChange={(e) => setFraisForm({ ...fraisForm, justificatif: e.target.value })} placeholder="Description des frais engagés..." />
            </div>
            <div style={{ background: '#dbeafe', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #0ea5e9' }}>
              <div style={{ marginBottom: '8px' }}>
                <p style={{margin: '0 0 8px 0', fontSize: '0.9rem', display:'flex', alignItems:'center', gap:5}}><ClipboardList size={12}/> <strong>Récapitulatif des frais:</strong></p>
                <p style={{margin: '4px 0', fontSize: '0.85rem'}}>Transport: <strong>{fraisMissionCalculs.frais_transport_total.toFixed(2)} FCFA</strong></p>
                <p style={{margin: '4px 0', fontSize: '0.85rem'}}>Hôtel ({fraisMissionCalculs.nuits} nuit{fraisMissionCalculs.nuits > 1 ? 's' : ''}): <strong>{fraisMissionCalculs.frais_hotel_total.toFixed(2)} FCFA</strong></p>
                <p style={{margin: '4px 0', fontSize: '0.85rem'}}>Déplacement ({fraisMissionCalculs.durationDays} jour{fraisMissionCalculs.durationDays > 1 ? 's' : ''}): <strong>{fraisMissionCalculs.frais_deplacement_total.toFixed(2)} FCFA</strong></p>
                <p style={{margin: '4px 0', fontSize: '0.85rem'}}>Frais mission ({fraisMissionCalculs.durationDays} jour{fraisMissionCalculs.durationDays > 1 ? 's' : ''}): <strong>{fraisMissionCalculs.frais_mission_total.toFixed(2)} FCFA</strong></p>
              </div>
              <div style={{borderTop: '1px solid #0ea5e9', paddingTop: '10px', marginTop: '10px'}}>
                <p style={{margin: 0, fontSize: '1rem'}}><strong>TOTAL GÉNÉRAL: {fraisMissionCalculs.total_general.toFixed(2)} FCFA</strong></p>
              </div>
            </div>
            <button className="btn btn-success" type="submit" disabled={!fraisForm.id_operation}>Soumettre demande de frais</button>
          </form>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Tabs active={activeTab} setActive={tab => { setActiveTab(tab); setFilterDate(''); setFilterStatut(''); setFilterSource(''); setFilterEmetteur(''); setFilterEtat('') }} counts={{ envoye: items.length, recu: aValider.length }} />
        <FilterBar date={filterDate} setDate={setFilterDate} statut={filterStatut} setStatut={setFilterStatut} source={filterSource} setSource={setFilterSource} emetteur={filterEmetteur} setEmetteur={setFilterEmetteur} etat={filterEtat} setEtat={setFilterEtat} />
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: '13%' }}>Titre de demande</th>
              <th style={{ ...th, width: '12%' }}>Mission</th>
              <th style={{ ...th, width: '8%' }}>Source</th>
              <th style={{ ...th, width: '8%' }}>Statut</th>
              <th style={{ ...th, width: '8%' }}>Date creation</th>
              <th style={{ ...th, width: '9%' }}>Envoye par</th>
              <th style={{ ...th, width: '7%' }}>Date depart</th>
              <th style={{ ...th, width: '7%' }}>Date retour</th>
              <th style={{ ...th, width: '5%' }}>Duree</th>
              <th style={{ ...th, width: '5%' }}>Etat</th>
              <th style={{ ...th, width: '18%' }}>Actions</th>
            </tr>
          </thead>
          <tbody>{activeTab === 'envoye' ? renderRows(envoye, false) : renderRows(recu, true)}</tbody>
        </table>
      </div>
    </div>
  )
}
