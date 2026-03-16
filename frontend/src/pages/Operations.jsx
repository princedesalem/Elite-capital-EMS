import React, { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { useSearchParams } from 'react-router-dom'
import ProgressionValidation from '../components/ProgressionValidation'
import CommentairesMission from '../components/CommentairesMission'
import '../styles/Operations.css'
import {
  Target, Home, FileText, BarChart2, Users, ClipboardList, AlertTriangle,
  Pin, Calendar, Plus, Trash2, Plane, CheckCircle, XCircle, Pencil,
  Search, UserCheck, Clock, ChevronRight, User
} from 'lucide-react'

// Configuration des permissions conventionnelles selon l'ARTICLE 7 du Règlement Intérieur
// Convention Collective Nationale du Commerce
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

// Documents requis par type de permission (Article 7)
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

function normaliserTypePermission(typePermission) {
  const brut = String(typePermission || '').toLowerCase().trim()
  if (!brut) return ''

  if (brut.includes('mariage')) return 'mariage'
  if (brut.includes('accouchement')) return 'accouchement'
  if (brut.includes('bapteme') || brut.includes('baptême')) return 'bapteme'
  if (brut.includes('deces') || brut.includes('décès')) return 'deces'
  if (brut.includes('matern')) return 'maternelle'

  return brut
}

function infererTypePermissionDepuisPermission(permission) {
  if (!permission) return ''

  const candidats = [permission.type_permission, permission.type, permission.motif]
  for (const candidat of candidats) {
    const normalise = normaliserTypePermission(candidat)
    if (normalise && DOCUMENTS_REQUIS[normalise]) return normalise
  }

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

// Configuration des frais de mission
const FRAIS_MISSION_CONFIG = {
  // Prix unitaires par jour (en FCFA)
  frais_deplacement_unitaire: 25000, // Par jour
  frais_hotel_unitaire: 50000, // Par nuit
  // Transport routier fixe
  frais_transport_routier: 15000,
  // Frais mission par rôle (augmentation % supplémentaire)
  frais_mission_par_role: {
    'agent': 20000, // Montant de base
    'superviseur': 25000,
    'chef': 30000,
    'manager': 35000,
    'directeur': 40000
  }
}

export default function Operations() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const matricule = useMemo(() => Number(user?.matricule || user?.sub || 0), [user])
  const roleUtilisateur = useMemo(() => String(user?.role || '').toUpperCase(), [user])
  const peutCreerPourAutrui = useMemo(() => ['RH', 'ADMIN'].includes(roleUtilisateur), [roleUtilisateur])
  const peutInitierMission = useMemo(
    () => ['RESPONSABLE', 'DIRECTEUR', 'RH', 'DG', 'PCA', 'ADMIN'].includes(roleUtilisateur),
    [roleUtilisateur]
  )
  const estValidateur = useMemo(
    () => ['RESPONSABLE', 'DIRECTEUR', 'RH', 'DG', 'DFC', 'PCA', 'AG', 'ADMIN'].includes(roleUtilisateur),
    [roleUtilisateur]
  )

  const [activeTab, setActiveTab] = useState('accueil')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedOperation, setSelectedOperation] = useState(null)
  const [workflowDecisionComment, setWorkflowDecisionComment] = useState('')
  const [showWorkflowInDetail, setShowWorkflowInDetail] = useState(false)
  const [selectedOperationDetails, setSelectedOperationDetails] = useState(null)

  const [conges, setConges] = useState([])
  const [permissions, setPermissions] = useState([])
  const [missions, setMissions] = useState([])
  const [operations, setOperations] = useState([])

  const [mesDemandes, setMesDemandes] = useState([])
  const [aValider, setAValider] = useState([])
  const [mesValidations, setMesValidations] = useState([])
  const [mesRefus, setMesRefus] = useState([])

  const [notifications, setNotifications] = useState([])
  const [badgeCount, setBadgeCount] = useState(0)

  // Filtrer les permissions éligibles pour téléversement (validées et activées)
  const permissionsEligibles = useMemo(() => {
    return permissions.filter(p => 
      p.statut === 'VALIDE' && 
      p.statut_activation === 'ACTIVE' &&
      !p.statut_cloture // Pas encore clôturée
    )
  }, [permissions])

  const [mesRemplacements, setMesRemplacements] = useState([])
  const [propositions, setPropositions] = useState([])
  const [operationRecherche, setOperationRecherche] = useState('')

  const [evaluations, setEvaluations] = useState([])
  const [fichePoste, setFichePoste] = useState(null)

  const [employe, setEmploye] = useState(null)

  const [demandeType, setDemandeType] = useState('conges')
  const [permissionType, setPermissionType] = useState('conventionnelle')
  const [congeForm, setCongeForm] = useState({ date_debut: '', date_fin: '', motif: '' })
  const [permForm, setPermForm] = useState({
    type_permission: 'maladie',
    sous_type: '',
    duree: 1,
    date_debut: '',
    date_fin: '',
    motif: ''
  })
  const [permNonConvForm, setPermNonConvForm] = useState({ date_debut: '', date_fin: '', motif: '' })
  const [matriculeCible, setMatriculeCible] = useState('')
  const [missionForm, setMissionForm] = useState({
    motif: '',
    email_contact: ''
  })
  const [missionSegments, setMissionSegments] = useState([{
    id: 1,
    pays: '',
    ville: '',
    date_debut: '',
    date_fin: '',
    heure_depart: '08:00:00',
    heure_arrivee: '18:00:00',
    heure_retour: '18:00:00',
    moyen_transport: 'aerien'
  }])
  const [missionEditMode, setMissionEditMode] = useState(false)
  const [missionEditId, setMissionEditId] = useState(null)
  const [missionMissionnaires, setMissionMissionnaires] = useState([])  // Liste des missionnaires sélectionnés
  const [rechercheEmploye, setRechercheEmploye] = useState('')  // Terme de recherche
  const [employesTrouves, setEmployesTrouves] = useState([])  // Résultats de recherche
  const [fraisForm, setFraisForm] = useState({
    id_operation: '',
    frais_transport_unitaire: 0,
    frais_hotel_unitaire: 0,
    frais_deplacement_unitaire: 0,
    frais_mission_unitaire: 0,
    justificatif: ''
  })
  const [missionStatuts, setMissionStatuts] = useState({}) // {id_operation: {...statut}}
  const [statutsPaiementFrais, setStatutsPaiementFrais] = useState({}) // {id_mission: {...statut paiement}}

  const [rapportUpload, setRapportUpload] = useState({ id_operation: '', file: null })
  const [preuveUpload, setPreuveUpload] = useState({ id_frais: '', type_preuve: 'facture', file: null })
  const [permissionPreuveUpload, setPermissionPreuveUpload] = useState({ id_operation: '', files: [] })
  const [preuvesFraisEnCours, setPreuvesFraisEnCours] = useState([])
  const [prevuesPermissionEnCours, setPrevuesPermissionEnCours] = useState([])
  const [voirTousDocuments, setVoirTousDocuments] = useState(false) // Pour afficher tous les documents ou juste le type sélectionné
  const [typePermissionDocuments, setTypePermissionDocuments] = useState('')

  useEffect(() => {
    if (!matricule) return
    loadAll()
  }, [matricule])

  // Réinitialiser l'affichage des documents quand l'utilisateur change de permission
  useEffect(() => {
    if (permissionPreuveUpload.id_operation) {
      setVoirTousDocuments(false)
    }
  }, [permissionPreuveUpload.id_operation])

  useEffect(() => {
    if (!permissionPreuveUpload.id_operation) {
      setTypePermissionDocuments('')
      return
    }

    const permissionSelectionnee = permissionsEligibles.find(
      p => String(p.id_operation) === String(permissionPreuveUpload.id_operation)
    )
    setTypePermissionDocuments(infererTypePermissionDepuisPermission(permissionSelectionnee))
  }, [permissionPreuveUpload.id_operation, permissionsEligibles])

  useEffect(() => {
    // Toujours afficher d'abord le formulaire de détail; le workflow s'ouvre uniquement sur action explicite.
    setShowWorkflowInDetail(false)
  }, [selectedOperation])

  useEffect(() => {
    if (!selectedOperation) {
      setSelectedOperationDetails(null)
      return
    }

    api.get(`/api/operations/${selectedOperation}`)
      .then((res) => setSelectedOperationDetails(res.data || null))
      .catch(() => setSelectedOperationDetails(null))
  }, [selectedOperation])

  useEffect(() => {
    if (!matricule) return
    if (activeTab === 'workflow') loadWorkflow()
    if (activeTab === 'remplacants') loadRemplacants()
    if (activeTab === 'demandes') loadEmploye()
  }, [activeTab, matricule])

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && ['accueil', 'demandes', 'workflow', 'remplacants'].includes(tab)) {
      setActiveTab(tab)
    }
    const type = searchParams.get('type')
    if (type && ['conges', 'permissions', 'missions', 'frais'].includes(type)) {
      setDemandeType(type)
    }
  }, [searchParams])

  // Calcul automatique de la date de fin et durée pour permissions conventionnelles
  useEffect(() => {
    if (permForm.type_permission && permForm.sous_type && permForm.date_debut) {
      const typeConfig = PERMISSIONS_CONVENTIONNELLES[permForm.type_permission]
      if (typeConfig && typeConfig.sousTypes.length > 0) {
        const sousTypeConfig = typeConfig.sousTypes.find(st => st.value === permForm.sous_type)
        if (sousTypeConfig && sousTypeConfig.duree) {
          // Calculer la date de fin
          const dateDebut = new Date(permForm.date_debut)
          const dateFin = new Date(dateDebut)
          dateFin.setDate(dateFin.getDate() + sousTypeConfig.duree - 1) // -1 car le premier jour est inclus
          
          const dateFinStr = dateFin.toISOString().split('T')[0]
          setPermForm(prev => ({
            ...prev,
            date_fin: dateFinStr,
            duree: sousTypeConfig.duree
          }))
        }
      }
    }
  }, [permForm.type_permission, permForm.sous_type, permForm.date_debut])

  // Obtenir les sous-types disponibles selon le type de permission
  const sousTypesDisponibles = useMemo(() => {
    const typeConfig = PERMISSIONS_CONVENTIONNELLES[permForm.type_permission]
    return typeConfig ? typeConfig.sousTypes : []
  }, [permForm.type_permission])

  // Calcul des durées et totaux pour les frais de mission
  const fraisMissionCalculs = useMemo(() => {
    if (!fraisForm.id_operation || missions.length === 0) {
      return { durationDays: 0, nuits: 0, frais_transport_total: 0, frais_hotel_total: 0, frais_deplacement_total: 0, frais_mission_total: 0, total_general: 0 }
    }

    const mission = missions.find(m => m.id_operation === parseInt(fraisForm.id_operation))
    if (!mission) {
      return { durationDays: 0, nuits: 0, frais_transport_total: 0, frais_hotel_total: 0, frais_deplacement_total: 0, frais_mission_total: 0, total_general: 0 }
    }

    const dateDebut = new Date(mission.date_debut)
    const dateFin = new Date(mission.date_fin)
    const heure_arrivee = mission.heure_arrivee ? mission.heure_arrivee.split(':') : ['18', '00', '00']
    const heure_retour = mission.heure_retour ? mission.heure_retour.split(':') : ['17', '00', '00']

    // Calculer la durée en jours
    const durationDays = Math.ceil((dateFin - dateDebut) / (1000 * 60 * 60 * 24)) + 1

    // Calculer le nombre de nuits
    const dateArrivee = new Date(mission.date_debut)
    dateArrivee.setHours(parseInt(heure_arrivee[0]), parseInt(heure_arrivee[1]))

    const dateRetour = new Date(mission.date_fin)
    dateRetour.setHours(parseInt(heure_retour[0]), parseInt(heure_retour[1]))

    const nuits = Math.max(0, Math.ceil((dateRetour - dateArrivee) / (1000 * 60 * 60 * 24)))

    // Calcul avec les prix unitaires entrés par l'utilisateur
    const frais_transport_total = Number(fraisForm.frais_transport_unitaire || 0) // Payé une seule fois
    const frais_hotel_total = Number(fraisForm.frais_hotel_unitaire || 0) * Math.max(1, nuits)
    const frais_deplacement_total = Number(fraisForm.frais_deplacement_unitaire || 0) * durationDays
    const frais_mission_total = Number(fraisForm.frais_mission_unitaire || 0) * durationDays

    const total_general = frais_transport_total + frais_hotel_total + frais_deplacement_total + frais_mission_total

    return { 
      durationDays, 
      nuits, 
      frais_transport_total, 
      frais_hotel_total, 
      frais_deplacement_total, 
      frais_mission_total, 
      total_general 
    }
  }, [fraisForm.id_operation, fraisForm.frais_transport_unitaire, fraisForm.frais_hotel_unitaire, fraisForm.frais_deplacement_unitaire, fraisForm.frais_mission_unitaire, missions])

  // Auto-remplir frais transport si transport routier
  useEffect(() => {
    if (!fraisForm.id_operation || missions.length === 0) return

    const mission = missions.find(m => m.id_operation === parseInt(fraisForm.id_operation))
    if (!mission) return

    // Si le moyen de transport est "routier", définir automatiquement à 15000 FCFA
    if (mission.moyens_transport && mission.moyens_transport.includes('routier')) {
      setFraisForm(prev => ({
        ...prev,
        frais_transport_unitaire: 15000
      }))
    } else {
      // Sinon, réinitialiser à 0
      setFraisForm(prev => ({
        ...prev,
        frais_transport_unitaire: 0
      }))
    }
  }, [fraisForm.id_operation, missions])

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [ops, c, p, m, mes] = await Promise.all([
        api.get('/api/operations/').catch(() => ({ data: [] })),
        api.get(`/api/conges/historique/${matricule}`).catch(() => ({ data: [] })),
        api.get(`/api/permissions/mes-permissions/${matricule}`).catch(() => ({ data: [] })),
        api.get(`/api/missions/mes-missions/${matricule}`).catch(() => ({ data: [] })),
        api.get(`/api/workflow/mes-demandes/${matricule}`).catch(() => ({ data: [] }))
      ])
      setOperations(Array.isArray(ops.data) ? ops.data : [])
      setConges(Array.isArray(c.data) ? c.data : [])
      setPermissions(Array.isArray(p.data) ? p.data : [])
      setMissions(Array.isArray(m.data) ? m.data : [])
      setMesDemandes(Array.isArray(mes.data) ? mes.data : [])
      await loadBadge()
    } catch (e) {
      setError(e.response?.data?.detail || 'Erreur de chargement des demandes')
    } finally {
      setLoading(false)
    }
  }

  async function loadWorkflow() {
    setLoading(true)
    setError('')
    try {
      const [mes, valider, validations, refus] = await Promise.all([
        api.get(`/api/workflow/mes-demandes/${matricule}`).catch(() => ({ data: [] })),
        api.get(`/api/workflow/a-valider/${matricule}`).catch(() => ({ data: [] })),
        api.get(`/api/workflow/mes-validations/${matricule}`).catch(() => ({ data: [] })),
        api.get(`/api/workflow/mes-refus/${matricule}`).catch(() => ({ data: [] }))
      ])
      setMesDemandes(Array.isArray(mes.data) ? mes.data : [])
      setAValider(Array.isArray(valider.data) ? valider.data : [])
      setMesValidations(Array.isArray(validations.data) ? validations.data : [])
      setMesRefus(Array.isArray(refus.data) ? refus.data : [])
    } catch (e) {
      setError(e.response?.data?.detail || 'Erreur de chargement du workflow')
    } finally {
      setLoading(false)
    }
  }

  async function loadBadge() {
    const res = await api.get(`/api/notifications/compteur/${matricule}`).catch(() => ({ data: { non_lues: 0 } }))
    setBadgeCount(Number(res.data?.non_lues || 0))
  }

  async function loadNotifications() {
    setLoading(true)
    setError('')
    try {
      const [all, count] = await Promise.all([
        api.get(`/api/notifications/toutes/${matricule}`),
        api.get(`/api/notifications/compteur/${matricule}`)
      ])
      setNotifications(Array.isArray(all.data) ? all.data : [])
      setBadgeCount(Number(count.data?.non_lues || 0))
    } catch (e) {
      setError(e.response?.data?.detail || 'Erreur de chargement des notifications')
    } finally {
      setLoading(false)
    }
  }

  async function loadRemplacants() {
    setLoading(true)
    setError('')
    try {
      const res = await api.get(`/api/remplacants/mes-remplacements/${matricule}`).catch(() => ({ data: [] }))
      setMesRemplacements(Array.isArray(res.data) ? res.data : [])
    } catch (e) {
      setError(e.response?.data?.detail || 'Erreur de chargement des remplaçants')
    } finally {
      setLoading(false)
    }
  }

  async function loadEvaluations() {
    setLoading(true)
    setError('')
    try {
      const [ev, fiche] = await Promise.all([
        api.get(`/api/evaluations/mes-evaluations/${matricule}`).catch(() => ({ data: [] })),
        api.get(`/api/evaluations/fiche-poste/${matricule}`).catch(() => ({ data: null }))
      ])
      setEvaluations(Array.isArray(ev.data) ? ev.data : [])
      setFichePoste(fiche.data || null)
    } catch (e) {
      setError(e.response?.data?.detail || 'Erreur de chargement des évaluations')
    } finally {
      setLoading(false)
    }
  }

  async function loadEmploye() {
    try {
      console.log('Chargement employé:', matricule)
      const res = await api.get(`/employees/${matricule}`)
      console.log('Employé chargé:', res.data)
      setEmploye(res.data || {})
    } catch (e) {
      console.error('Erreur chargement employé:', e)
      setEmploye({ solde_conges: 0 })
    }
  }

  async function submitConge(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    try {
      const matriculeDemande = (peutCreerPourAutrui && matriculeCible)
        ? Number(matriculeCible)
        : matricule
      if (!matriculeDemande || Number.isNaN(matriculeDemande)) {
        setError('Matricule cible invalide')
        return
      }

      await api.post('/api/conges/demande', null, {
        params: {
          matricule: matriculeDemande,
          matricule_createur: matricule,
          date_debut: congeForm.date_debut,
          date_fin: congeForm.date_fin,
          motif: congeForm.motif || null
        }
      })
      setSuccess('Demande de congé soumise')
      setCongeForm({ date_debut: '', date_fin: '', motif: '' })
      loadAll()
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur création congé')
    }
  }

  async function submitPermission(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    try {
      const matriculeDemande = (peutCreerPourAutrui && matriculeCible)
        ? Number(matriculeCible)
        : matricule
      if (!matriculeDemande || Number.isNaN(matriculeDemande)) {
        setError('Matricule cible invalide')
        return
      }

      await api.post('/api/permissions/conventionnelle', null, {
        params: {
          matricule: matriculeDemande,
          matricule_createur: matricule,
          type_permission: permForm.type_permission,
          sous_type: permForm.sous_type || null,
          duree: Number(permForm.duree || 1),
          date_debut: permForm.date_debut,
          date_fin: permForm.date_fin,
          motif: permForm.motif || null
        }
      })
      setSuccess('Demande de permission conventionnelle soumise')
      setPermForm({ type_permission: 'maladie', sous_type: '', duree: 1, date_debut: '', date_fin: '', motif: '' })
      loadAll()
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur création permission')
    }
  }

  async function submitPermissionNonConventionnelle(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    try {
      const matriculeDemande = (peutCreerPourAutrui && matriculeCible)
        ? Number(matriculeCible)
        : matricule
      if (!matriculeDemande || Number.isNaN(matriculeDemande)) {
        setError('Matricule cible invalide')
        return
      }

      await api.post('/api/conges/demande', null, {
        params: {
          matricule: matriculeDemande,
          matricule_createur: matricule,
          date_debut: permNonConvForm.date_debut,
          date_fin: permNonConvForm.date_fin,
          motif: permNonConvForm.motif ? `Permission non-conventionnelle: ${permNonConvForm.motif}` : 'Permission non-conventionnelle'
        }
      })
      setSuccess('Demande de permission non-conventionnelle soumise (déduit du solde de congés)')
      setPermNonConvForm({ date_debut: '', date_fin: '', motif: '' })
      loadAll()
      loadEmploye()
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur création permission non-conventionnelle')
    }
  }

  // Fonctions pour gérer les missionnaires
  async function rechercherEmployes(term) {
    setRechercheEmploye(term)
    if (term.length < 2) {
      setEmployesTrouves([])
      return
    }
    try {
      const res = await api.get('/api/missions/rechercher-employes', {
        params: { q: term }
      })
      setEmployesTrouves(res.data.employes || [])
    } catch (err) {
      console.error('Erreur recherche employés:', err)
      setEmployesTrouves([])
    }
  }

  function ajouterMissionnaire(emp) {
    // Vérifier si le missionnaire n'est pas déjà ajouté
    if (!missionMissionnaires.find(m => m.matricule === emp.matricule)) {
      setMissionMissionnaires([...missionMissionnaires, emp])
    }
    // Réinitialiser la recherche
    setRechercheEmploye('')
    setEmployesTrouves([])
  }

  function retirerMissionnaire(mat) {
    setMissionMissionnaires(missionMissionnaires.filter(m => m.matricule !== mat))
  }

  async function submitMission(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!peutInitierMission) {
      setError('Initiation mission interdite pour votre rôle')
      return
    }
    
    // Valider que tous les segments sont remplis
    const segmentsInvalides = missionSegments.filter(seg => 
      !seg.pays || !seg.ville || !seg.date_debut || !seg.date_fin
    )
    if (segmentsInvalides.length > 0) {
      setError('Veuillez remplir tous les champs de chaque destination')
      return
    }
    
    // Valider qu'il y a au moins un missionnaire (l'utilisateur actuel par défaut)
    const matriculesMissionnaires = missionMissionnaires.length > 0 
      ? missionMissionnaires.map(m => m.matricule)
      : [matricule]  // Par défaut, si aucun missionnaire n'est ajouté, c'est l'utilisateur seul
    
    try {
      // Vérifier les chevauchements de dates
      const dateDebut = missionSegments.reduce((min, seg) => 
        !min || seg.date_debut < min ? seg.date_debut : min, null
      )
      const dateFin = missionSegments.reduce((max, seg) => 
        !max || seg.date_fin > max ? seg.date_fin : max, null
      )
      
      const checkResponse = await api.get(`/api/missions/verifier-chevauchement/${matricule}`, {
        params: {
          date_debut: dateDebut,
          date_fin: dateFin,
          id_operation_exclure: missionEditMode ? missionEditId : null
        }
      })
      
      if (checkResponse.data.conflit) {
        if (window.confirm(checkResponse.data.message + '. Voulez-vous continuer quand même ?')) {
          // L'utilisateur confirme malgré le conflit
        } else {
          return
        }
      }
      
      if (missionEditMode && missionEditId) {
        // Pour l'instant, l'édition reste avec l'ancien système
        // TODO: Implémenter l'édition multi-segments
        const premierSegment = missionSegments[0]
        await api.put(`/api/missions/${missionEditId}/modifier`, null, {
          params: {
            pays: premierSegment.pays,
            ville: premierSegment.ville,
            date_debut: premierSegment.date_debut,
            date_fin: premierSegment.date_fin,
            heure_depart: premierSegment.heure_depart,
            heure_arrivee: premierSegment.heure_arrivee,
            heure_retour: premierSegment.heure_depart,
            email: missionForm.email,
            motif: missionForm.motif || null,
            moyens_transport: missionForm.moyens_transport
          }
        })
        setSuccess('Mission modifiée avec succès!')
        setMissionEditMode(false)
        setMissionEditId(null)
      } else {
        // Créer la mission avec segments multiples et plusieurs missionnaires
        const missionData = {
          matricule,
          matricules_missionnaires: matriculesMissionnaires,
          email_contact: missionForm.email_contact || null,
          motif: missionForm.motif || null,
          segments: missionSegments.map(seg => ({
            pays: seg.pays,
            ville: seg.ville,
            date_debut: seg.date_debut,
            date_fin: seg.date_fin,
            heure_depart: seg.heure_depart,
            heure_arrivee: seg.heure_arrivee,
            heure_retour: seg.heure_retour,
            moyen_transport: seg.moyen_transport || 'aerien'
          }))
        }
        
        await api.post('/api/missions/creer-multi-segments', missionData)
        setSuccess(`Demande de mission soumise avec ${missionSegments.length} destination(s) et ${matriculesMissionnaires.length} missionnaire(s). Un email a été envoyé pour la demande de frais.`)
      }
      
      // Réinitialiser le formulaire
      setMissionForm({
        motif: '',
        email_contact: ''
      })
      setMissionSegments([{
        id: 1,
        pays: '',
        ville: '',
        date_debut: '',
        date_fin: '',
        heure_depart: '08:00:00',
        heure_arrivee: '18:00:00',
        heure_retour: '18:00:00',
        moyen_transport: 'aerien'
      }])
      setMissionMissionnaires([])
      setRechercheEmploye('')
      setEmployesTrouves([])
      loadAll()
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la soumission de la mission')
    }
  }

  function editMission(mission) {
    setMissionForm({
      motif: mission.motif || '',
      email: mission.email || '',
      moyens_transport: mission.moyens_transport || ['aerien']
    })
    setMissionSegments([{
      id: 1,
      pays: mission.pays || '',
      ville: mission.ville || '',
      date_debut: mission.date_debut ? mission.date_debut.split('T')[0] : '',
      date_fin: mission.date_fin ? mission.date_fin.split('T')[0] : '',
      heure_depart: mission.heure_depart || '08:00:00',
      heure_arrivee: mission.heure_arrivee || '18:00:00',
      heure_retour: mission.heure_retour || '18:00:00',
      moyen_transport: 'aerien'
    }])
    setMissionEditMode(true)
    setMissionEditId(mission.id_operation)
    setSuccess('')
    setError('')
  }

  function cancelEditMission() {
    setMissionEditMode(false)
    setMissionEditId(null)
    setMissionForm({
      motif: '',
      email_contact: ''
    })
    setMissionSegments([{
      id: 1,
      pays: '',
      ville: '',
      date_debut: '',
      date_fin: '',
      heure_depart: '08:00:00',
      heure_arrivee: '18:00:00',
      heure_retour: '18:00:00',
      moyen_transport: 'aerien'
    }])
    setSuccess('')
    setError('')
  }

  function ajouterSegmentMission() {
    const nouveauId = Math.max(...missionSegments.map(s => s.id), 0) + 1
    setMissionSegments([...missionSegments, {
      id: nouveauId,
      pays: '',
      ville: '',
      date_debut: '',
      date_fin: '',
      heure_depart: '08:00:00',
      heure_arrivee: '18:00:00',
      heure_retour: '18:00:00',
      moyen_transport: 'aerien'
    }])
  }

  function supprimerSegmentMission(id) {
    if (missionSegments.length <= 1) {
      alert('Au moins une destination est requise')
      return
    }
    setMissionSegments(missionSegments.filter(s => s.id !== id))
  }

  function updateSegmentMission(id, field, value) {
    setMissionSegments(missionSegments.map(seg => 
      seg.id === id ? { ...seg, [field]: value } : seg
    ))
  }

  async function annulerOperation(id_operation, e) {
    e.stopPropagation()
    if (!window.confirm(`Êtes-vous sûr de vouloir annuler l'opération #${id_operation} ?`)) {
      return
    }
    try {
      await api.delete(`/api/operations/${id_operation}`)
      setSuccess(`Opération #${id_operation} annulée avec succès`)
      setError('')
      await loadWorkflow()
      await loadDemandes()
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de l\'annulation')
      setSuccess('')
    }
  }

  function ouvrirModificationOperation(id_operation, e) {
    e.stopPropagation()
    setSelectedOperation(id_operation)
  }

  async function submitFrais(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!fraisForm.id_operation) {
      setError('Veuillez sélectionner une mission')
      return
    }
    try {
      await api.post(`/api/missions/${fraisForm.id_operation}/demande-frais`, null, {
        params: {
          matricule,
          frais_transport: fraisMissionCalculs.frais_transport_total,
          frais_hotel: fraisMissionCalculs.frais_hotel_total,
          frais_deplacement: fraisMissionCalculs.frais_deplacement_total,
          frais_nutrition: fraisMissionCalculs.frais_mission_total,
          justificatif: fraisForm.justificatif || null
        }
      })
      setSuccess('Demande de frais soumise avec succès')
      setFraisForm({
        id_operation: '',
        frais_transport_unitaire: 0,
        frais_hotel_unitaire: 0,
        frais_deplacement_unitaire: 0,
        frais_mission_unitaire: 0,
        justificatif: ''
      })
      loadAll()
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la demande de frais')
    }
  }

  async function loadMissionStatut(idOperation) {
    try {
      const res = await api.get(`/api/missions/${idOperation}/statut-mission`)
      setMissionStatuts(prev => ({ ...prev, [idOperation]: res.data }))
      return res.data
    } catch (e) {
      console.error('Erreur chargement statut mission:', e)
      return null
    }
  }

  useEffect(() => {
    // Charger le statut de toutes les missions
    if (missions.length > 0) {
      missions.forEach(async m => {
        if (m.id_operation) {
          loadMissionStatut(m.id_operation)
          // Charger aussi le statut de paiement des frais
          const statutPaiement = await loadStatutPaiementFrais(m.id_operation)
          if (statutPaiement) {
            setStatutsPaiementFrais(prev => ({ ...prev, [m.id_operation]: statutPaiement }))
          }
        }
      })
    }
  }, [missions])

  async function uploadRapport(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!rapportUpload.id_operation || !rapportUpload.file) {
      setError('Veuillez renseigner ID opération et fichier rapport')
      return
    }
    const fd = new FormData()
    fd.append('fichier', rapportUpload.file)
    try {
      await api.post(`/api/missions/${rapportUpload.id_operation}/televerser-rapport`, fd, {
        params: { matricule },
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setSuccess('Rapport téléversé')
      setRapportUpload({ id_operation: '', file: null })
      loadAll()
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur téléversement rapport')
    }
  }

  async function uploadPreuveFrais(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!preuveUpload.id_frais || !preuveUpload.file) {
      setError('Veuillez renseigner ID frais et fichier preuve')
      return
    }
    const fd = new FormData()
    fd.append('fichier', preuveUpload.file)
    try {
      await api.post(`/api/missions/frais/${preuveUpload.id_frais}/televerser-preuves`, fd, {
        params: { type_preuve: preuveUpload.type_preuve },
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setSuccess(`Preuve ${preuveUpload.type_preuve} téléversée avec succès!`)
      // Ajouter à la liste des preuves en cours
      setPreuvesFraisEnCours([...preuvesFraisEnCours, { type_preuve: preuveUpload.type_preuve, file: preuveUpload.file.name }])
      setPreuveUpload({ id_frais: '', type_preuve: 'facture', file: null })
      loadAll()
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur téléversement preuve')
    }
  }

  async function uploadPreuvePermission(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!permissionPreuveUpload.id_operation || permissionPreuveUpload.files.length === 0) {
      setError('Veuillez renseigner ID opération et sélectionner au moins un fichier')
      return
    }
    
    try {
      for (const file of permissionPreuveUpload.files) {
        const fd = new FormData()
        fd.append('fichier', file)
        await api.post(`/api/permissions/${permissionPreuveUpload.id_operation}/televerser-preuves`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        // Ajouter à la liste des preuves en cours
        setPrevuesPermissionEnCours([...prevuesPermissionEnCours, { filename: file.name }])
      }
      setSuccess(`${permissionPreuveUpload.files.length} preuve(s) de permission téléversée(s) avec succès!`)
      setPermissionPreuveUpload({ id_operation: '', files: [] })
      loadAll()
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur téléversement preuve permission')
    }
  }

  async function marquerLue(id) {
    await api.put(`/api/notifications/${id}/marquer-lue`).catch(() => null)
    loadNotifications()
  }

  async function marquerToutesLues() {
    await api.put(`/api/notifications/marquer-toutes-lues/${matricule}`).catch(() => null)
    loadNotifications()
  }

  async function rechercherPropositions() {
    if (!operationRecherche) return
    const res = await api.get(`/api/remplacants/propositions/${operationRecherche}`).catch(() => ({ data: [] }))
    setPropositions(Array.isArray(res.data) ? res.data : [])
  }

  async function accepterRemplacant(matriculeRemplacant) {
    await api.post(`/api/remplacants/${operationRecherche}/accepter/${matriculeRemplacant}`).catch(() => null)
    rechercherPropositions()
    loadRemplacants()
  }

  async function validerOperation(idOperation, statut, commentaire = null) {
    try {
      await api.post(`/api/workflow/valider/${idOperation}`, null, {
        params: { matricule_validateur: matricule, statut, commentaire }
      })
      await loadWorkflow()
      await loadAll()
      return true
    } catch (error) {
      if (error.response && error.response.data && error.response.data.detail) {
        alert(error.response.data.detail)
      } else {
        alert("Erreur lors de la validation")
      }
      return false
    }
  }

  async function validerFraisMissionnaire(idMission) {
    try {
      setError('')
      setSuccess('')
      await api.post(`/api/missions/${idMission}/valider-frais-missionnaire`, { matricule })
      setSuccess('Frais validés avec succès. En attente validation RH.')
      // Recharger le statut de la mission
      loadMissionStatut(idMission)
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la validation des frais')
    }
  }

  async function validerPaiementRH(idMission) {
    try {
      setError('')
      setSuccess('')
      await api.post(`/api/missions/${idMission}/valider-paiement-rh`, { matricule })
      setSuccess('Paiement validé avec succès.')
      // Recharger le statut de la mission
      loadMissionStatut(idMission)
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de la validation du paiement')
    }
  }

  async function loadStatutPaiementFrais(idMission) {
    try {
      const res = await api.get(`/api/missions/${idMission}/statut-paiement-frais`)
      return res.data
    } catch (err) {
      console.error('Erreur chargement statut paiement:', err)
      return null
    }
  }

  const workflowCols = useMemo(() => {
    const enAttente = mesDemandes.filter((d) => String(d.statut || '').toLowerCase().includes('attente'))
    const valides = mesDemandes.filter((d) => String(d.statut || '').toLowerCase().includes('valid'))
    const refuses = mesDemandes.filter((d) => String(d.statut || '').toLowerCase().includes('refus'))
    return { enAttente, valides, refuses }
  }, [mesDemandes])

  const selectedWorkflowData = useMemo(() => {
    if (!selectedOperation) return null

    const workflowItem = [...aValider, ...mesDemandes, ...mesValidations, ...mesRefus].find(
      (item) => String(item.id_operation) === String(selectedOperation)
    )
    const operationItem = operations.find((item) => String(item.id_operation) === String(selectedOperation))
    const congeItem = conges.find((item) => String(item.id_operation) === String(selectedOperation))
    const permissionItem = permissions.find((item) => String(item.id_operation) === String(selectedOperation))
    const missionItem = missions.find((item) => String(item.id_operation) === String(selectedOperation))

    const rawType = String(
      workflowItem?.type_demande || operationItem?.type_demande || missionItem?.type_demande || ''
    ).toLowerCase()

    const normalizedType = rawType.includes('mission')
      ? 'mission'
      : rawType.includes('permission')
      ? 'permission'
      : 'conge'

    const detailItem = normalizedType === 'mission'
      ? missionItem
      : normalizedType === 'permission'
      ? permissionItem
      : congeItem

    return { workflowItem, operationItem, detailItem, missionItem, normalizedType }
  }, [selectedOperation, aValider, mesDemandes, mesValidations, mesRefus, operations, conges, permissions, missions])

  const canValidateSelectedOperation = useMemo(
    () => estValidateur && aValider.some((item) => String(item.id_operation) === String(selectedOperation)),
    [estValidateur, aValider, selectedOperation]
  )

  const readonlyFormData = useMemo(() => {
    if (!selectedWorkflowData) return null

    const fmtDate = (value) => {
      if (!value) return ''
      const d = new Date(value)
      if (Number.isNaN(d.getTime())) return ''
      return d.toISOString().split('T')[0]
    }

    const { workflowItem, detailItem, missionItem, normalizedType } = selectedWorkflowData
    const op = selectedOperationDetails
    const details = op?.details || {}

    const common = {
      typeDemande: workflowItem?.type_demande || op?.type || 'Demande opération',
      demandeur: workflowItem?.demandeur?.nom_complet || '',
      dateDemande: fmtDate(workflowItem?.date_demande),
      dateDebut: fmtDate(workflowItem?.date_debut || detailItem?.date_debut || op?.date_depart),
      dateFin: fmtDate(workflowItem?.date_fin || detailItem?.date_fin || op?.date_retour),
      duree: workflowItem?.duree_jours || op?.duree || '',
      motif: detailItem?.motif || workflowItem?.motif || op?.commentaire || '',
    }

    if (normalizedType === 'mission') {
      return {
        ...common,
        type: 'mission',
        objet: missionItem?.motif || workflowItem?.motif || op?.commentaire || '',
        pays: missionItem?.pays || details?.pays || '',
        ville: missionItem?.ville || details?.ville || '',
        transport: missionItem?.moyen_transport || details?.transport || '',
        emailContact: missionItem?.email_contact || details?.email_mission || '',
        heureDepart: missionItem?.heure_depart || details?.heure_depart || '',
        heureRetour: missionItem?.heure_retour || details?.heure_retour || '',
      }
    }

    if (normalizedType === 'permission') {
      return {
        ...common,
        type: 'permission',
        typePermission: detailItem?.type_permission || detailItem?.type || workflowItem?.type_demande || 'Permission',
        sousType: detailItem?.sous_type || '',
      }
    }

    return {
      ...common,
      type: 'conge',
    }
  }, [selectedWorkflowData, selectedOperationDetails])

  const workflowDetailFields = useMemo(() => {
    if (!selectedWorkflowData) return []

    const { workflowItem, detailItem, missionItem, normalizedType } = selectedWorkflowData
    const formatDateValue = (value) => {
      if (!value) return 'Non renseignée'
      return new Date(value).toLocaleDateString('fr-FR')
    }

    const baseFields = [
      { label: 'Type de demande', value: workflowItem?.type_demande || 'Demande opération' },
      { label: 'Demandeur', value: workflowItem?.demandeur?.nom_complet || 'Non renseigné' },
      { label: 'Date de demande', value: formatDateValue(workflowItem?.date_demande) },
      {
        label: 'Période',
        value: `${formatDateValue(workflowItem?.date_debut || detailItem?.date_debut)} au ${formatDateValue(workflowItem?.date_fin || detailItem?.date_fin)}`,
      },
      { label: 'Durée', value: workflowItem?.duree_jours ? `${workflowItem.duree_jours} jour(s)` : 'Non renseignée' },
    ]

    if (normalizedType === 'mission') {
      return [
        ...baseFields,
        { label: 'Objet / titre', value: missionItem?.titre || missionItem?.objet || workflowItem?.motif || 'Non renseigné' },
        { label: 'Localisation', value: missionItem?.localisation || missionItem?.ville || missionItem?.pays || 'Non renseignée' },
        { label: 'Motif', value: missionItem?.motif || workflowItem?.motif || 'Non renseigné' },
      ]
    }

    if (normalizedType === 'permission') {
      return [
        ...baseFields,
        { label: 'Type de permission', value: detailItem?.type_permission || detailItem?.type || 'Permission' },
        { label: 'Sous-type', value: detailItem?.sous_type || 'Non renseigné' },
        { label: 'Motif', value: detailItem?.motif || workflowItem?.motif || 'Non renseigné' },
      ]
    }

    return [
      ...baseFields,
      { label: 'Motif', value: detailItem?.motif || workflowItem?.motif || 'Non renseigné' },
      { label: 'Statut', value: detailItem?.statut || workflowItem?.statut || 'En attente' },
    ]
  }, [selectedWorkflowData])

  async function soumettreDecisionWorkflow(statut) {
    if (!selectedOperation) return
    const commentaire = statut === 'refusé' ? workflowDecisionComment.trim() : (workflowDecisionComment.trim() || null)
    if (statut === 'refusé' && !commentaire) {
      alert('Le motif de refus est obligatoire')
      return
    }

    const ok = await validerOperation(selectedOperation, statut, commentaire)
    if (ok) {
      setWorkflowDecisionComment('')
      setSelectedOperation(null)
    }
  }

  return (
    <div className="operations-container">
      <div className="operations-header">
        <h1 style={{display:'flex',alignItems:'center',gap:8}}><Target size={20}/> Opérations & Workflow</h1>
        <p>Formulaires demandes • Workflow • Remplaçants • Évaluations • Notifications</p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="tabs-navigation">
        <button className={`tab-btn ${activeTab === 'accueil' ? 'active' : ''}`} onClick={() => setActiveTab('accueil')} style={{display:'inline-flex',alignItems:'center',gap:5}}>
          <Home size={14}/> Accueil
        </button>
        <button className={`tab-btn ${activeTab === 'demandes' ? 'active' : ''}`} onClick={() => setActiveTab('demandes')} style={{display:'inline-flex',alignItems:'center',gap:5}}>
          <FileText size={14}/> Demandes
        </button>
        <button className={`tab-btn ${activeTab === 'workflow' ? 'active' : ''}`} onClick={() => setActiveTab('workflow')} style={{display:'inline-flex',alignItems:'center',gap:5}}>
          <BarChart2 size={14}/> Workflow
        </button>
        <button className={`tab-btn ${activeTab === 'remplacants' ? 'active' : ''}`} onClick={() => setActiveTab('remplacants')} style={{display:'inline-flex',alignItems:'center',gap:5}}>
          <Users size={14}/> Remplaçants
        </button>
      </div>

      <div className="tab-content">
        {loading && <div className="spinner">Chargement...</div>}

        {activeTab === 'accueil' && !loading && (
          <div className="tab-pane">
            <div className="tab-header">
              <h2>Bienvenue dans Opérations</h2>
            </div>

            <div className="form-card" style={{padding: '15px', marginBottom: '12px'}}>
              <h3 style={{fontSize: '1rem', marginBottom: '8px', display:'flex', alignItems:'center', gap:6}}><Home size={14}/> Onglet Accueil</h3>
              <p style={{fontSize: '0.9rem', margin: 0}}>
                Cette vue présente un résumé rapide de l'espace Opérations et vous aide à naviguer vers les modules adaptés à votre besoin.
              </p>
            </div>

            <div className="form-card" style={{padding: '15px', marginBottom: '12px'}}>
              <h3 style={{fontSize: '1rem', marginBottom: '8px', display:'flex', alignItems:'center', gap:6}}><FileText size={14}/> Onglet Demandes</h3>
              <p style={{fontSize: '0.9rem', margin: 0}}>
                Créez vos demandes de congé, permission, mission et frais de mission, puis téléversez les documents justificatifs.
              </p>
            </div>

            <div className="form-card" style={{padding: '15px', marginBottom: '12px'}}>
              <h3 style={{fontSize: '1rem', marginBottom: '8px', display:'flex', alignItems:'center', gap:6}}><BarChart2 size={14}/> Onglet Workflow</h3>
              <p style={{fontSize: '0.9rem', margin: 0}}>
                Suivez l'état de vos demandes dans un Kanban, consultez les validations en attente et traitez les actions de validation.
              </p>
            </div>

            <div className="form-card" style={{padding: '15px', marginBottom: '12px'}}>
              <h3 style={{fontSize: '1rem', marginBottom: '8px', display:'flex', alignItems:'center', gap:6}}><Users size={14}/> Onglet Remplaçants</h3>
              <p style={{fontSize: '0.9rem', margin: 0}}>
                Recherchez les propositions de remplaçants par opération et gérez les remplacements acceptés.
              </p>
            </div>

            <div className="form-card" style={{padding: '15px', marginBottom: '12px'}}>
              <h3 style={{fontSize: '1rem', marginBottom: '8px', display:'flex', alignItems:'center', gap:6}}><ClipboardList size={14}/> Mes opérations initiées ({mesDemandes.length})</h3>
              <div style={{display:'grid', gap:6}}>
                {mesDemandes.slice(0, 8).map((d) => (
                  <div key={`op-${d.id_operation}`} style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #e5e7eb', paddingBottom:4}}>
                    <span style={{fontSize:'0.84rem'}}>#{d.id_operation} - {d.type_demande}</span>
                    <span style={{fontSize:'0.78rem', color:'#475569'}}>{d.statut}</span>
                  </div>
                ))}
                {mesDemandes.length === 0 && <div style={{fontSize:'0.82rem', color:'#64748b'}}>Aucune opération initiée.</div>}
              </div>
            </div>

            <div className="form-card" style={{padding: '15px', marginBottom: '12px'}}>
              <h3 style={{fontSize: '1rem', marginBottom: '8px', display:'flex', alignItems:'center', gap:6}}><BarChart2 size={14}/> Mes frais de mission initiés</h3>
              <div style={{display:'grid', gap:6}}>
                {mesDemandes.filter((d) => String(d.type_demande || '').toLowerCase().includes('frais')).slice(0, 8).map((d) => (
                  <div key={`frais-${d.id_operation}`} style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #e5e7eb', paddingBottom:4}}>
                    <span style={{fontSize:'0.84rem'}}>#{d.id_operation}</span>
                    <span style={{fontSize:'0.78rem', color:'#475569'}}>{d.statut}</span>
                  </div>
                ))}
                {mesDemandes.filter((d) => String(d.type_demande || '').toLowerCase().includes('frais')).length === 0 && (
                  <div style={{fontSize:'0.82rem', color:'#64748b'}}>Aucune demande de frais initiée.</div>
                )}
              </div>
            </div>

            <div className="form-card" style={{ textAlign: 'center', padding: '15px' }}>
              <button className="btn btn-primary" onClick={() => setActiveTab('demandes')}>
                Aller à Demandes
              </button>
            </div>
          </div>
        )}

        {activeTab === 'demandes' && !loading && (
          <div className="tab-pane">
            <div className="tab-header">
              <h2>Formulaires demandes (Congés, Permissions, Missions, Frais de mission)</h2>
            </div>

            {/* Solde Congés */}
            <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '20px', borderRadius: '12px', marginBottom: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '5px' }}>Votre solde de congés</div>
                  <div style={{ fontSize: '36px', fontWeight: 'bold' }}>{employe?.solde_conges ?? 0} jours</div>
                </div>
                  <div style={{ opacity: 0.3, display: 'flex', alignItems: 'center' }}><Calendar size={44} /></div>
              </div>
            </div>

            <div className="sub-tabs">
              <button className={`btn ${demandeType === 'conges' ? 'btn-primary' : ''}`} onClick={() => setDemandeType('conges')}>Congé</button>
              <button className={`btn ${demandeType === 'permissions' ? 'btn-primary' : ''}`} onClick={() => setDemandeType('permissions')}>Permission</button>
              <button className={`btn ${demandeType === 'missions' ? 'btn-primary' : ''}`} onClick={() => setDemandeType('missions')}>Mission</button>
              <button className={`btn ${demandeType === 'frais' ? 'btn-primary' : ''}`} onClick={() => setDemandeType('frais')}>Frais de mission</button>
            </div>

            {demandeType === 'conges' && (
              <form className="form-card" onSubmit={submitConge}>
                <h3>Demande de congé</h3>
                {peutCreerPourAutrui && (
                  <div className="form-group">
                    <label>Matricule cible (optionnel)</label>
                    <input
                      type="number"
                      value={matriculeCible}
                      onChange={(e) => setMatriculeCible(e.target.value)}
                      placeholder="Laisser vide pour moi-même"
                    />
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label>Date début</label>
                    <input type="date" value={congeForm.date_debut} onChange={(e) => setCongeForm({ ...congeForm, date_debut: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Date fin</label>
                    <input type="date" value={congeForm.date_fin} onChange={(e) => setCongeForm({ ...congeForm, date_fin: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Durée (jours)</label>
                    <input type="number" value={congeForm.date_debut && congeForm.date_fin ? Math.ceil((new Date(congeForm.date_fin) - new Date(congeForm.date_debut)) / (1000 * 60 * 60 * 24)) + 1 : 0} readOnly />
                  </div>
                </div>
                <div className="form-group">
                  <label>Motif</label>
                  <textarea value={congeForm.motif} onChange={(e) => setCongeForm({ ...congeForm, motif: e.target.value })} />
                </div>
                <button className="btn btn-success" type="submit">Soumettre</button>
              </form>
            )}

            {demandeType === 'permissions' && (
              <>
                {/* Sous-onglets permission */}
                <div style={{display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px'}}>
                  <button 
                    className={`btn ${permissionType === 'conventionnelle' ? 'btn-primary' : ''}`}
                    onClick={() => setPermissionType('conventionnelle')}
                    style={{minWidth: '150px', display:'inline-flex', alignItems:'center', gap:5}}
                  >
                    <ClipboardList size={13}/> Conventionnelle
                  </button>
                  <button 
                    className={`btn ${permissionType === 'non-conventionnelle' ? 'btn-primary' : ''}`}
                    onClick={() => setPermissionType('non-conventionnelle')}
                    style={{minWidth: '150px', display:'inline-flex', alignItems:'center', gap:5}}
                  >
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
                          <input
                            type="number"
                            value={matriculeCible}
                            onChange={(e) => setMatriculeCible(e.target.value)}
                            placeholder="Laisser vide pour moi-même"
                          />
                        </div>
                      )}
                      <div className="form-row">
                        <div className="form-group">
                          <label>Type de permission</label>
                          <select 
                            value={permForm.type_permission} 
                            onChange={(e) => setPermForm({ ...permForm, type_permission: e.target.value, sous_type: '', date_fin: '', duree: 1 })}
                            required
                          >
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
                            <input 
                              list="sous-types-list" 
                              value={permForm.sous_type} 
                              onChange={(e) => setPermForm({ ...permForm, sous_type: e.target.value })} 
                              placeholder="Sélectionnez ou saisissez..."
                              required
                            />
                            <datalist id="sous-types-list">
                              {sousTypesDisponibles.map(st => (
                                <option key={st.value} value={st.value}>{st.label} - {st.duree} jour{st.duree > 1 ? 's' : ''}</option>
                              ))}
                            </datalist>
                          </div>
                        </div>
                      )}

                      {sousTypesDisponibles.length > 0 && permForm.sous_type && (
                        <div style={{background: '#dbeafe', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '0.9rem'}}>
                          <strong style={{display:'inline-flex',alignItems:'center',gap:5}}><ClipboardList size={13}/> Durée automatique:</strong> {
                            (() => {
                              const st = sousTypesDisponibles.find(s => s.value === permForm.sous_type)
                              return st ? `${st.duree} jour${st.duree > 1 ? 's' : ''} selon la convention collective` : ''
                            })()
                          }
                        </div>
                      )}

                      <div className="form-row">
                        <div className="form-group">
                          <label>Date début</label>
                          <input type="date" value={permForm.date_debut} onChange={(e) => setPermForm({ ...permForm, date_debut: e.target.value })} required />
                        </div>
                        <div className="form-group">
                          <label>Date fin {sousTypesDisponibles.length > 0 && permForm.sous_type ? '(calculée automatiquement)' : ''}</label>
                          <input 
                            type="date" 
                            value={permForm.date_fin} 
                            onChange={(e) => setPermForm({ ...permForm, date_fin: e.target.value })} 
                            readOnly={sousTypesDisponibles.length > 0 && permForm.sous_type}
                            required 
                            style={sousTypesDisponibles.length > 0 && permForm.sous_type ? {background: '#f3f4f6', cursor: 'not-allowed'} : {}}
                          />
                        </div>
                        <div className="form-group">
                          <label>Durée (jours)</label>
                          <input 
                            type="number" 
                            value={permForm.date_debut && permForm.date_fin ? Math.ceil((new Date(permForm.date_fin) - new Date(permForm.date_debut)) / (1000 * 60 * 60 * 24)) + 1 : (permForm.duree || 0)} 
                            readOnly 
                            style={{background: '#f3f4f6', cursor: 'not-allowed'}}
                          />
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
                          <select
                            value={permissionPreuveUpload.id_operation}
                            onChange={(e) => {
                              const idOperation = e.target.value
                              const permissionSelectionnee = permissionsEligibles.find(
                                p => String(p.id_operation) === String(idOperation)
                              )
                              setPermissionPreuveUpload({ ...permissionPreuveUpload, id_operation: idOperation })
                              setTypePermissionDocuments(infererTypePermissionDepuisPermission(permissionSelectionnee))
                              setVoirTousDocuments(false)
                            }}
                            required
                          >
                            <option value="">-- Choisir une permission --</option>
                            {permissionsEligibles.map(p => (
                              <option key={p.id_operation} value={p.id_operation}>
                                ID {p.id_operation} - {p.type_permission} ({new Date(p.date_debut).toLocaleDateString('fr-FR')} au {new Date(p.date_fin).toLocaleDateString('fr-FR')})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      
                      {/* Info sur les documents requis selon le type */}
                      <div style={{background: '#e0f2fe', padding: '12px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #0ea5e9'}}>
                        <p style={{margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: 'bold', color: '#0c4a6e', display:'flex', alignItems:'center', gap:5}}>
                          <FileText size={13}/> ARTICLE 7 - Documents requis
                        </p>

                        <div className="form-group" style={{marginBottom: '12px'}}>
                          <label style={{fontSize: '0.85rem', color: '#075985'}}>Type de document à afficher</label>
                          <select
                            value={voirTousDocuments ? '__all__' : (typePermissionDocuments || '')}
                            onChange={(e) => {
                              const valeur = e.target.value
                              if (valeur === '__all__') {
                                setVoirTousDocuments(true)
                              } else {
                                setTypePermissionDocuments(valeur)
                                setVoirTousDocuments(false)
                              }
                            }}
                          >
                            <option value="__all__">Tous les types</option>
                            <option value="mariage">Mariage</option>
                            <option value="accouchement">Accouchement</option>
                            <option value="bapteme">Baptême</option>
                            <option value="deces">Décès</option>
                            <option value="maternelle">Maternité</option>
                          </select>
                        </div>
                        
                        {(() => {
                          const typePermissionNormalise = typePermissionDocuments
                          
                          // Afficher selon le type sélectionné ou tous si voirTousDocuments est true
                          if (typePermissionNormalise && !voirTousDocuments && DOCUMENTS_REQUIS[typePermissionNormalise]) {
                            const info = DOCUMENTS_REQUIS[typePermissionNormalise]
                            return (
                              <>
                                <div style={{background: '#fff', padding: '10px', borderRadius: '6px', marginBottom: '10px'}}>
                                  <p style={{margin: '0 0 8px 0', fontSize: '0.85rem', fontWeight: 'bold', color: '#0369a1', display:'flex', alignItems:'center', gap:4}}>
                                    <Pin size={12}/> {info.titre}
                                  </p>
                                  <ul style={{margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: '#0c4a6e', lineHeight: '1.6'}}>
                                    {info.documents.map((doc, idx) => (
                                      <li key={idx}>
                                        <strong>{doc.label}:</strong> {doc.doc}
                                      </li>
                                    ))}
                                  </ul>
                                  <p style={{margin: '8px 0 0 0', fontSize: '0.75rem', color: '#075985', fontStyle: 'italic'}}>
                                    <Clock size={12} style={{verticalAlign:'middle', marginRight:4}}/> Délai de demande: {info.delai}
                                  </p>
                                </div>
                                <button 
                                  type="button"
                                  onClick={() => setVoirTousDocuments(true)}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#0284c7',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    padding: 0,
                                    marginTop: '5px'
                                  }}
                                >
                                  <ClipboardList size={12} style={{verticalAlign:'middle', marginRight:3}}/> Voir tous les types de permissions
                                </button>
                              </>
                            )
                          } else {
                            // Afficher tous les types
                            return (
                              <>
                                {Object.entries(DOCUMENTS_REQUIS).map(([type, info]) => (
                                  <div key={type} style={{background: '#fff', padding: '10px', borderRadius: '6px', marginBottom: '8px'}}>
                                    <p style={{margin: '0 0 5px 0', fontSize: '0.8rem', fontWeight: 'bold', color: '#0369a1'}}>
                                      {info.titre}
                                    </p>
                                    <ul style={{margin: 0, paddingLeft: '20px', fontSize: '0.8rem', color: '#0c4a6e', lineHeight: '1.5'}}>
                                      {info.documents.map((doc, idx) => (
                                        <li key={idx}>
                                          <strong>{doc.label}:</strong> {doc.doc}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                                {typePermissionNormalise && voirTousDocuments && (
                                  <button 
                                    type="button"
                                    onClick={() => setVoirTousDocuments(false)}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      color: '#0284c7',
                                      fontSize: '0.8rem',
                                      cursor: 'pointer',
                                      textDecoration: 'underline',
                                      padding: 0,
                                      marginTop: '5px'
                                    }}
                                  >
                                    <Pin size={12} style={{verticalAlign:'middle', marginRight:3}}/> Voir uniquement mon type sélectionné
                                  </button>
                                )}
                              </>
                            )
                          }
                        })()}
                        
                        <p style={{margin: '12px 0 0 0', fontSize: '0.75rem', color: '#075985', fontStyle: 'italic', paddingTop: '10px', borderTop: '1px solid #bae6fd'}}>
                          <strong style={{display:'inline-flex',alignItems:'center',gap:4}}><Calendar size={12}/> Délais généraux:</strong> Documents à fournir dans les 60 jours (Article 7). 
                          Limite annuelle: 12 jours par année calendaire (hors maternité).
                        </p>
                      </div>
                      
                      {permissionsEligibles.length > 0 ? (
                        <>
                          <div className="form-group">
                            <label>Fichiers preuve (sélectionnez un ou plusieurs fichiers)</label>
                            <input type="file" multiple onChange={(e) => setPermissionPreuveUpload({ ...permissionPreuveUpload, files: Array.from(e.target.files || []) })} required />
                            {permissionPreuveUpload.files.length > 0 && (
                              <p style={{fontSize: '0.85rem', color: '#666', marginTop: '5px'}}>
                                {permissionPreuveUpload.files.length} fichier(s) sélectionné(s)
                              </p>
                            )}
                          </div>
                          <button className="btn btn-primary" type="submit" disabled={permissionPreuveUpload.files.length === 0}>
                            Téléverser {permissionPreuveUpload.files.length > 0 ? `${permissionPreuveUpload.files.length} fichier(s)` : "preuves"}
                          </button>

                          {prevuesPermissionEnCours.length > 0 && (
                            <div className="form-card" style={{background: '#d1e7dd', marginTop: '20px'}}>
                              <h3 style={{display:'flex',alignItems:'center',gap:6}}><CheckCircle size={14}/> Preuves téléversées ({prevuesPermissionEnCours.length})</h3>
                              <ul style={{margin: '10px 0', paddingLeft: '20px'}}>
                                {prevuesPermissionEnCours.map((p, idx) => (
                                  <li key={idx} style={{marginBottom: '5px'}}>
                                    <strong>{p.filename}</strong>
                                  </li>
                                ))}
                              </ul>
                              <button className="btn btn-info" onClick={() => {
                                setPermissionPreuveUpload({ id_operation: permissionPreuveUpload.id_operation, files: [] })
                                setSuccess('')
                              }} style={{marginTop: '10px'}}>
                                + Téléverser d'autres preuves
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <div style={{background: '#e0e7ff', padding: '20px', borderRadius: '8px', textAlign: 'center'}}>
                          <p style={{margin: 0, color: '#3730a3', fontSize: '0.95rem', display:'flex', alignItems:'center', gap:6}}>
                            <Search size={13}/> Aucune permission validée et activée disponible pour le téléversement de preuve.
                          </p>
                        </div>
                      )}
                    </form>
                  </>
                )}

                {permissionType === 'non-conventionnelle' && (
                  <>
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
                          <input
                            type="number"
                            value={matriculeCible}
                            onChange={(e) => setMatriculeCible(e.target.value)}
                            placeholder="Laisser vide pour moi-même"
                          />
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
                  </>
                )}
              </>
            )}

            {demandeType === 'missions' && (
              <>
                <form className="form-card" onSubmit={submitMission}>
                  <h3>{missionEditMode ? 'Modifier la mission' : 'Demande de mission multi-destinations'}</h3>
                  {missionEditMode && (
                    <div style={{background: '#fff3cd', padding: '10px', borderRadius: '6px', marginBottom: '15px', border: '1px solid #ffc107', display:'flex', alignItems:'center', gap:6}}>
                      <AlertTriangle size={13} color="#856404"/> Vous modifiez la mission ID #{missionEditId}
                    </div>
                  )}
                  
                  {/* Informations générales de la mission */}
                  <div style={{background: '#f0f9ff', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #0ea5e9'}}>
                    <h4 style={{marginTop: 0, color: '#0369a1', display:'flex', alignItems:'center', gap:6}}><ClipboardList size={14}/> Informations générales</h4>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Email de contact pour cette mission</label>
                        <input type="email" value={missionForm.email_contact} onChange={(e) => setMissionForm({ ...missionForm, email_contact: e.target.value })} placeholder="email@exemple.com" />
                      </div>
                      <div className="form-group">
                        <label>Motif / Objet de la mission</label>
                        <input value={missionForm.motif} onChange={(e) => setMissionForm({ ...missionForm, motif: e.target.value })} placeholder="Ex: Formation, Réunion, Audit..." />
                      </div>
                    </div>
                  </div>

                  {/* Section Missionnaires */}
                  <div style={{background: '#f0fdf4', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #22c55e'}}>
                    <h4 style={{marginTop: 0, color: '#15803d', display:'flex', alignItems:'center', gap:6}}><Users size={14}/> Missionnaires ({missionMissionnaires.length})</h4>
                    
                    {/* Recherche d'employés */}
                    <div className="form-group" style={{position: 'relative'}}>
                      <label>Rechercher un missionnaire</label>
                      <input 
                        type="text"
                        value={rechercheEmploye}
                        onChange={(e) => rechercherEmployes(e.target.value)}
                        placeholder="Nom, prénom ou matricule..."
                        style={{width: '100%'}}
                      />
                      
                      {/* Résultats de recherche */}
                      {employesTrouves.length > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          background: 'white',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                          maxHeight: '200px',
                          overflowY: 'auto',
                          zIndex: 1000,
                          marginTop: '4px'
                        }}>
                          {employesTrouves.map(emp => (
                            <div 
                              key={emp.matricule}
                              onClick={() => ajouterMissionnaire(emp)}
                              style={{
                                padding: '10px',
                                cursor: 'pointer',
                                borderBottom: '1px solid #f3f4f6',
                                transition: 'background 0.2s'
                              }}
                              onMouseEnter={(e) => e.target.style.background = '#f9fafb'}
                              onMouseLeave={(e) => e.target.style.background = 'white'}
                            >
                              <div style={{fontWeight: '500', color: '#111827'}}>{emp.nom_complet}</div>
                              <div style={{fontSize: '0.85rem', color: '#6b7280'}}>
                                {emp.fonction} - Matricule: {emp.matricule}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Liste des missionnaires sélectionnés */}
                    {missionMissionnaires.length > 0 && (
                      <div style={{marginTop: '15px'}}>
                        <label style={{display: 'block', marginBottom: '8px', fontWeight: '500'}}>
                          Missionnaires sélectionnés ({missionMissionnaires.length})
                        </label>
                        <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px'}}>
                          {missionMissionnaires.map(m => (
                            <div 
                              key={m.matricule}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: '#dcfce7',
                                border: '1px solid #22c55e',
                                borderRadius: '20px',
                                padding: '6px 12px',
                                fontSize: '0.9rem'
                              }}
                            >
                              <span style={{color: '#15803d', fontWeight: '500'}}>
                                {m.nom_complet}
                              </span>
                              <button 
                                type="button"
                                onClick={() => retirerMissionnaire(m.matricule)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#dc2626',
                                  cursor: 'pointer',
                                  fontSize: '1.1rem',
                                  padding: '0',
                                  width: '20px',
                                  height: '20px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: '50%',
                                  transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => e.target.style.background = '#fee2e2'}
                                onMouseLeave={(e) => e.target.style.background = 'transparent'}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {missionMissionnaires.length === 0 && (
                      <p style={{
                        color: '#6b7280',
                        fontSize: '0.9rem',
                        margin: '10px 0 0 0',
                        fontStyle: 'italic'
                      }}>
                        ℹ️ Si aucun missionnaire n'est ajouté, seul l'initiateur de la demande (vous) sera assigné à cette mission.
                      </p>
                    )}
                  </div>

                  {/* Segments de mission */}
                  <div style={{marginBottom: '20px'}}>
                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px'}}>
                      <h4 style={{margin: 0, display:'flex',alignItems:'center',gap:6}}>Destinations ({missionSegments.length})</h4>
                      <button 
                        type="button" 
                        className="btn btn-primary" 
                        onClick={ajouterSegmentMission}
                        style={{fontSize: '0.9rem', padding: '8px 16px', display:'inline-flex', alignItems:'center', gap:5}}
                      >
                        <Plus size={13}/> Ajouter une destination
                      </button>
                    </div>

                    {missionSegments.map((segment, index) => (
                      <div key={segment.id} style={{background: '#f9fafb', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '2px solid #e5e7eb', position: 'relative'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                          <h5 style={{margin: 0, color: '#374151'}}>Destination {index + 1}</h5>
                          {missionSegments.length > 1 && (
                            <button 
                              type="button" 
                              onClick={() => supprimerSegmentMission(segment.id)}
                            style={{background: '#ef4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', display:'inline-flex', alignItems:'center', gap:4}}
                            >
                              <Trash2 size={12}/> Supprimer
                            </button>
                          )}
                        </div>
                        
                        <div className="form-row">
                          <div className="form-group">
                            <label>Pays</label>
                            <input 
                              value={segment.pays} 
                              onChange={(e) => updateSegmentMission(segment.id, 'pays', e.target.value)} 
                              required 
                              placeholder="Ex: Cameroun"
                            />
                          </div>
                          <div className="form-group">
                            <label>Ville</label>
                            <input 
                              value={segment.ville} 
                              onChange={(e) => updateSegmentMission(segment.id, 'ville', e.target.value)} 
                              required 
                              placeholder="Ex: Douala"
                            />
                          </div>
                        </div>
                        
                        <div className="form-row">
                          <div className="form-group">
                            <label>Date début</label>
                            <input 
                              type="date" 
                              value={segment.date_debut} 
                              onChange={(e) => updateSegmentMission(segment.id, 'date_debut', e.target.value)} 
                              required 
                            />
                          </div>
                          <div className="form-group">
                            <label>Date fin</label>
                            <input 
                              type="date" 
                              value={segment.date_fin} 
                              onChange={(e) => updateSegmentMission(segment.id, 'date_fin', e.target.value)} 
                              required 
                            />
                          </div>
                          <div className="form-group">
                            <label>Durée</label>
                            <input 
                              type="text" 
                              value={segment.date_debut && segment.date_fin ? `${Math.ceil((new Date(segment.date_fin) - new Date(segment.date_debut)) / (1000 * 60 * 60 * 24)) + 1} jours` : '-'} 
                              readOnly 
                              style={{background: '#e5e7eb'}}
                            />
                          </div>
                        </div>
                        
                        <div className="form-row">
                          <div className="form-group">
                            <label>Heure départ</label>
                            <input 
                              type="time" 
                              value={segment.heure_depart.slice(0, 5)} 
                              onChange={(e) => updateSegmentMission(segment.id, 'heure_depart', `${e.target.value}:00`)} 
                            />
                          </div>
                          <div className="form-group">
                            <label>Heure arrivée</label>
                            <input 
                              type="time" 
                              value={segment.heure_arrivee.slice(0, 5)} 
                              onChange={(e) => updateSegmentMission(segment.id, 'heure_arrivee', `${e.target.value}:00`)} 
                            />
                          </div>
                          <div className="form-group">
                            <label>Heure retour</label>
                            <input 
                              type="time" 
                              value={segment.heure_retour ? segment.heure_retour.slice(0, 5) : '18:00'} 
                              onChange={(e) => updateSegmentMission(segment.id, 'heure_retour', `${e.target.value}:00`)} 
                            />
                          </div>
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label>Moyen de transport</label>
                            <select 
                              value={segment.moyen_transport || 'aerien'} 
                              onChange={(e) => updateSegmentMission(segment.id, 'moyen_transport', e.target.value)}
                            >
                              <option value="aerien">Aérien</option>
                              <option value="routier">Routier</option>
                              <option value="ferroviaire">Ferroviaire</option>
                              <option value="maritime">Maritime</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{background: '#e0f2fe', padding: '12px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #0ea5e9'}}>
                    <p style={{margin: 0, fontSize: '0.9rem', color: '#0369a1'}}>
                      <strong style={{display:'inline-flex',alignItems:'center',gap:5}}><FileText size={13}/> Note:</strong> Un email sera envoyé à l'adresse indiquée pour effectuer la demande de frais de mission. Les frais seront à saisir séparément dans la section "Frais de mission".
                    </p>
                  </div>
                  
                  <div style={{display: 'flex', gap: '10px'}}>
                    <button className="btn btn-success" type="submit">
                      {missionEditMode ? 'Enregistrer les modifications' : `Soumettre (${missionSegments.length} destination${missionSegments.length > 1 ? 's' : ''})`}
                    </button>
                    {missionEditMode && (
                      <button className="btn" type="button" onClick={cancelEditMission} style={{background: '#6c757d', color: 'white'}}>
                        Annuler
                      </button>
                    )}
                  </div>
                </form>

                {/* Liste des missions modifiables */}
                {missions.filter(m => m.matricule === matricule && !missionStatuts[m.id_operation]?.statut_cloture).length > 0 && (
                  <div className="form-card">
                    <h3>Mes missions modifiables</h3>
                    <div style={{background: '#e0f2fe', padding: '10px', borderRadius: '6px', marginBottom: '15px', border: '1px solid #0ea5e9', fontSize: '0.9rem'}}>
                      ℹ️ Vous pouvez modifier vos missions tant qu'elles ne sont pas clôturées
                    </div>
                    <table style={{width: '100%', borderCollapse: 'collapse'}}>
                      <thead>
                        <tr style={{borderBottom: '2px solid #e5e7eb'}}>
                          <th style={{padding: '10px', textAlign: 'left'}}>ID</th>
                          <th style={{padding: '10px', textAlign: 'left'}}>Destination</th>
                          <th style={{padding: '10px', textAlign: 'left'}}>Dates</th>
                          <th style={{padding: '10px', textAlign: 'left'}}>Statut</th>
                          <th style={{padding: '10px', textAlign: 'left'}}>Paiement frais</th>
                          <th style={{padding: '10px', textAlign: 'center'}}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {missions.filter(m => m.matricule === matricule && !missionStatuts[m.id_operation]?.statut_cloture).map(mission => {
                          const statutPaiement = statutsPaiementFrais[mission.id_operation] || {}
                          const estRH = employe && employe.fonction && employe.fonction.toUpperCase().includes('RH')
                          
                          return (
                          <tr key={mission.id_operation} style={{borderBottom: '1px solid #e5e7eb'}}>
                            <td style={{padding: '10px'}}>#{mission.id_operation}</td>
                            <td style={{padding: '10px'}}>{mission.pays}, {mission.ville}</td>
                            <td style={{padding: '10px'}}>
                              {new Date(mission.date_debut).toLocaleDateString('fr-FR')} → {new Date(mission.date_fin).toLocaleDateString('fr-FR')}
                            </td>
                            <td style={{padding: '10px'}}>
                              <span style={{
                                padding: '4px 8px', 
                                borderRadius: '4px', 
                                fontSize: '0.85rem',
                                background: mission.statut === 'EN_ATTENTE' ? '#fef3c7' : mission.statut === 'VALIDE' ? '#d1fae5' : '#fee2e2',
                                color: mission.statut === 'EN_ATTENTE' ? '#92400e' : mission.statut === 'VALIDE' ? '#065f46' : '#991b1b'
                              }}>
                                {mission.statut || 'EN_ATTENTE'}
                              </span>
                            </td>
                            <td style={{padding: '10px'}}>
                              {statutPaiement.frais_payes ? (
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '0.85rem',
                                  background: '#d1fae5',
                                  color: '#065f46',
                                  display: 'inline-block'
                                }}>
                                  Payé
                                </span>
                              ) : statutPaiement.frais_valides_rh ? (
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '0.85rem',
                                  background: '#dbeafe',
                                  color: '#1e40af',
                                  display: 'inline-block'
                                }}>
                                  Validation RH OK
                                </span>
                              ) : statutPaiement.frais_valides_missionnaire ? (
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '0.85rem',
                                  background: '#fef3c7',
                                  color: '#92400e',
                                  display: 'inline-block'
                                }}>
                                  En attente RH
                                </span>
                              ) : (
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '0.85rem',
                                  background: '#fee2e2',
                                  color: '#991b1b',
                                  display: 'inline-block'
                                }}>
                                  Non validé
                                </span>
                              )}
                            </td>
                            <td style={{padding: '10px', textAlign: 'center'}}>
                              <div style={{display: 'flex', gap: '5px', justifyContent: 'center', flexWrap: 'wrap'}}>
                                <button 
                                  className="btn btn-primary" 
                                  onClick={() => editMission(mission)}
                                  style={{fontSize: '0.85rem', padding: '6px 12px', display:'inline-flex', alignItems:'center', gap:4}}
                                >
                                  <Pencil size={12}/> Modifier
                                </button>
                                
                                {/* Bouton validation frais missionnaire */}
                                {!statutPaiement.frais_valides_missionnaire && (
                                  <button 
                                    className="btn btn-success" 
                                    onClick={() => validerFraisMissionnaire(mission.id_operation)}
                                    style={{fontSize: '0.85rem', padding: '6px 12px', display:'inline-flex', alignItems:'center', gap:4}}
                                    title="Valider que les frais sont corrects"
                                  >
                                    <CheckCircle size={12}/> Valider frais
                                  </button>
                                )}
                                
                                {/* Bouton validation paiement RH */}
                                {estRH && statutPaiement.frais_valides_missionnaire && !statutPaiement.frais_payes && (
                                  <button 
                                    className="btn btn-success" 
                                    onClick={() => validerPaiementRH(mission.id_operation)}
                                    style={{fontSize: '0.85rem', padding: '6px 12px', display:'inline-flex', alignItems:'center', gap:4}}
                                    title="Confirmer le paiement des frais"
                                  >
                                    <CheckCircle size={12}/> Confirmer paiement
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {demandeType === 'frais' && (
              <form className="form-card" onSubmit={submitFrais}>
                <h3>Demande de frais de mission</h3>
                <div style={{ background: '#fff3cd', padding: '12px', borderRadius: '6px', marginBottom: '15px', border: '1px solid #ffc107', display:'flex', alignItems:'flex-start', gap:6 }}>
                  <AlertTriangle size={13} style={{flexShrink:0, marginTop:2}}/> <span><strong>Important:</strong> Vous ne pouvez demander les frais qu'après validation complète de votre mission par tous les validateurs.</span>
                </div>
                <div className="form-group">
                  <label>Mission (ID opération)</label>
                  <select 
                    value={fraisForm.id_operation} 
                    onChange={(e) => setFraisForm({ ...fraisForm, id_operation: e.target.value })} 
                    required
                  >
                    <option value="">Sélectionner une mission</option>
                    {missions.filter(m => {
                      const statut = missionStatuts[m.id_operation]
                      return statut?.validation_complete && !statut?.frais_deja_demandes
                    }).map(m => (
                      <option key={m.id_operation} value={m.id_operation}>
                        #{m.id_operation} - {m.pays}, {m.ville || 'N/A'} (Validée)
                      </option>
                    ))}
                  </select>
                  {missions.filter(m => missionStatuts[m.id_operation]?.validation_complete).length === 0 && (
                    <p style={{ fontSize: '0.85em', color: '#666', marginTop: '8px' }}>
                      Aucune mission validée disponible
                    </p>
                  )}
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Frais transport (prix unitaire en FCFA)</label>
                    <input type="number" step="0.01" value={fraisForm.frais_transport_unitaire} onChange={(e) => setFraisForm({ ...fraisForm, frais_transport_unitaire: e.target.value })} placeholder="Entrez le montant" />
                    <p style={{fontSize: '0.85rem', color: '#666', margin: '5px 0 0 0'}}>
                      <strong>Total:</strong> {fraisMissionCalculs.frais_transport_total.toFixed(2)} FCFA (payé une fois)
                    </p>
                  </div>
                  <div className="form-group">
                    <label>Frais hôtel (prix unitaire/nuit en FCFA)</label>
                    <input type="number" step="0.01" value={fraisForm.frais_hotel_unitaire} onChange={(e) => setFraisForm({ ...fraisForm, frais_hotel_unitaire: e.target.value })} placeholder="Entrez le montant" />
                    <p style={{fontSize: '0.85rem', color: '#666', margin: '5px 0 0 0'}}>
                      <strong>Total:</strong> {fraisMissionCalculs.frais_hotel_total.toFixed(2)} FCFA pour {fraisMissionCalculs.nuits} nuit{fraisMissionCalculs.nuits > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Frais déplacement (prix unitaire/jour en FCFA)</label>
                    <input type="number" step="0.01" value={fraisForm.frais_deplacement_unitaire} onChange={(e) => setFraisForm({ ...fraisForm, frais_deplacement_unitaire: e.target.value })} placeholder="Entrez le montant" />
                    <p style={{fontSize: '0.85rem', color: '#666', margin: '5px 0 0 0'}}>
                      <strong>Total:</strong> {fraisMissionCalculs.frais_deplacement_total.toFixed(2)} FCFA pour {fraisMissionCalculs.durationDays} jour{fraisMissionCalculs.durationDays > 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="form-group">
                    <label>Frais mission (prix unitaire/jour en FCFA)</label>
                    <input type="number" step="0.01" value={fraisForm.frais_mission_unitaire} onChange={(e) => setFraisForm({ ...fraisForm, frais_mission_unitaire: e.target.value })} placeholder="Entrez le montant" />
                    <p style={{fontSize: '0.85rem', color: '#666', margin: '5px 0 0 0'}}>
                      <strong>Total:</strong> {fraisMissionCalculs.frais_mission_total.toFixed(2)} FCFA pour {fraisMissionCalculs.durationDays} jour{fraisMissionCalculs.durationDays > 1 ? 's' : ''}
                    </p>
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
                <button className="btn btn-success" type="submit" disabled={!fraisForm.id_operation}>
                  Soumettre demande de frais
                </button>
              </form>
            )}

            {demandeType === 'missions' && (
              <div className="upload-grid">
                <form className="form-card" onSubmit={uploadRapport}>
                <h3>Téléversement rapport mission</h3>
                <div style={{ background: '#d1ecf1', padding: '10px', borderRadius: '6px', marginBottom: '12px', border: '1px solid #bee5eb', fontSize: '0.9em' }}>
                  ℹ️ Le rapport ne peut être téléversé que pour une mission <strong>active</strong> (validée et activée).
                </div>
                <div className="form-group">
                  <label>Mission (ID opération)</label>
                  <select value={rapportUpload.id_operation} onChange={(e) => setRapportUpload({ ...rapportUpload, id_operation: e.target.value })}>
                    <option value="">Sélectionner une mission</option>
                    {missions.filter(m => {
                      const statut = missionStatuts[m.id_operation]
                      return statut?.est_active
                    }).map(m => (
                      <option key={m.id_operation} value={m.id_operation}>
                        #{m.id_operation} - {m.pays}, {m.ville || 'N/A'} (Active)
                      </option>
                    ))}
                  </select>
                  {missions.filter(m => missionStatuts[m.id_operation]?.est_active).length === 0 && (
                    <p style={{ fontSize: '0.85em', color: '#856404', background: '#fff3cd', padding: '8px', borderRadius: '4px', marginTop: '8px' }}>
                      <AlertTriangle size={13} style={{flexShrink:0}}/> Aucune mission activée disponible. La mission doit être validée puis activée par vous et le RH.
                    </p>
                  )}
                </div>
                <div className="form-group">
                  <label>Fichier rapport</label>
                  <input type="file" onChange={(e) => setRapportUpload({ ...rapportUpload, file: e.target.files[0] })} />
                </div>
                <button className="btn btn-primary" type="submit" disabled={!rapportUpload.id_operation || !rapportUpload.file}>
                  Téléverser rapport
                </button>
              </form>

              <form className="form-card" onSubmit={uploadPreuveFrais}>
                <h3>Téléversement preuves frais</h3>
                <div style={{background: '#fef3c7', padding: '12px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #f59e0b'}}>
                  <p style={{margin: 0, fontSize: '0.9rem', color: '#92400e'}}>
                    <ClipboardList size={12} style={{flexShrink:0}}/> <strong>Important:</strong> Vous devez d'abord soumettre une demande de frais associée à une mission <strong>validée et activée</strong> pour pouvoir téléverser les preuves.
                  </p>
                </div>
                <div className="form-group">
                  <label>ID Frais</label>
                  <input value={preuveUpload.id_frais} onChange={(e) => setPreuveUpload({ ...preuveUpload, id_frais: e.target.value })} required placeholder="Entrez l'ID de la demande de frais" />
                </div>
                <div className="form-group">
                  <label>Type de preuve</label>
                  <select value={preuveUpload.type_preuve} onChange={(e) => setPreuveUpload({ ...preuveUpload, type_preuve: e.target.value })} required>
                    <option value="facture">Facture</option>
                    <option value="recu">Reçu</option>
                    <option value="ticket">Ticket</option>
                    <option value="bordereau">Bordereau</option>
                    <option value="quittance">Quittance</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Fichier preuve</label>
                  <input type="file" onChange={(e) => setPreuveUpload({ ...preuveUpload, file: e.target.files[0] })} required />
                </div>
                <button className="btn btn-success" type="submit" disabled={!preuveUpload.id_frais || !preuveUpload.file}>
                  Téléverser preuve
                </button>
              </form>

              {preuvesFraisEnCours.length > 0 && (
                <div className="form-card" style={{background: '#d1e7dd', border: '1px solid #badbcc'}}>
                  <h3 style={{color: '#0f5132', margin: '0 0 12px 0', display:'flex', alignItems:'center', gap:6}}><CheckCircle size={14}/> Preuves téléversées ({preuvesFraisEnCours.length})</h3>
                  <ul style={{margin: 0, paddingLeft: '20px'}}>
                    {preuvesFraisEnCours.map((p, idx) => (
                      <li key={idx} style={{color: '#1a5e3b', marginBottom: '8px'}}>
                        <strong>{p.type_preuve}</strong> - {p.file}
                      </li>
                    ))}
                  </ul>
                  <button 
                    className="btn" 
                    style={{marginTop: '12px', background: '#198754', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer'}}
                    onClick={() => {
                      setPreuveUpload({ id_frais: '', type_preuve: 'facture', file: null })
                      setSuccess('')
                    }}
                  >
                    + Téléverser une autre preuve
                  </button>
                </div>
              )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'workflow' && !loading && (
          <div className="tab-pane">
            <div className="tab-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
              <h2>Workflow (Kanban)</h2>
              {selectedOperation && (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowWorkflowInDetail((v) => !v)}
                  style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                >
                  {showWorkflowInDetail ? 'Masquer workflow' : 'Afficher workflow'}
                </button>
              )}
            </div>

            {selectedOperation && (
              <div style={{ marginBottom: '14px', maxWidth: '760px', marginInline: 'auto' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setSelectedOperation(null)
                      setWorkflowDecisionComment('')
                      setShowWorkflowInDetail(false)
                    }}
                  >
                    ← Fermer le détail
                  </button>
                </div>

                {showWorkflowInDetail && (
                  <div className="card" style={{ marginBottom: '12px', padding: '8px 10px', border: '2px solid rgba(206,43,43,0.35)', boxShadow: '0 0 0 3px rgba(206,43,43,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
                      <button
                        type="button"
                        onClick={() => setShowWorkflowInDetail(false)}
                        title="Fermer le workflow"
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '999px',
                          border: 'none',
                          background: '#ce2b2b',
                          color: '#fff',
                          fontWeight: 700,
                          cursor: 'pointer',
                          lineHeight: 1,
                          fontSize: '0.85rem',
                          padding: 0,
                        }}
                      >
                        ×
                      </button>
                    </div>
                    <ProgressionValidation
                      idOperation={selectedOperation}
                      typeDefault="Demande opération"
                    />
                  </div>
                )}

                {!showWorkflowInDetail && (
                  <>
                    {canValidateSelectedOperation && (
                      <div className="card" style={{ marginBottom: '8px', padding: '8px 10px', borderTop: '4px solid #112033', textAlign: 'center' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '6px', color: '#021630', fontSize: '0.9rem' }}>Action du validateur</h3>
                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                          Commentaire de validation / motif de refus
                        </label>
                        <textarea
                          value={workflowDecisionComment}
                          onChange={(e) => setWorkflowDecisionComment(e.target.value)}
                          placeholder="Ajoutez un commentaire. Le motif est obligatoire en cas de refus."
                          rows={1}
                          style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '6px 8px', resize: 'vertical', marginBottom: '6px', fontFamily: 'inherit', fontSize: '0.78rem', maxHeight: '64px' }}
                        />
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button
                            className="btn btn-success"
                            onClick={() => soumettreDecisionWorkflow('validé')}
                            style={{ padding: '5px 10px', fontSize: '0.76rem', width: 'auto' }}
                          >
                            Valider
                          </button>
                          <button
                            className="btn btn-danger"
                            onClick={() => soumettreDecisionWorkflow('refusé')}
                            disabled={!workflowDecisionComment.trim()}
                            style={{ opacity: workflowDecisionComment.trim() ? 1 : 0.6, padding: '5px 10px', fontSize: '0.76rem' }}
                          >
                            Refuser
                          </button>
                        </div>
                      </div>
                    )}

                    {readonlyFormData && (
                      <div className="form-card readonly-compact-form" style={{ marginBottom: '8px', padding: '12px 14px', borderLeft: '4px solid #112033' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
                          <h3 style={{ margin: 0, color: '#021630', fontSize: '1.06rem' }}>Formulaire de demande (lecture seule)</h3>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#112033', background: '#e8edf4', padding: '5px 9px', borderRadius: '999px' }}>
                            #{selectedOperation}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gap: '6px' }}>
                          <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                            <div className="form-group">
                              <label>Type de demande</label>
                              <input className="input" value={readonlyFormData.typeDemande} readOnly />
                            </div>
                            <div className="form-group">
                              <label>Demandeur</label>
                              <input className="input" value={readonlyFormData.demandeur || 'Non renseigné'} readOnly />
                            </div>
                          </div>
                          <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px' }}>
                            <div className="form-group">
                              <label>Date début</label>
                              <input className="input" value={readonlyFormData.dateDebut || ''} readOnly />
                            </div>
                            <div className="form-group">
                              <label>Date fin</label>
                              <input className="input" value={readonlyFormData.dateFin || ''} readOnly />
                            </div>
                            <div className="form-group">
                              <label>Date de demande</label>
                              <input className="input" value={readonlyFormData.dateDemande || ''} readOnly />
                            </div>
                            <div className="form-group">
                              <label>Durée (jours)</label>
                              <input className="input" value={readonlyFormData.duree ? String(readonlyFormData.duree) : ''} readOnly />
                            </div>
                          </div>

                          {readonlyFormData.type === 'permission' && (
                            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                              <div className="form-group">
                                <label>Type permission</label>
                                <input className="input" value={readonlyFormData.typePermission || ''} readOnly />
                              </div>
                              <div className="form-group">
                                <label>Sous-type</label>
                                <input className="input" value={readonlyFormData.sousType || ''} readOnly />
                              </div>
                            </div>
                          )}

                          {readonlyFormData.type === 'mission' && (
                            <>
                              <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
                                <div className="form-group">
                                  <label>Objet / Motif mission</label>
                                  <input className="input" value={readonlyFormData.objet || ''} readOnly />
                                </div>
                                <div className="form-group">
                                  <label>Pays</label>
                                  <input className="input" value={readonlyFormData.pays || ''} readOnly />
                                </div>
                                <div className="form-group">
                                  <label>Ville</label>
                                  <input className="input" value={readonlyFormData.ville || ''} readOnly />
                                </div>
                              </div>
                              <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
                                <div className="form-group">
                                  <label>Heure départ</label>
                                  <input className="input" value={readonlyFormData.heureDepart || ''} readOnly />
                                </div>
                                <div className="form-group">
                                  <label>Heure retour</label>
                                  <input className="input" value={readonlyFormData.heureRetour || ''} readOnly />
                                </div>
                                <div className="form-group">
                                  <label>Moyen de transport</label>
                                  <input className="input" value={readonlyFormData.transport || ''} readOnly />
                                </div>
                              </div>
                              <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                                <div className="form-group">
                                  <label>Email contact</label>
                                  <input className="input" value={readonlyFormData.emailContact || ''} readOnly />
                                </div>
                              </div>
                            </>
                          )}

                          <div className="form-group">
                            <label>Motif / Commentaire</label>
                            <textarea className="input" value={readonlyFormData.motif || ''} readOnly rows={1} style={{ resize: 'none', maxHeight: '48px' }} />
                          </div>
                        </div>
                      </div>
                    )}

                    {missions.some(m => m.id_operation === selectedOperation) && (
                      <div style={{ marginTop: '10px' }}>
                        <CommentairesMission 
                          idMission={selectedOperation} 
                          matricule={matricule} 
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {!selectedOperation && (
              <>
                <div style={{ marginBottom: '10px' }}>
                  <h3 style={{ marginBottom: '10px' }}>Mes demandes personnelles</h3>
                </div>
                <div className="kanban-grid">
                  <div className="kanban-col orange-light">
                    <h3>En attente ({workflowCols.enAttente.length})</h3>
                    {workflowCols.enAttente.length === 0 ? (
                      <p className="empty-state">Aucune</p>
                    ) : (
                      workflowCols.enAttente.map((o) => (
                        <div
                          key={o.id_operation}
                          className="kanban-card"
                          onClick={() => setSelectedOperation(o.id_operation)}
                          style={{ cursor: 'pointer' }}
                        >
                          <p>
                            <strong>#{o.id_operation}</strong> - {o.type_demande}
                          </p>
                          <p style={{ fontSize: '0.9em' }}>Statut: {o.statut}</p>
                          <div className="kanban-actions" style={{ marginTop: '6px' }}>
                            <button 
                              className="btn btn-primary" 
                              onClick={(e) => ouvrirModificationOperation(o.id_operation, e)}
                              style={{ fontSize: '0.74rem', padding: '4px 8px', display:'inline-flex', alignItems:'center', gap:4 }}
                            >
                              <Pencil size={11}/> Modifier
                            </button>
                            <button 
                              className="btn btn-danger" 
                              onClick={(e) => annulerOperation(o.id_operation, e)}
                              style={{ fontSize: '0.74rem', padding: '4px 8px', display:'inline-flex', alignItems:'center', gap:4 }}
                            >
                              <XCircle size={11}/> Annuler
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="kanban-col green">
                    <h3>Validées ({workflowCols.valides.length})</h3>
                    {workflowCols.valides.length === 0 ? (
                      <p className="empty-state">Aucune</p>
                    ) : (
                      workflowCols.valides.map((o) => (
                        <div
                          key={o.id_operation}
                          className="kanban-card"
                          onClick={() => setSelectedOperation(o.id_operation)}
                          style={{ cursor: 'pointer' }}
                        >
                          <p>
                            <strong>#{o.id_operation}</strong> - {o.type_demande}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="kanban-col red">
                    <h3>Refusées ({workflowCols.refuses.length})</h3>
                    {workflowCols.refuses.length === 0 ? (
                      <p className="empty-state">Aucune</p>
                    ) : (
                      workflowCols.refuses.map((o) => (
                        <div
                          key={o.id_operation}
                          className="kanban-card"
                          onClick={() => setSelectedOperation(o.id_operation)}
                          style={{ cursor: 'pointer' }}
                        >
                          <p>
                            <strong>#{o.id_operation}</strong> - {o.type_demande}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {estValidateur && (
                  <>
                    <div style={{ marginTop: '14px', marginBottom: '8px' }}>
                      <h3 style={{ marginBottom: '8px', display:'flex', alignItems:'center', gap:6 }}><UserCheck size={14}/> Mes actions de validation</h3>
                    </div>
                    <div className="kanban-grid">
                      <div className="kanban-col orange">
                        <h3>À valider ({aValider.length})</h3>
                        {aValider.length === 0 ? (
                          <p className="empty-state">Aucune validation</p>
                        ) : (
                          aValider.map((o) => (
                            <div
                              key={o.id_operation}
                              className="kanban-card"
                              onClick={() => {
                                setSelectedOperation(o.id_operation)
                                setWorkflowDecisionComment('')
                              }}
                              style={{ cursor: 'pointer' }}
                            >
                              <p>
                                <strong>#{o.id_operation}</strong> - {o.type_demande}
                              </p>
                              <p style={{ fontSize: '0.8em', color: '#64748b', marginBottom: 0 }}>
                                Cliquer pour examiner le détail puis décider
                              </p>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="kanban-col blue">
                        <h3 style={{display:'flex',alignItems:'center',gap:6}}><CheckCircle size={14}/> Validées par moi ({mesValidations.length})</h3>
                        {mesValidations.length === 0 ? (
                          <p className="empty-state">Aucune validation</p>
                        ) : (
                          mesValidations.map((o) => (
                            <div
                              key={o.id_operation}
                              className="kanban-card"
                              onClick={() => setSelectedOperation(o.id_operation)}
                              style={{ cursor: 'pointer' }}
                            >
                              <p>
                                <strong>#{o.id_operation}</strong> - {o.type_demande}
                              </p>
                              <p style={{ fontSize: '0.8em', color: '#666' }}>
                                {o.demandeur?.nom || 'N/A'}
                              </p>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="kanban-col purple">
                        <h3 style={{display:'flex',alignItems:'center',gap:6}}><XCircle size={14}/> Refusées par moi ({mesRefus.length})</h3>
                        {mesRefus.length === 0 ? (
                          <p className="empty-state">Aucun refus</p>
                        ) : (
                          mesRefus.map((o) => (
                            <div
                              key={o.id_operation}
                              className="kanban-card"
                              onClick={() => setSelectedOperation(o.id_operation)}
                              style={{ cursor: 'pointer' }}
                            >
                              <p>
                                <strong>#{o.id_operation}</strong> - {o.type_demande}
                              </p>
                              <p style={{ fontSize: '0.8em', color: '#666' }}>
                                {o.demandeur?.nom || 'N/A'}
                              </p>
                              {o.motif_refus && (
                                <p style={{ fontSize: '0.72em', color: '#c0392b', fontStyle: 'italic' }}>
                                  Motif: {o.motif_refus}
                                </p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'remplacants' && !loading && (
          <div className="tab-pane">
            <div className="tab-header">
              <h2>Remplaçants proposés</h2>
            </div>

            <div className="form-card">
              <h3>Recherche par opération</h3>
              <div className="form-row">
                <input value={operationRecherche} onChange={(e) => setOperationRecherche(e.target.value)} placeholder="ID opération" />
                <button className="btn btn-primary" onClick={rechercherPropositions}>Afficher propositions</button>
              </div>
            </div>

            <div className="items-list">
              {propositions.map((r) => (
                <div key={r.id_remplacant_propose} className="item-card">
                  <div className="item-header">
                    <h4>{r.nom_complet}</h4>
                    <span className="badge" style={{ backgroundColor: r.est_accepte ? '#27ae60' : '#f39c12' }}>
                      {r.est_accepte ? 'Accepté' : 'Proposé'}
                    </span>
                  </div>
                  <div className="item-details">
                    <p><strong>Matricule:</strong> {r.matricule}</p>
                    <p><strong>Fonction:</strong> {r.fonction || '-'}</p>
                    {!r.est_accepte && (
                      <button className="btn btn-success" onClick={() => accepterRemplacant(r.matricule)}>Accepter</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="tab-header" style={{ marginTop: 24 }}>
              <h2>Mes remplacements acceptés</h2>
            </div>
            <div className="items-list">
              {mesRemplacements.map((r) => (
                <div key={r.id_operation} className="item-card">
                  <div className="item-header">
                    <h4>#{r.id_operation} - {r.type_demande}</h4>
                  </div>
                  <div className="item-details">
                    <p><strong>Période:</strong> {r.date_debut ? dayjs(r.date_debut).format('DD/MM/YYYY') : '-'} → {r.date_fin ? dayjs(r.date_fin).format('DD/MM/YYYY') : '-'}</p>
                    <p><strong>Employé absent:</strong> {r.employe_absent?.nom_complet || '-'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
