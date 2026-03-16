import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import '../styles/Operations.css'
import {
  ClipboardList, AlertTriangle, Calendar, FileText, Pin, Clock, Search, CheckCircle
} from 'lucide-react'

const PERMISSIONS_CONVENTIONNELLES = {
  'mariage': {
    label: 'Mariage',
    sousTypes: [
      { value: 'salarie', label: 'Mariage du travailleur', duree: 4 },
      { value: 'enfant', label: 'Mariage d\'un enfant du travailleur', duree: 2 }
    ]
  },
  'accouchement': {
    label: 'Accouchement',
    sousTypes: [
      { value: 'epouse', label: 'Accouchement de l\'épouse du travailleur', duree: 3 }
    ]
  },
  'bapteme': {
    label: 'Baptême',
    sousTypes: [
      { value: 'enfant', label: 'Baptême d\'un enfant du travailleur', duree: 1 }
    ]
  },
  'deces': {
    label: 'Décès',
    sousTypes: [
      { value: 'conjoint', label: 'Décès du conjoint du travailleur', duree: 5 },
      { value: 'enfant', label: 'Décès d\'un enfant du travailleur', duree: 3 },
      { value: 'pere', label: 'Décès du père du travailleur', duree: 5 },
      { value: 'mere', label: 'Décès de la mère du travailleur', duree: 5 },
      { value: 'beau_pere', label: 'Décès du père du conjoint légitime', duree: 3 },
      { value: 'belle_mere', label: 'Décès de la mère du conjoint légitime', duree: 3 },
      { value: 'frere', label: 'Décès du frère du travailleur', duree: 3 },
      { value: 'soeur', label: 'Décès de la sœur du travailleur', duree: 3 }
    ]
  },
  'maternelle': {
    label: 'Maternité',
    sousTypes: [
      { value: 'simple', label: 'Congé maternité (16 semaines)', duree: 112 },
      { value: 'pathologique', label: 'Congé maternité pathologique (18 semaines)', duree: 126 }
    ]
  }
}

const DOCUMENTS_REQUIS = {
  'mariage': {
    titre: 'Mariage',
    documents: [
      { label: 'Mariage du travailleur (4j)', doc: 'Copie certifiée conforme de l\'acte de mariage' },
      { label: 'Mariage d\'un enfant (2j)', doc: 'Copie certifiée conforme de l\'acte de mariage' }
    ],
    delai: '72h à l\'avance'
  },
  'accouchement': {
    titre: 'Accouchement',
    documents: [
      { label: 'Accouchement de l\'épouse (3j)', doc: 'Certificat médical ou acte de naissance' }
    ],
    delai: '48h après l\'événement'
  },
  'bapteme': {
    titre: 'Baptême',
    documents: [
      { label: 'Baptême d\'un enfant (1j)', doc: 'Certificat ou attestation de l\'établissement religieux' }
    ],
    delai: '72h à l\'avance'
  },
  'deces': {
    titre: 'Décès',
    documents: [
      { label: 'Décès du conjoint (5j)', doc: 'Acte de décès ou certificat de décès' },
      { label: 'Décès d\'un enfant (3j)', doc: 'Acte de décès ou certificat de décès' },
      { label: 'Décès du père ou de la mère (5j)', doc: 'Acte de décès ou certificat de décès' },
      { label: 'Décès du père ou de la mère du conjoint (3j)', doc: 'Acte de décès ou certificat de décès' },
      { label: 'Décès du frère ou de la sœur (3j)', doc: 'Acte de décès ou certificat de décès' }
    ],
    delai: '48h après l\'événement'
  },
  'maternelle': {
    titre: 'Maternité',
    documents: [
      { label: 'Maternité (16 sem = 112j / 18 sem pathologique = 126j)', doc: 'Certificat médical d\'accouchement' }
    ],
    delai: '48h après l\'événement'
  }
}

function infererTypePermissionDepuisPermission(permission) {
  if (!permission) return ''
  const brut = String(permission.type_permission || permission.type || permission.motif || '').toLowerCase().trim()
  if (brut.includes('mariage')) return 'mariage'
  if (brut.includes('accouchement')) return 'accouchement'
  if (brut.includes('bapteme') || brut.includes('baptême')) return 'bapteme'
  if (brut.includes('deces') || brut.includes('décès')) return 'deces'
  if (brut.includes('matern')) return 'maternelle'
  const sousType = String(permission.sous_type || '').toLowerCase().trim()
  const duree = Number(permission.duree_jours || permission.duree || 0)
  if (['conjoint', 'pere', 'mere', 'beau_pere', 'belle_mere', 'frere', 'soeur'].includes(sousType)) return 'deces'
  if (sousType === 'epouse') return 'accouchement'
  if (['simple', 'pathologique'].includes(sousType)) return 'maternelle'
  if (sousType === 'salarie') return 'mariage'
  if (sousType === 'enfant') {
    if (duree === 1) return 'bapteme'
    if (duree === 2) return 'mariage'
    if (duree === 3) return 'deces'
  }
  return ''
}

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

export default function PermissionsPage() {
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
  const [soldeConges, setSoldeConges] = useState(null)
  const [loading, setLoading] = useState(true)
  const senderName = useMemo(() => [user?.prenom, user?.nom].filter(Boolean).join(' ').trim() || user?.nom || 'Utilisateur', [user])
  const [showForm, setShowForm] = useState(false)
  const matricule = useMemo(() => Number(user?.matricule || user?.sub || 0), [user])
  const roleUtilisateur = useMemo(() => String(user?.role || '').toUpperCase(), [user])
  const peutCreerPourAutrui = useMemo(() => ['RH', 'ADMIN'].includes(roleUtilisateur), [roleUtilisateur])

  // Form state
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [permissionType, setPermissionType] = useState('conventionnelle')
  const [matriculeCible, setMatriculeCible] = useState('')
  const [permForm, setPermForm] = useState({ type_permission: 'maladie', sous_type: '', duree: 1, date_debut: '', date_fin: '', motif: '' })
  const [permNonConvForm, setPermNonConvForm] = useState({ date_debut: '', date_fin: '', motif: '' })
  const [permissionPreuveUpload, setPermissionPreuveUpload] = useState({ id_operation: '', files: [] })
  const [prevuesPermissionEnCours, setPrevuesPermissionEnCours] = useState([])
  const [voirTousDocuments, setVoirTousDocuments] = useState(false)
  const [typePermissionDocuments, setTypePermissionDocuments] = useState('')

  const permissionsEligibles = useMemo(() => {
    return items.filter(p => p.statut === 'VALIDE' && p.statut_activation === 'ACTIVE' && !p.statut_cloture)
  }, [items])

  const sousTypesDisponibles = useMemo(() => {
    const typeConfig = PERMISSIONS_CONVENTIONNELLES[permForm.type_permission]
    return typeConfig ? typeConfig.sousTypes : []
  }, [permForm.type_permission])

  // Auto-calc date_fin for conventionnelle
  useEffect(() => {
    if (permForm.type_permission && permForm.sous_type && permForm.date_debut) {
      const typeConfig = PERMISSIONS_CONVENTIONNELLES[permForm.type_permission]
      if (typeConfig) {
        const sousTypeConfig = typeConfig.sousTypes.find(st => st.value === permForm.sous_type)
        if (sousTypeConfig && sousTypeConfig.duree) {
          const dateDebut = new Date(permForm.date_debut)
          const dateFin = new Date(dateDebut)
          dateFin.setDate(dateFin.getDate() + sousTypeConfig.duree - 1)
          setPermForm(prev => ({ ...prev, date_fin: dateFin.toISOString().split('T')[0], duree: sousTypeConfig.duree }))
        }
      }
    }
  }, [permForm.type_permission, permForm.sous_type, permForm.date_debut])

  useEffect(() => {
    if (!permissionPreuveUpload.id_operation) { setTypePermissionDocuments(''); return }
    const sel = permissionsEligibles.find(p => String(p.id_operation) === String(permissionPreuveUpload.id_operation))
    setTypePermissionDocuments(infererTypePermissionDepuisPermission(sel))
    setVoirTousDocuments(false)
  }, [permissionPreuveUpload.id_operation, permissionsEligibles])

  function loadData() {
    if (!user?.matricule) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      api.get(`/api/permissions/mes-permissions/${user.matricule}`).catch(() => ({ data: [] })),
      api.get(`/api/workflow/a-valider/${user.matricule}`).catch(() => ({ data: [] })),
      api.get(`/api/conges/solde/${user.matricule}`).catch(() => ({ data: {} }))
    ]).then(([r1, r2, r3]) => {
      const sent = Array.isArray(r1.data) ? r1.data : []
      const recv = (Array.isArray(r2.data) ? r2.data : []).filter(d => d.type_demande === 'Permission')
      setItems(sent)
      setAValider(recv)
      setSoldeConges(Number(r3?.data?.solde_conges ?? 0))
      setLoading(false)
    })
  }

  useEffect(() => { loadData() }, [user?.matricule])

  async function submitPermission(e) {
    e.preventDefault()
    setFormError(''); setFormSuccess('')
    try {
      const mat = (peutCreerPourAutrui && matriculeCible) ? Number(matriculeCible) : matricule
      if (!mat || Number.isNaN(mat)) { setFormError('Matricule cible invalide'); return }
      await api.post('/api/permissions/conventionnelle', null, {
        params: { matricule: mat, matricule_createur: matricule, type_permission: permForm.type_permission, sous_type: permForm.sous_type || null, duree: Number(permForm.duree || 1), date_debut: permForm.date_debut, date_fin: permForm.date_fin, motif: permForm.motif || null }
      })
      setFormSuccess('Demande de permission conventionnelle soumise')
      setPermForm({ type_permission: 'maladie', sous_type: '', duree: 1, date_debut: '', date_fin: '', motif: '' })
      loadData()
    } catch (err) { setFormError(err.response?.data?.detail || 'Erreur création permission') }
  }

  async function submitPermissionNonConventionnelle(e) {
    e.preventDefault()
    setFormError(''); setFormSuccess('')
    try {
      const mat = (peutCreerPourAutrui && matriculeCible) ? Number(matriculeCible) : matricule
      if (!mat || Number.isNaN(mat)) { setFormError('Matricule cible invalide'); return }
      await api.post('/api/conges/demande', null, {
        params: { matricule: mat, matricule_createur: matricule, date_debut: permNonConvForm.date_debut, date_fin: permNonConvForm.date_fin, motif: permNonConvForm.motif ? `Permission non-conventionnelle: ${permNonConvForm.motif}` : 'Permission non-conventionnelle' }
      })
      setFormSuccess('Demande de permission non-conventionnelle soumise (déduit du solde de congés)')
      setPermNonConvForm({ date_debut: '', date_fin: '', motif: '' })
      loadData()
    } catch (err) { setFormError(err.response?.data?.detail || 'Erreur création permission non-conventionnelle') }
  }

  async function uploadPreuvePermission(e) {
    e.preventDefault()
    setFormError(''); setFormSuccess('')
    if (!permissionPreuveUpload.id_operation || permissionPreuveUpload.files.length === 0) { setFormError('Veuillez renseigner ID opération et sélectionner au moins un fichier'); return }
    try {
      for (const file of permissionPreuveUpload.files) {
        const fd = new FormData()
        fd.append('fichier', file)
        await api.post(`/api/permissions/${permissionPreuveUpload.id_operation}/televerser-preuves`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        setPrevuesPermissionEnCours(prev => [...prev, { filename: file.name }])
      }
      setFormSuccess(`${permissionPreuveUpload.files.length} preuve(s) de permission téléversée(s) avec succès!`)
      setPermissionPreuveUpload({ id_operation: '', files: [] })
      loadData()
    } catch (err) { setFormError(err.response?.data?.detail || 'Erreur téléversement preuve permission') }
  }

  const applyFilters = list => list.filter(item => {
    const dateValue = item.date_creation || item.created_at || item.date_soumission || item.date_debut || ''
    const statusValue = (item.statut || item.status || '').toLowerCase()
    const sourceValue = (activeTab === 'recu' ? 'Approbations' : 'Permission').toLowerCase()
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
      await api.put(`/api/permissions/${id}`, { statut: 'annulé' })
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
        <button onClick={() => navigate(`/rh/permissions/edit/${item.id_operation}`)} style={primaryBtn}>Modifier</button>
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
    if (!rows.length) return <tr><td colSpan={10} style={{ ...td, textAlign: 'center', color: '#9ca3af' }}>Aucune demande</td></tr>
    return rows.map(item => (
      <tr key={item.id_operation}>
        <td style={{ ...td, fontWeight: 600 }}>{item.motif || item.type_permission || `Permission #${item.id_operation}`}</td>
        <td style={td}>{isRecu ? 'Approbations' : 'Permission'}</td>
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
        <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#021630' }}>Gestion des Permissions</h1>
        <button onClick={() => { setShowForm(true); setFormError(''); setFormSuccess('') }} style={{ padding: '9px 14px', background: '#ce2b2b', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>Nouvelle demande</button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>Nouvelle demande de permission</strong>
            <button onClick={() => setShowForm(false)} style={{ padding: '7px 12px', background: '#eef2f7', color: '#334155', border: '1px solid #dbe2ea', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>Annuler</button>
          </div>
          {formError && <div className="alert alert-danger" style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' }}>{formError}</div>}
          {formSuccess && <div className="alert alert-success" style={{ background: '#d1fae5', color: '#065f46', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: '0.9rem' }}>{formSuccess}</div>}

          {/* Sous-onglets permission */}
          <div style={{display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px'}}>
            <button className={`btn ${permissionType === 'conventionnelle' ? 'btn-primary' : ''}`} onClick={() => setPermissionType('conventionnelle')} style={{minWidth: '150px', display:'inline-flex', alignItems:'center', gap:5}}>
              <ClipboardList size={13}/> Conventionnelle
            </button>
            <button className={`btn ${permissionType === 'non-conventionnelle' ? 'btn-primary' : ''}`} onClick={() => setPermissionType('non-conventionnelle')} style={{minWidth: '150px', display:'inline-flex', alignItems:'center', gap:5}}>
              <AlertTriangle size={13}/> Non-conventionnelle
            </button>
          </div>

          {permissionType === 'conventionnelle' && (
            <>
              <div style={{background: '#e0f2fe', padding: '12px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #0ea5e9'}}>
                <p style={{margin: 0, fontSize: '0.9rem', color: '#0369a1'}}>
                  <strong style={{display:'inline-flex',alignItems:'center',gap:5}}><Calendar size={13}/> Permission conventionnelle:</strong> Autorisée par le code du travail (maladie, décès, mariage, etc.). N'affecte pas votre solde de congés.
                </p>
              </div>
              <form className="form-card" onSubmit={submitPermission}>
                <h3>Demande de permission conventionnelle</h3>
                {peutCreerPourAutrui && (
                  <div className="form-group">
                    <label>Matricule cible (optionnel)</label>
                    <input type="number" value={matriculeCible} onChange={(e) => setMatriculeCible(e.target.value)} placeholder="Laisser vide pour moi-même" />
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label>Type de permission</label>
                    <select value={permForm.type_permission} onChange={(e) => setPermForm({ ...permForm, type_permission: e.target.value, sous_type: '', date_fin: '', duree: 1 })} required>
                      <option value="">-- Sélectionner un type --</option>
                      <option value="mariage">Mariage</option>
                      <option value="accouchement">Accouchement</option>
                      <option value="bapteme">Baptême</option>
                      <option value="deces">Décès</option>
                      <option value="maternelle">Maternité</option>
                    </select>
                  </div>
                </div>
                {sousTypesDisponibles.length > 0 && (
                  <div className="form-row">
                    <div className="form-group">
                      <label>Précision (selon Convention Collective Nationale du Commerce)</label>
                      <input list="sous-types-list-perm" value={permForm.sous_type} onChange={(e) => setPermForm({ ...permForm, sous_type: e.target.value })} placeholder="Sélectionnez ou saisissez..." required />
                      <datalist id="sous-types-list-perm">
                        {sousTypesDisponibles.map(st => (<option key={st.value} value={st.value}>{st.label} - {st.duree} jour{st.duree > 1 ? 's' : ''}</option>))}
                      </datalist>
                    </div>
                  </div>
                )}
                {sousTypesDisponibles.length > 0 && permForm.sous_type && (
                  <div style={{background: '#dbeafe', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '0.9rem'}}>
                    <strong style={{display:'inline-flex',alignItems:'center',gap:5}}><ClipboardList size={13}/> Durée automatique:</strong> {(() => { const st = sousTypesDisponibles.find(s => s.value === permForm.sous_type); return st ? `${st.duree} jour${st.duree > 1 ? 's' : ''} selon la convention collective` : '' })()}
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label>Date début</label>
                    <input type="date" value={permForm.date_debut} onChange={(e) => setPermForm({ ...permForm, date_debut: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Date fin {sousTypesDisponibles.length > 0 && permForm.sous_type ? '(calculée automatiquement)' : ''}</label>
                    <input type="date" value={permForm.date_fin} onChange={(e) => setPermForm({ ...permForm, date_fin: e.target.value })} readOnly={sousTypesDisponibles.length > 0 && !!permForm.sous_type} required style={sousTypesDisponibles.length > 0 && permForm.sous_type ? {background: '#f3f4f6', cursor: 'not-allowed'} : {}} />
                  </div>
                  <div className="form-group">
                    <label>Durée (jours)</label>
                    <input type="number" value={permForm.date_debut && permForm.date_fin ? Math.ceil((new Date(permForm.date_fin) - new Date(permForm.date_debut)) / (1000 * 60 * 60 * 24)) + 1 : (permForm.duree || 0)} readOnly style={{background: '#f3f4f6', cursor: 'not-allowed'}} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Motif</label>
                  <textarea value={permForm.motif} onChange={(e) => setPermForm({ ...permForm, motif: e.target.value })} />
                </div>
                <button className="btn btn-success" type="submit">Soumettre</button>
              </form>

              <form className="form-card" onSubmit={uploadPreuvePermission}>
                <h3>Téléversement des preuves</h3>
                <div style={{background: '#fef3c7', padding: '12px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #f59e0b'}}>
                  <p style={{margin: 0, fontSize: '0.9rem', color: '#92400e', display:'flex', alignItems:'flex-start', gap:5}}>
                    <AlertTriangle size={12} style={{flexShrink:0, marginTop:2}}/> <span><strong>Important:</strong> Vous ne pouvez téléverser une preuve que pour une permission <strong>validée et activée</strong>. Le téléversement de la preuve permet de <strong>clôturer la permission</strong>.</span>
                  </p>
                </div>
                {permissionsEligibles.length > 0 && (
                  <div className="form-group">
                    <label>Sélectionnez la permission</label>
                    <select value={permissionPreuveUpload.id_operation} onChange={(e) => { setPermissionPreuveUpload({ ...permissionPreuveUpload, id_operation: e.target.value }); setVoirTousDocuments(false) }} required>
                      <option value="">-- Choisir une permission --</option>
                      {permissionsEligibles.map(p => (<option key={p.id_operation} value={p.id_operation}>ID {p.id_operation} - {p.type_permission} ({new Date(p.date_debut).toLocaleDateString('fr-FR')} au {new Date(p.date_fin).toLocaleDateString('fr-FR')})</option>))}
                    </select>
                  </div>
                )}
                {/* Info sur les documents requis selon le type */}
                <div style={{background: '#e0f2fe', padding: '12px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #0ea5e9'}}>
                  <p style={{margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: 'bold', color: '#0c4a6e', display:'flex', alignItems:'center', gap:5}}><FileText size={13}/> ARTICLE 7 - Documents requis</p>
                  <div className="form-group" style={{marginBottom: '12px'}}>
                    <label style={{fontSize: '0.85rem', color: '#075985'}}>Type de document à afficher</label>
                    <select value={voirTousDocuments ? '__all__' : (typePermissionDocuments || '')} onChange={(e) => { const v = e.target.value; if (v === '__all__') { setVoirTousDocuments(true) } else { setTypePermissionDocuments(v); setVoirTousDocuments(false) } }}>
                      <option value="__all__">Tous les types</option>
                      <option value="mariage">Mariage</option>
                      <option value="accouchement">Accouchement</option>
                      <option value="bapteme">Baptême</option>
                      <option value="deces">Décès</option>
                      <option value="maternelle">Maternité</option>
                    </select>
                  </div>
                  {(() => {
                    if (typePermissionDocuments && !voirTousDocuments && DOCUMENTS_REQUIS[typePermissionDocuments]) {
                      const info = DOCUMENTS_REQUIS[typePermissionDocuments]
                      return (<>
                        <div style={{background: '#fff', padding: '10px', borderRadius: '6px', marginBottom: '10px'}}>
                          <p style={{margin: '0 0 8px 0', fontSize: '0.85rem', fontWeight: 'bold', color: '#0369a1', display:'flex', alignItems:'center', gap:4}}><Pin size={12}/> {info.titre}</p>
                          <ul style={{margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: '#0c4a6e', lineHeight: '1.6'}}>{info.documents.map((doc, idx) => (<li key={idx}><strong>{doc.label}:</strong> {doc.doc}</li>))}</ul>
                          <p style={{margin: '8px 0 0 0', fontSize: '0.75rem', color: '#075985', fontStyle: 'italic'}}><Clock size={12} style={{verticalAlign:'middle', marginRight:4}}/> Délai de demande: {info.delai}</p>
                        </div>
                        <button type="button" onClick={() => setVoirTousDocuments(true)} style={{background: 'transparent', border: 'none', color: '#0284c7', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline', padding: 0, marginTop: '5px'}}><ClipboardList size={12} style={{verticalAlign:'middle', marginRight:3}}/> Voir tous les types de permissions</button>
                      </>)
                    } else {
                      return (<>
                        {Object.entries(DOCUMENTS_REQUIS).map(([type, info]) => (
                          <div key={type} style={{background: '#fff', padding: '10px', borderRadius: '6px', marginBottom: '8px'}}>
                            <p style={{margin: '0 0 5px 0', fontSize: '0.8rem', fontWeight: 'bold', color: '#0369a1'}}>{info.titre}</p>
                            <ul style={{margin: 0, paddingLeft: '20px', fontSize: '0.8rem', color: '#0c4a6e', lineHeight: '1.5'}}>{info.documents.map((doc, idx) => (<li key={idx}><strong>{doc.label}:</strong> {doc.doc}</li>))}</ul>
                          </div>
                        ))}
                        {typePermissionDocuments && voirTousDocuments && (
                          <button type="button" onClick={() => setVoirTousDocuments(false)} style={{background: 'transparent', border: 'none', color: '#0284c7', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline', padding: 0, marginTop: '5px'}}><Pin size={12} style={{verticalAlign:'middle', marginRight:3}}/> Voir uniquement mon type sélectionné</button>
                        )}
                      </>)
                    }
                  })()}
                  <p style={{margin: '12px 0 0 0', fontSize: '0.75rem', color: '#075985', fontStyle: 'italic', paddingTop: '10px', borderTop: '1px solid #bae6fd'}}>
                    <strong style={{display:'inline-flex',alignItems:'center',gap:4}}><Calendar size={12}/> Délais généraux:</strong> Documents à fournir dans les 60 jours (Article 7). Limite annuelle: 12 jours par année calendaire (hors maternité).
                  </p>
                </div>
                {permissionsEligibles.length > 0 ? (<>
                  <div className="form-group">
                    <label>Fichiers preuve (sélectionnez un ou plusieurs fichiers)</label>
                    <input type="file" multiple onChange={(e) => setPermissionPreuveUpload({ ...permissionPreuveUpload, files: Array.from(e.target.files || []) })} required />
                    {permissionPreuveUpload.files.length > 0 && <p style={{fontSize: '0.85rem', color: '#666', marginTop: '5px'}}>{permissionPreuveUpload.files.length} fichier(s) sélectionné(s)</p>}
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={permissionPreuveUpload.files.length === 0}>Téléverser {permissionPreuveUpload.files.length > 0 ? `${permissionPreuveUpload.files.length} fichier(s)` : "preuves"}</button>
                  {prevuesPermissionEnCours.length > 0 && (
                    <div className="form-card" style={{background: '#d1e7dd', marginTop: '20px'}}>
                      <h3 style={{display:'flex',alignItems:'center',gap:6}}><CheckCircle size={14}/> Preuves téléversées ({prevuesPermissionEnCours.length})</h3>
                      <ul style={{margin: '10px 0', paddingLeft: '20px'}}>{prevuesPermissionEnCours.map((p, idx) => (<li key={idx} style={{marginBottom: '5px'}}><strong>{p.filename}</strong></li>))}</ul>
                      <button className="btn btn-info" onClick={() => { setPermissionPreuveUpload({ id_operation: permissionPreuveUpload.id_operation, files: [] }); setFormSuccess('') }} style={{marginTop: '10px'}}>+ Téléverser d'autres preuves</button>
                    </div>
                  )}
                </>) : (
                  <div style={{background: '#e0e7ff', padding: '20px', borderRadius: '8px', textAlign: 'center'}}>
                    <p style={{margin: 0, color: '#3730a3', fontSize: '0.95rem', display:'flex', alignItems:'center', gap:6}}><Search size={13}/> Aucune permission validée et activée disponible pour le téléversement de preuve.</p>
                  </div>
                )}
              </form>
            </>
          )}

          {permissionType === 'non-conventionnelle' && (<>
            <div style={{background: '#fef3c7', padding: '12px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #f59e0b'}}>
              <p style={{margin: 0, fontSize: '0.9rem', color: '#92400e', display:'flex', alignItems:'center', gap:6}}>
                <AlertTriangle size={13}/> <strong>Permission non-conventionnelle:</strong> Absence exceptionnelle. La durée sera <strong>déduite de votre solde de congés</strong>.
              </p>
            </div>
            <form className="form-card" onSubmit={submitPermissionNonConventionnelle}>
              <h3>Demande de permission non-conventionnelle</h3>
              {peutCreerPourAutrui && (
                <div className="form-group">
                  <label>Matricule cible (optionnel)</label>
                  <input type="number" value={matriculeCible} onChange={(e) => setMatriculeCible(e.target.value)} placeholder="Laisser vide pour moi-même" />
                </div>
              )}
              <div className="form-row">
                <div className="form-group">
                  <label>Date début</label>
                  <input type="date" value={permNonConvForm.date_debut} onChange={(e) => setPermNonConvForm({ ...permNonConvForm, date_debut: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Date fin</label>
                  <input type="date" value={permNonConvForm.date_fin} onChange={(e) => setPermNonConvForm({ ...permNonConvForm, date_fin: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Durée (jours) - Sera déduite du solde</label>
                  <input type="number" value={permNonConvForm.date_debut && permNonConvForm.date_fin ? Math.ceil((new Date(permNonConvForm.date_fin) - new Date(permNonConvForm.date_debut)) / (1000 * 60 * 60 * 24)) + 1 : 0} readOnly />
                </div>
              </div>
              <div className="form-group">
                <label>Motif (obligatoire)</label>
                <textarea value={permNonConvForm.motif} onChange={(e) => setPermNonConvForm({ ...permNonConvForm, motif: e.target.value })} required placeholder="Expliquez la raison de cette permission non-conventionnelle..." />
              </div>
              <button className="btn btn-success" type="submit">Soumettre</button>
            </form>
          </>)}
        </div>
      )}

      <div style={{ marginBottom: 10, background: 'linear-gradient(90deg, #dbeafe, #f0fdf4)', border: '1px solid #dbeafe', borderRadius: 10, padding: '12px 14px' }}>
        <div style={{ fontSize: '0.8rem', color: '#334155', fontWeight: 700 }}>Solde de conge</div>
        <div style={{ fontSize: '2rem', lineHeight: 1.05, fontWeight: 900, color: '#0f172a' }}>{Number(soldeConges || 0).toLocaleString('fr-FR')} jours</div>
      </div>
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
