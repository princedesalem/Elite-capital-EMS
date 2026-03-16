import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import '../styles/Operations.css'
import {
  ClipboardList, AlertTriangle, FileText, Plus, Trash2, Pencil, Users, CheckCircle, Search
} from 'lucide-react'

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
const getEmitterName = (item, isRecu, senderName) => {
  if (!isRecu) return senderName
  const full = [item?.demandeur?.prenom, item?.demandeur?.nom].filter(Boolean).join(' ').trim()
  return full || item?.demandeur?.nom_complet || item?.demandeur_nom || item?.demandeur?.nom || 'Inconnu'
}

function Tabs({ active, setActive, counts }) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
      {[
        ['envoye', 'Envoye', counts.envoye],
        ['recu', 'Recu', counts.recu],
      ].map(([key, label, count]) => (
        <button
          key={key}
          onClick={() => setActive(key)}
          style={{
            flex: 1,
            padding: '10px 8px',
            border: 'none',
            cursor: 'pointer',
            background: active === key ? '#fff' : '#f9fafb',
            fontWeight: active === key ? 700 : 500,
            fontSize: '0.82rem',
            borderBottom: active === key ? '2px solid #ce2b2b' : '2px solid transparent',
            color: active === key ? '#ce2b2b' : '#6b7280',
          }}
        >
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

export default function MissionsPage() {
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
  const roleUtilisateur = useMemo(() => String(user?.role || '').toUpperCase(), [user])
  const peutInitierMission = useMemo(() => ['RESPONSABLE', 'DIRECTEUR', 'RH', 'DG', 'PCA', 'ADMIN'].includes(roleUtilisateur), [roleUtilisateur])

  // Form state
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [missionForm, setMissionForm] = useState({ motif: '', email_contact: '' })
  const [missionSegments, setMissionSegments] = useState([{ id: 1, pays: '', ville: '', date_debut: '', date_fin: '', heure_depart: '08:00:00', heure_arrivee: '18:00:00', heure_retour: '18:00:00', moyen_transport: 'aerien' }])
  const [missionMissionnaires, setMissionMissionnaires] = useState([])
  const [rechercheEmploye, setRechercheEmploye] = useState('')
  const [employesTrouves, setEmployesTrouves] = useState([])
  const [missionEditMode, setMissionEditMode] = useState(false)
  const [missionEditId, setMissionEditId] = useState(null)
  const [missionStatuts, setMissionStatuts] = useState({})
  const [statutsPaiementFrais, setStatutsPaiementFrais] = useState({})
  const [rapportUpload, setRapportUpload] = useState({ id_operation: '', file: null })
  const [preuveUpload, setPreuveUpload] = useState({ id_frais: '', type_preuve: 'facture', file: null })
  const [preuvesFraisEnCours, setPreuvesFraisEnCours] = useState([])
  const [employe, setEmploye] = useState(null)

  function loadData() {
    if (!user?.matricule) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      api.get(`/api/missions/mes-missions/${user.matricule}`).catch(() => ({ data: [] })),
      api.get(`/api/workflow/a-valider/${user.matricule}`).catch(() => ({ data: [] })),
    ]).then(([r1, r2]) => {
      const sent = Array.isArray(r1.data) ? r1.data : []
      const recv = (Array.isArray(r2.data) ? r2.data : []).filter(d => d.type_demande === 'Mission')
      setItems(sent)
      setAValider(recv)
      setLoading(false)
    })
  }

  useEffect(() => { loadData() }, [user?.matricule])

  useEffect(() => {
    if (!matricule) return
    api.get(`/employees/${matricule}`).then(r => setEmploye(r.data || {})).catch(() => setEmploye({ solde_conges: 0 }))
  }, [matricule])

  useEffect(() => {
    if (items.length > 0) {
      items.forEach(async m => {
        if (m.id_operation) {
          try {
            const res = await api.get(`/api/missions/${m.id_operation}/statut-mission`)
            setMissionStatuts(prev => ({ ...prev, [m.id_operation]: res.data }))
          } catch {}
          try {
            const res = await api.get(`/api/missions/${m.id_operation}/statut-paiement-frais`)
            setStatutsPaiementFrais(prev => ({ ...prev, [m.id_operation]: res.data }))
          } catch {}
        }
      })
    }
  }, [items])

  async function rechercherEmployes(term) {
    setRechercheEmploye(term)
    if (term.length < 2) { setEmployesTrouves([]); return }
    try {
      const res = await api.get('/api/missions/rechercher-employes', { params: { q: term } })
      setEmployesTrouves(res.data.employes || [])
    } catch { setEmployesTrouves([]) }
  }
  function ajouterMissionnaire(emp) {
    if (!missionMissionnaires.find(m => m.matricule === emp.matricule)) setMissionMissionnaires([...missionMissionnaires, emp])
    setRechercheEmploye(''); setEmployesTrouves([])
  }
  function retirerMissionnaire(mat) { setMissionMissionnaires(missionMissionnaires.filter(m => m.matricule !== mat)) }
  function ajouterSegmentMission() {
    const nouveauId = Math.max(...missionSegments.map(s => s.id), 0) + 1
    setMissionSegments([...missionSegments, { id: nouveauId, pays: '', ville: '', date_debut: '', date_fin: '', heure_depart: '08:00:00', heure_arrivee: '18:00:00', heure_retour: '18:00:00', moyen_transport: 'aerien' }])
  }
  function supprimerSegmentMission(id) {
    if (missionSegments.length <= 1) { alert('Au moins une destination est requise'); return }
    setMissionSegments(missionSegments.filter(s => s.id !== id))
  }
  function updateSegmentMission(id, field, value) { setMissionSegments(missionSegments.map(seg => seg.id === id ? { ...seg, [field]: value } : seg)) }

  function resetMissionForm() {
    setMissionForm({ motif: '', email_contact: '' })
    setMissionSegments([{ id: 1, pays: '', ville: '', date_debut: '', date_fin: '', heure_depart: '08:00:00', heure_arrivee: '18:00:00', heure_retour: '18:00:00', moyen_transport: 'aerien' }])
    setMissionMissionnaires([]); setRechercheEmploye(''); setEmployesTrouves([])
    setMissionEditMode(false); setMissionEditId(null)
  }

  function editMission(mission) {
    setMissionForm({ motif: mission.motif || '', email_contact: mission.email || '' })
    setMissionSegments([{ id: 1, pays: mission.pays || '', ville: mission.ville || '', date_debut: mission.date_debut ? mission.date_debut.split('T')[0] : '', date_fin: mission.date_fin ? mission.date_fin.split('T')[0] : '', heure_depart: mission.heure_depart || '08:00:00', heure_arrivee: mission.heure_arrivee || '18:00:00', heure_retour: mission.heure_retour || '18:00:00', moyen_transport: 'aerien' }])
    setMissionEditMode(true); setMissionEditId(mission.id_operation)
    setFormSuccess(''); setFormError('')
    setShowForm(true)
  }

  async function submitMission(e) {
    e.preventDefault()
    setFormError(''); setFormSuccess('')
    if (!peutInitierMission) { setFormError('Initiation mission interdite pour votre rôle'); return }
    const segmentsInvalides = missionSegments.filter(seg => !seg.pays || !seg.ville || !seg.date_debut || !seg.date_fin)
    if (segmentsInvalides.length > 0) { setFormError('Veuillez remplir tous les champs de chaque destination'); return }
    const matriculesMissionnaires = missionMissionnaires.length > 0 ? missionMissionnaires.map(m => m.matricule) : [matricule]
    try {
      const dateDebut = missionSegments.reduce((min, seg) => !min || seg.date_debut < min ? seg.date_debut : min, null)
      const dateFin = missionSegments.reduce((max, seg) => !max || seg.date_fin > max ? seg.date_fin : max, null)
      const checkResponse = await api.get(`/api/missions/verifier-chevauchement/${matricule}`, { params: { date_debut: dateDebut, date_fin: dateFin, id_operation_exclure: missionEditMode ? missionEditId : null } })
      if (checkResponse.data.conflit) { if (!window.confirm(checkResponse.data.message + '. Voulez-vous continuer quand même ?')) return }
      if (missionEditMode && missionEditId) {
        const premierSegment = missionSegments[0]
        await api.put(`/api/missions/${missionEditId}/modifier`, null, { params: { pays: premierSegment.pays, ville: premierSegment.ville, date_debut: premierSegment.date_debut, date_fin: premierSegment.date_fin, heure_depart: premierSegment.heure_depart, heure_arrivee: premierSegment.heure_arrivee, heure_retour: premierSegment.heure_depart, email: missionForm.email_contact, motif: missionForm.motif || null } })
        setFormSuccess('Mission modifiée avec succès!')
      } else {
        await api.post('/api/missions/creer-multi-segments', { matricule, matricules_missionnaires: matriculesMissionnaires, email_contact: missionForm.email_contact || null, motif: missionForm.motif || null, segments: missionSegments.map(seg => ({ pays: seg.pays, ville: seg.ville, date_debut: seg.date_debut, date_fin: seg.date_fin, heure_depart: seg.heure_depart, heure_arrivee: seg.heure_arrivee, heure_retour: seg.heure_retour, moyen_transport: seg.moyen_transport || 'aerien' })) })
        setFormSuccess(`Demande de mission soumise avec ${missionSegments.length} destination(s) et ${matriculesMissionnaires.length} missionnaire(s).`)
      }
      resetMissionForm()
      loadData()
    } catch (err) { setFormError(err.response?.data?.detail || 'Erreur lors de la soumission de la mission') }
  }

  async function uploadRapport(e) {
    e.preventDefault(); setFormError(''); setFormSuccess('')
    if (!rapportUpload.id_operation || !rapportUpload.file) { setFormError('Veuillez renseigner ID opération et fichier rapport'); return }
    const fd = new FormData(); fd.append('fichier', rapportUpload.file)
    try {
      await api.post(`/api/missions/${rapportUpload.id_operation}/televerser-rapport`, fd, { params: { matricule }, headers: { 'Content-Type': 'multipart/form-data' } })
      setFormSuccess('Rapport téléversé'); setRapportUpload({ id_operation: '', file: null }); loadData()
    } catch (err) { setFormError(err.response?.data?.detail || 'Erreur téléversement rapport') }
  }

  async function uploadPreuveFrais(e) {
    e.preventDefault(); setFormError(''); setFormSuccess('')
    if (!preuveUpload.id_frais || !preuveUpload.file) { setFormError('Veuillez renseigner ID frais et fichier preuve'); return }
    const fd = new FormData(); fd.append('fichier', preuveUpload.file)
    try {
      await api.post(`/api/missions/frais/${preuveUpload.id_frais}/televerser-preuves`, fd, { params: { type_preuve: preuveUpload.type_preuve }, headers: { 'Content-Type': 'multipart/form-data' } })
      setFormSuccess(`Preuve ${preuveUpload.type_preuve} téléversée avec succès!`)
      setPreuvesFraisEnCours([...preuvesFraisEnCours, { type_preuve: preuveUpload.type_preuve, file: preuveUpload.file.name }])
      setPreuveUpload({ id_frais: '', type_preuve: 'facture', file: null }); loadData()
    } catch (err) { setFormError(err.response?.data?.detail || 'Erreur téléversement preuve') }
  }

  async function validerFraisMissionnaire(idMission) {
    try { setFormError(''); setFormSuccess(''); await api.post(`/api/missions/${idMission}/valider-frais-missionnaire`, { matricule }); setFormSuccess('Frais validés avec succès. En attente validation RH.')
      const res = await api.get(`/api/missions/${idMission}/statut-mission`); setMissionStatuts(prev => ({ ...prev, [idMission]: res.data }))
    } catch (err) { setFormError(err.response?.data?.detail || 'Erreur lors de la validation des frais') }
  }
  async function validerPaiementRH(idMission) {
    try { setFormError(''); setFormSuccess(''); await api.post(`/api/missions/${idMission}/valider-paiement-rh`, { matricule }); setFormSuccess('Paiement validé avec succès.')
      const res = await api.get(`/api/missions/${idMission}/statut-mission`); setMissionStatuts(prev => ({ ...prev, [idMission]: res.data }))
    } catch (err) { setFormError(err.response?.data?.detail || 'Erreur lors de la validation du paiement') }
  }

  const applyFilters = list => list.filter(item => {
    const dateValue = item.date_creation || item.created_at || item.date_soumission || item.date_debut || ''
    const statusValue = (item.statut || item.status || '').toLowerCase()
    const sourceValue = (activeTab === 'recu' ? 'Approbations' : 'Mission').toLowerCase()
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
    if (!rows.length) {
      return <tr><td colSpan={10} style={{ ...td, textAlign: 'center', color: '#9ca3af' }}>Aucune demande</td></tr>
    }

    return rows.map(item => (
      <tr key={item.id_operation}>
        <td style={{ ...td, fontWeight: 600 }}>{item.titre || item.objet || item.motif || `Mission #${item.id_operation}`}</td>
        <td style={td}>{isRecu ? 'Approbations' : 'Mission'}</td>
        <td style={td}>{renderStatusBadge(item.statut || item.status || 'en attente')}</td>
        <td style={td}>{fmtDate(item.date_creation || item.created_at || item.date_soumission || item.date_debut)}</td>
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
        <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#021630' }}>Gestion des Missions</h1>
        <button onClick={() => { setShowForm(true); setFormError(''); setFormSuccess(''); resetMissionForm() }} style={{ padding: '9px 14px', background: '#ce2b2b', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>Nouvelle demande</button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>Nouvelle demande de mission</strong>
            <button onClick={() => { setShowForm(false); resetMissionForm() }} style={{ padding: '7px 12px', background: '#eef2f7', color: '#334155', border: '1px solid #dbe2ea', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>Annuler</button>
          </div>
          {formError && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' }}>{formError}</div>}
          {formSuccess && <div style={{ background: '#d1fae5', color: '#065f46', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' }}>{formSuccess}</div>}

          <form className="form-card" onSubmit={submitMission}>
            <h3>{missionEditMode ? 'Modifier la mission' : 'Demande de mission multi-destinations'}</h3>
            {missionEditMode && (
              <div style={{background: '#fff3cd', padding: '10px', borderRadius: '6px', marginBottom: '15px', border: '1px solid #ffc107', display:'flex', alignItems:'center', gap:6}}>
                <AlertTriangle size={13} color="#856404"/> Vous modifiez la mission ID #{missionEditId}
              </div>
            )}
            {/* Informations générales */}
            <div style={{background: '#f0f9ff', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #0ea5e9'}}>
              <h4 style={{marginTop: 0, color: '#0369a1', display:'flex', alignItems:'center', gap:6}}><ClipboardList size={14}/> Informations générales</h4>
              <div className="form-row">
                <div className="form-group"><label>Email de contact pour cette mission</label><input type="email" value={missionForm.email_contact} onChange={(e) => setMissionForm({ ...missionForm, email_contact: e.target.value })} placeholder="email@exemple.com" /></div>
                <div className="form-group"><label>Motif / Objet de la mission</label><input value={missionForm.motif} onChange={(e) => setMissionForm({ ...missionForm, motif: e.target.value })} placeholder="Ex: Formation, Réunion, Audit..." /></div>
              </div>
            </div>
            {/* Section Missionnaires */}
            <div style={{background: '#f0fdf4', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #22c55e'}}>
              <h4 style={{marginTop: 0, color: '#15803d', display:'flex', alignItems:'center', gap:6}}><Users size={14}/> Missionnaires ({missionMissionnaires.length})</h4>
              <div className="form-group" style={{position: 'relative'}}>
                <label>Rechercher un missionnaire</label>
                <input type="text" value={rechercheEmploye} onChange={(e) => rechercherEmployes(e.target.value)} placeholder="Nom, prénom ou matricule..." style={{width: '100%'}} />
                {employesTrouves.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto', zIndex: 1000, marginTop: '4px' }}>
                    {employesTrouves.map(emp => (
                      <div key={emp.matricule} onClick={() => ajouterMissionnaire(emp)} style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }} onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.background = 'white'}>
                        <div style={{fontWeight: '500', color: '#111827'}}>{emp.nom_complet}</div>
                        <div style={{fontSize: '0.85rem', color: '#6b7280'}}>{emp.fonction} - Matricule: {emp.matricule}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {missionMissionnaires.length > 0 && (
                <div style={{marginTop: '15px'}}>
                  <label style={{display: 'block', marginBottom: '8px', fontWeight: '500'}}>Missionnaires sélectionnés ({missionMissionnaires.length})</label>
                  <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px'}}>
                    {missionMissionnaires.map(m => (
                      <div key={m.matricule} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#dcfce7', border: '1px solid #22c55e', borderRadius: '20px', padding: '6px 12px', fontSize: '0.9rem' }}>
                        <span style={{color: '#15803d', fontWeight: '500'}}>{m.nom_complet}</span>
                        <button type="button" onClick={() => retirerMissionnaire(m.matricule)} style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '1.1rem', padding: '0', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {missionMissionnaires.length === 0 && <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: '10px 0 0 0', fontStyle: 'italic' }}>Si aucun missionnaire n'est ajouté, seul l'initiateur de la demande (vous) sera assigné à cette mission.</p>}
            </div>
            {/* Segments de mission */}
            <div style={{marginBottom: '20px'}}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px'}}>
                <h4 style={{margin: 0, display:'flex',alignItems:'center',gap:6}}>Destinations ({missionSegments.length})</h4>
                <button type="button" className="btn btn-primary" onClick={ajouterSegmentMission} style={{fontSize: '0.9rem', padding: '8px 16px', display:'inline-flex', alignItems:'center', gap:5}}><Plus size={13}/> Ajouter une destination</button>
              </div>
              {missionSegments.map((segment, index) => (
                <div key={segment.id} style={{background: '#f9fafb', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '2px solid #e5e7eb', position: 'relative'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                    <h5 style={{margin: 0, color: '#374151'}}>Destination {index + 1}</h5>
                    {missionSegments.length > 1 && <button type="button" onClick={() => supprimerSegmentMission(segment.id)} style={{background: '#ef4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', display:'inline-flex', alignItems:'center', gap:4}}><Trash2 size={12}/> Supprimer</button>}
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label>Pays</label><input value={segment.pays} onChange={(e) => updateSegmentMission(segment.id, 'pays', e.target.value)} required placeholder="Ex: Cameroun" /></div>
                    <div className="form-group"><label>Ville</label><input value={segment.ville} onChange={(e) => updateSegmentMission(segment.id, 'ville', e.target.value)} required placeholder="Ex: Douala" /></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label>Date début</label><input type="date" value={segment.date_debut} onChange={(e) => updateSegmentMission(segment.id, 'date_debut', e.target.value)} required /></div>
                    <div className="form-group"><label>Date fin</label><input type="date" value={segment.date_fin} onChange={(e) => updateSegmentMission(segment.id, 'date_fin', e.target.value)} required /></div>
                    <div className="form-group"><label>Durée</label><input type="text" value={segment.date_debut && segment.date_fin ? `${Math.ceil((new Date(segment.date_fin) - new Date(segment.date_debut)) / (1000 * 60 * 60 * 24)) + 1} jours` : '-'} readOnly style={{background: '#e5e7eb'}} /></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label>Heure départ</label><input type="time" value={segment.heure_depart.slice(0, 5)} onChange={(e) => updateSegmentMission(segment.id, 'heure_depart', `${e.target.value}:00`)} /></div>
                    <div className="form-group"><label>Heure arrivée</label><input type="time" value={segment.heure_arrivee.slice(0, 5)} onChange={(e) => updateSegmentMission(segment.id, 'heure_arrivee', `${e.target.value}:00`)} /></div>
                    <div className="form-group"><label>Heure retour</label><input type="time" value={segment.heure_retour ? segment.heure_retour.slice(0, 5) : '18:00'} onChange={(e) => updateSegmentMission(segment.id, 'heure_retour', `${e.target.value}:00`)} /></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label>Moyen de transport</label>
                      <select value={segment.moyen_transport || 'aerien'} onChange={(e) => updateSegmentMission(segment.id, 'moyen_transport', e.target.value)}>
                        <option value="aerien">Aérien</option><option value="routier">Routier</option><option value="ferroviaire">Ferroviaire</option><option value="maritime">Maritime</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{background: '#e0f2fe', padding: '12px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #0ea5e9'}}>
              <p style={{margin: 0, fontSize: '0.9rem', color: '#0369a1'}}><strong style={{display:'inline-flex',alignItems:'center',gap:5}}><FileText size={13}/> Note:</strong> Un email sera envoyé à l'adresse indiquée pour effectuer la demande de frais de mission.</p>
            </div>
            <div style={{display: 'flex', gap: '10px'}}>
              <button className="btn btn-success" type="submit">{missionEditMode ? 'Enregistrer les modifications' : `Soumettre (${missionSegments.length} destination${missionSegments.length > 1 ? 's' : ''})`}</button>
              {missionEditMode && <button className="btn" type="button" onClick={() => { resetMissionForm(); setFormSuccess(''); setFormError('') }} style={{background: '#6c757d', color: 'white'}}>Annuler modification</button>}
            </div>
          </form>

          {/* Missions modifiables */}
          {items.filter(m => m.matricule === matricule && !missionStatuts[m.id_operation]?.statut_cloture).length > 0 && (
            <div className="form-card">
              <h3>Mes missions modifiables</h3>
              <table style={{width: '100%', borderCollapse: 'collapse'}}>
                <thead><tr style={{borderBottom: '2px solid #e5e7eb'}}><th style={{padding: '10px', textAlign: 'left'}}>ID</th><th style={{padding: '10px', textAlign: 'left'}}>Destination</th><th style={{padding: '10px', textAlign: 'left'}}>Dates</th><th style={{padding: '10px', textAlign: 'left'}}>Statut</th><th style={{padding: '10px', textAlign: 'left'}}>Paiement frais</th><th style={{padding: '10px', textAlign: 'center'}}>Actions</th></tr></thead>
                <tbody>
                  {items.filter(m => m.matricule === matricule && !missionStatuts[m.id_operation]?.statut_cloture).map(mission => {
                    const statutPaiement = statutsPaiementFrais[mission.id_operation] || {}
                    const estRH = employe && employe.fonction && employe.fonction.toUpperCase().includes('RH')
                    return (
                      <tr key={mission.id_operation} style={{borderBottom: '1px solid #e5e7eb'}}>
                        <td style={{padding: '10px'}}>#{mission.id_operation}</td>
                        <td style={{padding: '10px'}}>{mission.pays}, {mission.ville}</td>
                        <td style={{padding: '10px'}}>{new Date(mission.date_debut).toLocaleDateString('fr-FR')} → {new Date(mission.date_fin).toLocaleDateString('fr-FR')}</td>
                        <td style={{padding: '10px'}}><span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', background: mission.statut === 'EN_ATTENTE' ? '#fef3c7' : mission.statut === 'VALIDE' ? '#d1fae5' : '#fee2e2', color: mission.statut === 'EN_ATTENTE' ? '#92400e' : mission.statut === 'VALIDE' ? '#065f46' : '#991b1b' }}>{mission.statut || 'EN_ATTENTE'}</span></td>
                        <td style={{padding: '10px'}}>{statutPaiement.frais_payes ? <span style={{padding:'4px 8px',borderRadius:'4px',fontSize:'0.85rem',background:'#d1fae5',color:'#065f46'}}>Payé</span> : statutPaiement.frais_valides_rh ? <span style={{padding:'4px 8px',borderRadius:'4px',fontSize:'0.85rem',background:'#dbeafe',color:'#1e40af'}}>Validation RH OK</span> : statutPaiement.frais_valides_missionnaire ? <span style={{padding:'4px 8px',borderRadius:'4px',fontSize:'0.85rem',background:'#fef3c7',color:'#92400e'}}>En attente RH</span> : <span style={{padding:'4px 8px',borderRadius:'4px',fontSize:'0.85rem',background:'#fee2e2',color:'#991b1b'}}>Non validé</span>}</td>
                        <td style={{padding: '10px', textAlign: 'center'}}>
                          <div style={{display: 'flex', gap: '5px', justifyContent: 'center', flexWrap: 'wrap'}}>
                            <button className="btn btn-primary" onClick={() => editMission(mission)} style={{fontSize: '0.85rem', padding: '6px 12px', display:'inline-flex', alignItems:'center', gap:4}}><Pencil size={12}/> Modifier</button>
                            {!statutPaiement.frais_valides_missionnaire && <button className="btn btn-success" onClick={() => validerFraisMissionnaire(mission.id_operation)} style={{fontSize: '0.85rem', padding: '6px 12px', display:'inline-flex', alignItems:'center', gap:4}} title="Valider que les frais sont corrects"><CheckCircle size={12}/> Valider frais</button>}
                            {estRH && statutPaiement.frais_valides_missionnaire && !statutPaiement.frais_payes && <button className="btn btn-success" onClick={() => validerPaiementRH(mission.id_operation)} style={{fontSize: '0.85rem', padding: '6px 12px', display:'inline-flex', alignItems:'center', gap:4}} title="Confirmer le paiement des frais"><CheckCircle size={12}/> Confirmer paiement</button>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Téléversement rapport et preuves */}
          <div className="upload-grid">
            <form className="form-card" onSubmit={uploadRapport}>
              <h3>Téléversement rapport mission</h3>
              <div style={{ background: '#d1ecf1', padding: '10px', borderRadius: '6px', marginBottom: '12px', border: '1px solid #bee5eb', fontSize: '0.9em' }}>Le rapport ne peut être téléversé que pour une mission <strong>active</strong> (validée et activée).</div>
              <div className="form-group"><label>Mission (ID opération)</label>
                <select value={rapportUpload.id_operation} onChange={(e) => setRapportUpload({ ...rapportUpload, id_operation: e.target.value })}>
                  <option value="">Sélectionner une mission</option>
                  {items.filter(m => missionStatuts[m.id_operation]?.est_active).map(m => (<option key={m.id_operation} value={m.id_operation}>#{m.id_operation} - {m.pays}, {m.ville || 'N/A'} (Active)</option>))}
                </select>
                {items.filter(m => missionStatuts[m.id_operation]?.est_active).length === 0 && <p style={{ fontSize: '0.85em', color: '#856404', background: '#fff3cd', padding: '8px', borderRadius: '4px', marginTop: '8px' }}><AlertTriangle size={13}/> Aucune mission activée disponible.</p>}
              </div>
              <div className="form-group"><label>Fichier rapport</label><input type="file" onChange={(e) => setRapportUpload({ ...rapportUpload, file: e.target.files[0] })} /></div>
              <button className="btn btn-primary" type="submit" disabled={!rapportUpload.id_operation || !rapportUpload.file}>Téléverser rapport</button>
            </form>

            <form className="form-card" onSubmit={uploadPreuveFrais}>
              <h3>Téléversement preuves frais</h3>
              <div style={{background: '#fef3c7', padding: '12px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #f59e0b'}}><p style={{margin: 0, fontSize: '0.9rem', color: '#92400e'}}><strong>Important:</strong> Vous devez d'abord soumettre une demande de frais associée à une mission <strong>validée et activée</strong> pour pouvoir téléverser les preuves.</p></div>
              <div className="form-group"><label>ID Frais</label><input value={preuveUpload.id_frais} onChange={(e) => setPreuveUpload({ ...preuveUpload, id_frais: e.target.value })} required placeholder="Entrez l'ID de la demande de frais" /></div>
              <div className="form-group"><label>Type de preuve</label>
                <select value={preuveUpload.type_preuve} onChange={(e) => setPreuveUpload({ ...preuveUpload, type_preuve: e.target.value })} required>
                  <option value="facture">Facture</option><option value="recu">Reçu</option><option value="ticket">Ticket</option><option value="bordereau">Bordereau</option><option value="quittance">Quittance</option><option value="autre">Autre</option>
                </select>
              </div>
              <div className="form-group"><label>Fichier preuve</label><input type="file" onChange={(e) => setPreuveUpload({ ...preuveUpload, file: e.target.files[0] })} required /></div>
              <button className="btn btn-success" type="submit" disabled={!preuveUpload.id_frais || !preuveUpload.file}>Téléverser preuve</button>
            </form>
            {preuvesFraisEnCours.length > 0 && (
              <div className="form-card" style={{background: '#d1e7dd', border: '1px solid #badbcc'}}>
                <h3 style={{color: '#0f5132', margin: '0 0 12px 0', display:'flex', alignItems:'center', gap:6}}><CheckCircle size={14}/> Preuves téléversées ({preuvesFraisEnCours.length})</h3>
                <ul style={{margin: 0, paddingLeft: '20px'}}>{preuvesFraisEnCours.map((p, idx) => (<li key={idx} style={{color: '#1a5e3b', marginBottom: '8px'}}><strong>{p.type_preuve}</strong> - {p.file}</li>))}</ul>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Tabs active={activeTab} setActive={tab => { setActiveTab(tab); setFilterDate(''); setFilterStatut(''); setFilterSource(''); setFilterEmetteur(''); setFilterEtat('') }} counts={{ envoye: items.length, recu: aValider.length }} />
        <FilterBar date={filterDate} setDate={setFilterDate} statut={filterStatut} setStatut={setFilterStatut} source={filterSource} setSource={setFilterSource} emetteur={filterEmetteur} setEmetteur={setFilterEmetteur} etat={filterEtat} setEtat={setFilterEtat} />
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: '16%' }}>Titre de demande</th>
              <th style={{ ...th, width: '9%' }}>Source</th>
              <th style={{ ...th, width: '9%' }}>Statut</th>
              <th style={{ ...th, width: '9%' }}>Date creation</th>
              <th style={{ ...th, width: '10%' }}>Envoye par</th>
              <th style={{ ...th, width: '8%' }}>Date depart</th>
              <th style={{ ...th, width: '8%' }}>Date retour</th>
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
