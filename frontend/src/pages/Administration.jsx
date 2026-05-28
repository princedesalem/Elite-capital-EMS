import React, { useState, useEffect, useMemo, useRef } from 'react'
import api from '../services/api'
import { Settings, Building2, GitBranch, LayoutGrid, Briefcase, Plus, Pencil, Trash2, X, Users, Activity, ExternalLink, RefreshCw } from 'lucide-react'
import OrgChart from './OrgChart'
import { useAuth } from '../contexts/AuthContext'
import { confirmDialog } from '../components/ui/bridge'
import { BRAND_GRADIENT } from '../theme'
export default function Administration() {
  const { user } = useAuth()
  const role = String(user?.role || '').toUpperCase()
  const canManageAdministration = ['RH', 'ADMIN', 'PCA', 'AG'].includes(role)
  const canEditAdmin = canManageAdministration && role !== 'RH'

  const [activeTab, setActiveTab] = useState('entites')
  const [entitesData, setEntitesData] = useState([])
  const [directionsData, setDirectionsData] = useState([])
  const [departementsData, setDepartementsData] = useState([])
  const [fonctionsData, setFonctionsData] = useState([])
  const [fonctionInput, setFonctionInput] = useState('')
  const [fonctionForm, setFonctionForm] = useState({ libelle: '', id_direction: '', dept_id: '' })
  const [editingFonctionId, setEditingFonctionId] = useState(null)
  const [savingFonction, setSavingFonction] = useState(false)
  const [fonctionFormHighlight, setFonctionFormHighlight] = useState(false)
  const fonctionFormRef = useRef(null)
  const [sortDirectionBy, setSortDirectionBy] = useState('nom')
  const [sortDirectionValue, setSortDirectionValue] = useState('all')
  const [sortDepartementBy, setSortDepartementBy] = useState('nom')
  const [sortDepartementValue, setSortDepartementValue] = useState('all')
  const [openEntiteDirections, setOpenEntiteDirections] = useState({})
  const [openEntiteDepartements, setOpenEntiteDepartements] = useState({})
  const [openDirectionDepartements, setOpenDirectionDepartements] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isAdmin = role === 'ADMIN'
  const [ciStatus, setCiStatus] = useState(null)
  const [ciLoading, setCiLoading] = useState(false)

  const loadCiStatus = async () => {
    setCiLoading(true)
    try {
      const { data } = await api.get('/api/admin/ci-status')
      setCiStatus(data)
    } catch (e) {
      setCiStatus({ error: e?.response?.data?.detail || 'Erreur lors du chargement du statut CI' })
    } finally {
      setCiLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin && activeTab === 'ci' && !ciStatus) {
      loadCiStatus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, activeTab])
  const [success, setSuccess] = useState('')
  const [rolesData, setRolesData] = useState([])

  // ── Entités CRUD ──
  const [entiteInput, setEntiteInput] = useState('')
  const [editingEntiteId, setEditingEntiteId] = useState(null)
  const [savingEntite, setSavingEntite] = useState(false)

  // ── Directions CRUD ──
  const [directionForm, setDirectionForm] = useState({ nom: '', id_entite: '' })
  const [editingDirectionId, setEditingDirectionId] = useState(null)
  const [savingDirection, setSavingDirection] = useState(false)

  // ── Départements CRUD ──
  const [deptForm, setDeptForm] = useState({ nom: '', id_entite: '', id_direction: '' })
  const [editingDeptId, setEditingDeptId] = useState(null)
  const [savingDept, setSavingDept] = useState(false)
  const [deptVillesIds, setDeptVillesIds] = useState([])
  const [availableVilles, setAvailableVilles] = useState([])

  const toggleOpen = (setter, id) => {
    setter((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const compareByDirectionKey = (a, b, key) => {
    if (key === 'entite') {
      return String(a.entite_nom || '').localeCompare(String(b.entite_nom || ''), 'fr', { sensitivity: 'base' })
    }
    if (key === 'departements') {
      return Number(b.departements_count || 0) - Number(a.departements_count || 0)
    }
    return String(a.nom || '').localeCompare(String(b.nom || ''), 'fr', { sensitivity: 'base' })
  }

  const compareByDepartementKey = (a, b, key) => {
    if (key === 'entite') {
      return String(a.entite_nom || '').localeCompare(String(b.entite_nom || ''), 'fr', { sensitivity: 'base' })
    }
    if (key === 'direction') {
      return String(a.direction_nom || '').localeCompare(String(b.direction_nom || ''), 'fr', { sensitivity: 'base' })
    }
    return String(a.nom || '').localeCompare(String(b.nom || ''), 'fr', { sensitivity: 'base' })
  }

  const sortedDirections = useMemo(() => {
    const arr = [...directionsData]
    const filtered = sortDirectionValue === 'all'
      ? arr
      : arr.filter((d) => {
          if (sortDirectionBy === 'entite') return String(d.entite_nom || 'N/A') === sortDirectionValue
          if (sortDirectionBy === 'departements') return String(Number(d.departements_count || 0)) === sortDirectionValue
          return String(d.nom || 'N/A') === sortDirectionValue
        })

    return filtered.sort((a, b) => {
      const primary = compareByDirectionKey(a, b, sortDirectionBy)
      if (primary !== 0) return primary
      return String(a.nom || '').localeCompare(String(b.nom || ''), 'fr', { sensitivity: 'base' })
    })
  }, [directionsData, sortDirectionBy, sortDirectionValue])

  const sortedDepartements = useMemo(() => {
    const arr = [...departementsData]
    const filtered = sortDepartementValue === 'all'
      ? arr
      : arr.filter((d) => {
          if (sortDepartementBy === 'entite') return String(d.entite_nom || 'N/A') === sortDepartementValue
          if (sortDepartementBy === 'direction') return String(d.direction_nom || 'N/A') === sortDepartementValue
          return String(d.nom || 'N/A') === sortDepartementValue
        })

    return filtered.sort((a, b) => {
      const primary = compareByDepartementKey(a, b, sortDepartementBy)
      if (primary !== 0) return primary
      return String(a.nom || '').localeCompare(String(b.nom || ''), 'fr', { sensitivity: 'base' })
    })
  }, [departementsData, sortDepartementBy, sortDepartementValue])

  const directionValueOptions = useMemo(() => {
    const values = new Set()
    directionsData.forEach((d) => {
      if (sortDirectionBy === 'entite') values.add(String(d.entite_nom || 'N/A'))
      else if (sortDirectionBy === 'departements') values.add(String(Number(d.departements_count || 0)))
      else values.add(String(d.nom || 'N/A'))
    })
    return Array.from(values).sort((a, b) => {
      if (sortDirectionBy === 'departements') return Number(b) - Number(a)
      return a.localeCompare(b, 'fr', { sensitivity: 'base' })
    })
  }, [directionsData, sortDirectionBy])

  const departementValueOptions = useMemo(() => {
    const values = new Set()
    departementsData.forEach((d) => {
      if (sortDepartementBy === 'entite') values.add(String(d.entite_nom || 'N/A'))
      else if (sortDepartementBy === 'direction') values.add(String(d.direction_nom || 'N/A'))
      else values.add(String(d.nom || 'N/A'))
    })
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))
  }, [departementsData, sortDepartementBy])

  useEffect(() => {
    setSortDirectionValue('all')
  }, [sortDirectionBy])

  useEffect(() => {
    setSortDepartementValue('all')
  }, [sortDepartementBy])

  const loadData = async () => {
    setLoading(true)
    setError('')
    setSuccess('')
    const failed = []
    let entites = []
    let directions = []
    let departements = []
    let fonctions = []
    let roles = []

    try {
      const ent = await api.get('/employees/admin/entites-structure')
      entites = ent.data || []
    } catch {
      try {
        const entFallback = await api.get('/employees/entites')
        entites = (entFallback.data || []).map((e) => ({
          id_entite: e.id_entite,
          nom: e.nom,
          directions_count: 0,
          departements_count: 0,
          directions: [],
          departements: []
        }))
      } catch {
        entites = []
        failed.push('entites')
      }
    }

    try {
      const dir = await api.get('/employees/admin/directions-structure')
      directions = dir.data || []
    } catch {
      try {
        const dirFallback = await api.get('/employees/directions')
        directions = (dirFallback.data || []).map((d) => ({
          id_direction: d.id_direction,
          nom: d.nom,
          id_entite: d.id_entite,
          entite_nom: d.entite_nom || 'N/A',
          departements_count: 0,
          departements: []
        }))
      } catch {
        directions = []
        failed.push('directions')
      }
    }

    try {
      const dept = await api.get('/employees/admin/departements')
      departements = dept.data || []
    } catch {
      try {
        const deptFallback = await api.get('/employees/departements')
        departements = (deptFallback.data || []).map((d) => ({
          dept_id: d.dept_id,
          nom: d.nom,
          id_entite: d.id_entite,
          entite_nom: d.entite_nom || 'N/A',
          id_direction: d.id_direction,
          direction_nom: d.direction_nom || 'N/A'
        }))
      } catch {
        departements = []
        failed.push('departements')
      }
    }

    // Fonctions are organisational reference data — load for everyone.
    try {
      const fon = await api.get('/employees/admin/fonctions-reference')
      fonctions = fon.data || []
    } catch {
      try {
        const fonFallback = await api.get('/employees/autocomplete/fonctions')
        fonctions = (fonFallback.data || []).map((f, idx) => ({
          id_fonction: f.id_fonction || `fallback-${idx}`,
          libelle: f.libelle || f.label || f.value || ''
        })).filter((f) => f.libelle)
      } catch {
        fonctions = []
      }
    }

    if (canManageAdministration) {
      try {
        const rolesRes = await api.get('/roles/')
        roles = rolesRes.data || []
      } catch {
        roles = []
        failed.push('roles')
      }
    }

    const entiteNameToId = {}
    entites.forEach((e) => {
      const key = String(e.nom || '').trim().toLowerCase()
      if (key) entiteNameToId[key] = e.id_entite
    })

    const deptCountByDirection = {}
    departements.forEach((d) => {
      if (!d?.id_direction) return
      const key = String(d.id_direction)
      deptCountByDirection[key] = (deptCountByDirection[key] || 0) + 1
    })

    const normalizedDirections = directions.map((d) => {
      const inferredEntiteId = d.id_entite || entiteNameToId[String(d.entite_nom || '').trim().toLowerCase()] || null
      const computedDeptCount = d.id_direction ? (deptCountByDirection[String(d.id_direction)] || 0) : 0
      return {
        ...d,
        id_entite: inferredEntiteId,
        departements_count: computedDeptCount || d.departements_count || 0
      }
    })

    const normalizedEntites = entites.map((e) => {
      const dirs = normalizedDirections.filter((d) => String(d.id_entite) === String(e.id_entite))
      const depts = departements.filter((d) => String(d.id_entite) === String(e.id_entite))
      return {
        ...e,
        directions_count: dirs.length,
        departements_count: depts.length,
        directions: dirs.map((d) => ({
          id_direction: d.id_direction,
          nom: d.nom,
          departements_count: d.departements_count || 0
        })),
        departements: depts.map((d) => ({
          dept_id: d.dept_id,
          nom: d.nom,
          id_direction: d.id_direction
        }))
      }
    })

    setEntitesData(normalizedEntites)
    setDirectionsData(normalizedDirections)
    setDepartementsData(departements)
    setFonctionsData(fonctions)
    setRolesData(roles)

    if (failed.length > 0) {
      setError(`Certaines donnees n'ont pas pu etre chargees: ${failed.join(', ')}. Verifiez que le backend est accessible et que vous etes connecte.`)
    }

    setLoading(false)
  }

  const loadFonctions = async () => {
    try {
      const res = await api.get('/employees/admin/fonctions-reference')
      setFonctionsData(res.data || [])
    } catch (e) {
      setError('Erreur de chargement des fonctions')
    }
  }

  const resetFonctionForm = () => {
    setFonctionInput('')
    setFonctionForm({ libelle: '', id_direction: '', dept_id: '' })
    setEditingFonctionId(null)
  }

  const submitFonction = async () => {
    const libelle = fonctionForm.libelle.trim()
    if (!libelle) {
      setError("Le libellé de la fonction est obligatoire")
      return
    }
    setSavingFonction(true)
    setError('')
    const payload = {
      libelle,
      id_direction: fonctionForm.id_direction ? Number(fonctionForm.id_direction) : null,
      dept_id: fonctionForm.dept_id ? Number(fonctionForm.dept_id) : null,
    }
    try {
      if (editingFonctionId) {
        await api.put(`/employees/admin/fonctions-reference/${editingFonctionId}`, payload)
      } else {
        await api.post('/employees/admin/fonctions-reference', payload)
      }
      resetFonctionForm()
      await loadFonctions()
    } catch (e) {
      setError(e?.response?.data?.detail || "Erreur lors de la sauvegarde de la fonction")
    } finally {
      setSavingFonction(false)
    }
  }

  const startEditFonction = (f) => {
    setEditingFonctionId(f.id_fonction)
    setFonctionInput(f.libelle)
    setFonctionForm({ libelle: f.libelle, id_direction: f.id_direction || '', dept_id: f.dept_id || '' })
    // Scroll vers le haut de la page (banner Administration visible)
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }, 50)
    setFonctionFormHighlight(true)
    setTimeout(() => setFonctionFormHighlight(false), 1500)
  }

  const deleteFonction = async (f) => {
    const ok = await confirmDialog({ title: 'Supprimer la fonction', message: `Supprimer la fonction «${f.libelle}» ?`, variant: 'danger', confirmLabel: 'Supprimer' })
    if (!ok) return
    setError('')
    try {
      await api.delete(`/employees/admin/fonctions-reference/${f.id_fonction}`)
      if (editingFonctionId === f.id_fonction) resetFonctionForm()
      await loadFonctions()
    } catch (e) {
      setError(e?.response?.data?.detail || "Erreur lors de la suppression de la fonction")
    }
  }

  useEffect(() => {
    loadData()
  }, [canManageAdministration])

  // ── Entités CRUD handlers ──
  const submitEntite = async () => {
    const nom = entiteInput.trim()
    if (!nom) { setError("Le nom de l'entité est obligatoire"); return }
    setSavingEntite(true); setError('')
    try {
      if (editingEntiteId) {
        await api.put(`/employees/entites/${editingEntiteId}`, { nom })
      } else {
        await api.post('/employees/entites', { nom })
      }
      setEntiteInput(''); setEditingEntiteId(null); await loadData()
    } catch (e) { setError(e?.response?.data?.detail || "Erreur sauvegarde entité") }
    finally { setSavingEntite(false) }
  }
  const startEditEntite = (e) => { setEditingEntiteId(e.id_entite); setEntiteInput(e.nom) }
  const resetEntiteForm = () => { setEntiteInput(''); setEditingEntiteId(null) }
  const deleteEntite = async (e) => {
    const ok = await confirmDialog({ title: 'Supprimer l’entité', message: `Supprimer l'entité «${e.nom}» ? Cela supprimera aussi ses directions et départements.`, variant: 'danger', confirmLabel: 'Supprimer' })
    if (!ok) return
    setError('')
    try { await api.delete(`/employees/entites/${e.id_entite}`); await loadData() }
    catch (err) { setError(err?.response?.data?.detail || "Erreur suppression entité") }
  }

  // ── Directions CRUD handlers ──
  const submitDirection = async () => {
    const { nom, id_entite } = directionForm
    if (!nom.trim() || !id_entite) { setError("Le nom et l'entité sont obligatoires"); return }
    setSavingDirection(true); setError('')
    try {
      if (editingDirectionId) {
        await api.put(`/employees/directions/${editingDirectionId}`, { nom: nom.trim(), id_entite: Number(id_entite) })
      } else {
        await api.post('/employees/directions', { nom: nom.trim(), id_entite: Number(id_entite) })
      }
      setDirectionForm({ nom: '', id_entite: '' }); setEditingDirectionId(null); await loadData()
    } catch (e) { setError(e?.response?.data?.detail || "Erreur sauvegarde direction") }
    finally { setSavingDirection(false) }
  }
  const startEditDirection = (d) => { setEditingDirectionId(d.id_direction); setDirectionForm({ nom: d.nom, id_entite: String(d.id_entite || '') }) }
  const resetDirectionForm = () => { setDirectionForm({ nom: '', id_entite: '' }); setEditingDirectionId(null) }
  const deleteDirection = async (d) => {
    const ok = await confirmDialog({ title: 'Supprimer la direction', message: `Supprimer la direction «${d.nom}» ? Ses départements seront aussi supprimés.`, variant: 'danger', confirmLabel: 'Supprimer' })
    if (!ok) return
    setError('')
    try { await api.delete(`/employees/directions/${d.id_direction}`); await loadData() }
    catch (err) { setError(err?.response?.data?.detail || "Erreur suppression direction") }
  }

  // ── Départements CRUD handlers ──
  const handleDeptEntiteChange = async (id_entite) => {
    setDeptForm(prev => ({ ...prev, id_entite, id_direction: '' }))
    setDeptVillesIds([])
    if (!id_entite) { setAvailableVilles([]); return }
    try {
      const res = await api.get(`/employees/villes?id_entite=${id_entite}`)
      setAvailableVilles(res.data || [])
    } catch {
      setAvailableVilles([])
    }
  }

  const toggleDeptVille = (id_localisation) => {
    setDeptVillesIds(prev =>
      prev.includes(id_localisation)
        ? prev.filter(id => id !== id_localisation)
        : [...prev, id_localisation]
    )
  }

  const submitDept = async () => {
    const { nom, id_entite, id_direction } = deptForm
    if (!nom.trim() || !id_entite) { setError("Le nom et l'entité sont obligatoires"); return }
    setSavingDept(true); setError('')
    try {
      const body = { nom: nom.trim(), id_entite: Number(id_entite), id_direction: id_direction ? Number(id_direction) : null }
      if (!editingDeptId) {
        body.villes_ids = deptVillesIds
      }
      if (editingDeptId) {
        await api.put(`/employees/departements/${editingDeptId}`, body)
      } else {
        await api.post('/employees/departements', body)
      }
      setDeptForm({ nom: '', id_entite: '', id_direction: '' }); setDeptVillesIds([]); setAvailableVilles([]); setEditingDeptId(null); await loadData()
    } catch (e) { setError(e?.response?.data?.detail || "Erreur sauvegarde département") }
    finally { setSavingDept(false) }
  }
  const startEditDept = (d) => { setEditingDeptId(d.dept_id); setDeptForm({ nom: d.nom, id_entite: String(d.id_entite || ''), id_direction: String(d.id_direction || '') }); setDeptVillesIds([]); setAvailableVilles([]) }
  const resetDeptForm = () => { setDeptForm({ nom: '', id_entite: '', id_direction: '' }); setDeptVillesIds([]); setAvailableVilles([]); setEditingDeptId(null) }
  const deleteDept = async (d) => {
    const ok = await confirmDialog({ title: 'Supprimer le département', message: `Supprimer le département «${d.nom}» ?`, variant: 'danger', confirmLabel: 'Supprimer' })
    if (!ok) return
    setError('')
    try { await api.delete(`/employees/departements/${d.dept_id}`); await loadData() }
    catch (err) { setError(err?.response?.data?.detail || "Erreur suppression département") }
  }



  return (
    <div style={{ padding: '12px', background: 'linear-gradient(135deg, #f7f8fb 0%, #e8f4f8 100%)', minHeight: '100vh' }}>
      <div
        style={{
          background: BRAND_GRADIENT,
          color: 'white',
          padding: '16px 14px',
          borderRadius: '10px',
          marginBottom: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}
      >
        <h1 style={{ margin: 0, marginBottom: 4, fontSize: '1.2rem', fontWeight: '700', display:'flex', alignItems:'center', gap:8 }}>
          <Settings size={28}/> {"Administration"}
        </h1>
        <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.95 }}>
          {"Paramètres et configuration du système"}
        </p>
      </div>

      {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '6px', marginBottom: '20px' }}>{error}</div>}
      {success && <div style={{ background: '#dcfce7', color: '#166534', padding: '12px', borderRadius: '6px', marginBottom: '20px' }}>{success}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, borderBottom: '1px solid var(--border)', paddingBottom: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('entites')}
          style={{ background: activeTab === 'entites' ? '#ce2b2b' : 'white', color: activeTab === 'entites' ? 'white' : '#021630', padding: '7px 12px', borderRadius: '6px 6px 0px 0px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.82rem', display:'inline-flex', alignItems:'center', gap:6 }}
        >
          <Building2 size={15}/> {"Entités"} ({entitesData.length})
        </button>
        <button
          onClick={() => setActiveTab('directions')}
          style={{ background: activeTab === 'directions' ? '#ce2b2b' : 'white', color: activeTab === 'directions' ? 'white' : '#021630', padding: '7px 12px', borderRadius: '6px 6px 0px 0px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.82rem', display:'inline-flex', alignItems:'center', gap:6 }}
        >
          <GitBranch size={15}/> {"Directions"} ({directionsData.length})
        </button>
        <button
          onClick={() => setActiveTab('departements')}
          style={{ background: activeTab === 'departements' ? '#ce2b2b' : 'white', color: activeTab === 'departements' ? 'white' : '#021630', padding: '7px 12px', borderRadius: '6px 6px 0px 0px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.82rem', display:'inline-flex', alignItems:'center', gap:6 }}
        >
          <LayoutGrid size={15}/> {"Départements"} ({departementsData.length})
        </button>
        <button
          onClick={() => setActiveTab('fonctions')}
          style={{ background: activeTab === 'fonctions' ? '#ce2b2b' : 'white', color: activeTab === 'fonctions' ? 'white' : '#021630', padding: '7px 12px', borderRadius: '6px 6px 0px 0px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.82rem', display:'inline-flex', alignItems:'center', gap:6 }}
        >
          <Briefcase size={15}/> {"Fonctions"} ({fonctionsData.length})
        </button>
        <button
          onClick={() => setActiveTab('organigramme')}
          style={{ background: activeTab === 'organigramme' ? '#ce2b2b' : 'white', color: activeTab === 'organigramme' ? 'white' : '#021630', padding: '7px 12px', borderRadius: '6px 6px 0px 0px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.82rem', display:'inline-flex', alignItems:'center', gap:6 }}
        >
          <Users size={15}/> {"Organigramme"}
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab('ci')}
            style={{ background: activeTab === 'ci' ? '#ce2b2b' : 'white', color: activeTab === 'ci' ? 'white' : '#021630', padding: '7px 12px', borderRadius: '6px 6px 0px 0px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.82rem', display:'inline-flex', alignItems:'center', gap:6 }}
          >
            <Activity size={15}/> {"CI/CD"}
          </button>
        )}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>{"Chargement..."}</div>}

      {/* Entités Tab */}
      {activeTab === 'entites' && !loading && (
        <div>
          {canEditAdmin && (
            <div className="card" style={{ marginBottom: 12, padding: 14 }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#021630', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Building2 size={15}/> {editingEntiteId ? "Modifier l'entité" : "Ajouter une entité"}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  value={entiteInput}
                  onChange={e => setEntiteInput(e.target.value)}
                  placeholder="Nom de l'entité"
                  style={{ flex: 1, minWidth: 220, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.85rem' }}
                />
                <button onClick={submitEntite} disabled={savingEntite} style={{ background: '#021630', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}>
                  <Plus size={13}/> {editingEntiteId ? "Mettre à jour" : "Ajouter"}
                </button>
                {editingEntiteId && (
                  <button onClick={resetEntiteForm} style={{ background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}>
                    <X size={13}/> {"Annuler"}
                  </button>
                )}
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gap: 8 }}>
            {entitesData.map((entite) => (
              <div key={entite.id_entite} className="card" style={{ borderLeft: '4px solid #021630', padding: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, color: '#021630', display:'flex', alignItems:'center', gap:6, fontSize: '0.95rem' }}>
                    <Building2 size={15}/> {entite.nom} <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 400 }}>(ID: {entite.id_entite})</span>
                  </h3>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button onClick={() => toggleOpen(setOpenEntiteDirections, entite.id_entite)} style={{ background: '#e2e8f0', color: '#021630', padding: '3px 9px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '600', border: 'none', cursor: 'pointer' }} title="Afficher/masquer les directions">
                      {entite.directions_count} direction{entite.directions_count !== 1 ? 's' : ''}
                    </button>
                    <button onClick={() => toggleOpen(setOpenEntiteDepartements, entite.id_entite)} style={{ background: '#e2e8f0', color: '#021630', padding: '3px 9px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '600', border: 'none', cursor: 'pointer' }} title="Afficher/masquer les départements">
                      {entite.departements_count} département{entite.departements_count !== 1 ? 's' : ''}
                    </button>
                    {canEditAdmin && (
                      <>
                        <button onClick={() => startEditEntite(entite)} style={{ background: '#021630', color: 'white', border: 'none', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.77rem' }}>
                          <Pencil size={12}/> {"Modifier"}
                        </button>
                        <button onClick={() => deleteEntite(entite)} style={{ background: '#ce2b2b', color: 'white', border: 'none', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.77rem' }}>
                          <Trash2 size={12}/> {"Supprimer"}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {openEntiteDirections[entite.id_entite] && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: '0.76rem', color: '#475569', marginBottom: 4, fontWeight: 700 }}>Directions</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(entite.directions || []).map((dir) => (
                        <span key={dir.id_direction} style={{ background: '#e2e8f0', color: '#021630', padding: '3px 8px', borderRadius: '20px', fontSize: '0.74rem' }}>
                          {dir.nom} ({dir.departements_count || 0})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {openEntiteDepartements[entite.id_entite] && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: '0.76rem', color: '#475569', marginBottom: 4, fontWeight: 700 }}>Départements</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(entite.departements || []).map((dept) => (
                        <span key={dept.dept_id} style={{ background: '#e2e8f0', color: '#021630', padding: '3px 8px', borderRadius: '20px', fontSize: '0.74rem' }}>
                          {dept.nom}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Directions Tab */}
      {activeTab === 'directions' && !loading && (
        <div>
          {canEditAdmin && (
            <div className="card" style={{ marginBottom: 12, padding: 14 }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#021630', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <GitBranch size={15}/> {editingDirectionId ? "Modifier la direction" : "Ajouter une direction"}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  value={directionForm.nom}
                  onChange={e => setDirectionForm(prev => ({ ...prev, nom: e.target.value }))}
                  placeholder="Nom de la direction"
                  style={{ flex: 2, minWidth: 200, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.85rem' }}
                />
                <select
                  value={directionForm.id_entite}
                  onChange={e => setDirectionForm(prev => ({ ...prev, id_entite: e.target.value }))}
                  style={{ flex: 1, minWidth: 160, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.85rem' }}
                >
                  <option value="">— Entité —</option>
                  {entitesData.map(e => <option key={e.id_entite} value={e.id_entite}>{e.nom}</option>)}
                </select>
                <button onClick={submitDirection} disabled={savingDirection} style={{ background: '#021630', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}>
                  <Plus size={13}/> {editingDirectionId ? "Mettre à jour" : "Ajouter"}
                </button>
                {editingDirectionId && (
                  <button onClick={resetDirectionForm} style={{ background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}>
                    <X size={13}/> {"Annuler"}
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="card" style={{ marginBottom: 8, padding: '10px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: '#334155', fontWeight: 600 }}>Trier par</span>
            <select value={sortDirectionBy} onChange={(e) => setSortDirectionBy(e.target.value)} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.82rem' }}>
              <option value="nom">Nom</option>
              <option value="entite">Entité</option>
              <option value="departements">Nombre de départements</option>
            </select>
            <span style={{ fontSize: '0.82rem', color: '#334155', fontWeight: 600 }}>Valeur</span>
            <select value={sortDirectionValue} onChange={(e) => setSortDirectionValue(e.target.value)} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.82rem', minWidth: 170 }}>
              <option value="all">Toutes</option>
              {directionValueOptions.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {sortedDirections.map((direction) => (
              <div key={direction.id_direction} className="card" style={{ borderLeft: '4px solid #021630', padding: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', color: '#021630', display:'flex', alignItems:'center', gap:6, fontSize: '0.92rem' }}>
                      <GitBranch size={15}/> {direction.nom} <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 400 }}>(ID: {direction.id_direction})</span>
                    </h3>
                    <p style={{ margin: 0, color: '#666', fontSize: '0.8rem' }}>
                      Entité: <strong>{direction.entite_nom}</strong>
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button onClick={() => toggleOpen(setOpenDirectionDepartements, direction.id_direction)} style={{ background: '#e2e8f0', color: '#021630', padding: '4px 9px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '600', border: 'none', cursor: 'pointer' }} title="Afficher/masquer les départements">
                      {direction.departements_count} département{direction.departements_count !== 1 ? 's' : ''}
                    </button>
                    {canEditAdmin && (
                      <>
                        <button onClick={() => startEditDirection(direction)} style={{ background: '#021630', color: 'white', border: 'none', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.77rem' }}>
                          <Pencil size={12}/> {"Modifier"}
                        </button>
                        <button onClick={() => deleteDirection(direction)} style={{ background: '#ce2b2b', color: 'white', border: 'none', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.77rem' }}>
                          <Trash2 size={12}/> {"Supprimer"}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {openDirectionDepartements[direction.id_direction] && (
                  <div>
                    <h4 style={{ margin: '0 0 8px 0', color: '#475569', fontSize: '0.9rem' }}>Départements:</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {departementsData.filter((d) => String(d.id_direction) === String(direction.id_direction)).map((dept) => (
                        <span key={dept.dept_id} style={{ background: '#e2e8f0', color: '#021630', padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem' }}>
                          {dept.nom}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Départements Tab */}
      {activeTab === 'departements' && !loading && (
        <div>
          {canEditAdmin && (
            <div className="card" style={{ marginBottom: 12, padding: 14 }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#021630', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <LayoutGrid size={15}/> {editingDeptId ? "Modifier le département" : "Ajouter un département"}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  value={deptForm.nom}
                  onChange={e => setDeptForm(prev => ({ ...prev, nom: e.target.value }))}
                  placeholder="Nom du département"
                  style={{ flex: 2, minWidth: 180, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.85rem' }}
                />
                <select value={deptForm.id_entite} onChange={e => handleDeptEntiteChange(e.target.value)} style={{ flex: 1, minWidth: 140, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.85rem' }}>
                  <option value="">— Entité —</option>
                  {entitesData.map(e => <option key={e.id_entite} value={e.id_entite}>{e.nom}</option>)}
                </select>
                <select value={deptForm.id_direction} onChange={e => setDeptForm(prev => ({ ...prev, id_direction: e.target.value }))} style={{ flex: 1, minWidth: 140, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.85rem' }}>
                  <option value="">— Direction (optionnel) —</option>
                  {directionsData.filter(d => !deptForm.id_entite || String(d.id_entite) === String(deptForm.id_entite)).map(d => <option key={d.id_direction} value={d.id_direction}>{d.nom}</option>)}
                </select>
                {!editingDeptId && availableVilles.length > 0 && (
                  <div style={{ width: '100%', marginTop: 6 }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>
                      Villes de présence (optionnel) :
                    </p>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {availableVilles.map(v => (
                        <label key={v.id_localisation} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.82rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={deptVillesIds.includes(v.id_localisation)}
                            onChange={() => toggleDeptVille(v.id_localisation)}
                          />
                          {v.ville}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <button onClick={submitDept} disabled={savingDept} style={{ background: '#021630', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}>
                  <Plus size={13}/> {editingDeptId ? "Mettre à jour" : "Ajouter"}
                </button>
                {editingDeptId && (
                  <button onClick={resetDeptForm} style={{ background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}>
                    <X size={13}/> {"Annuler"}
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="card" style={{ marginBottom: 8, padding: '10px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: '#334155', fontWeight: 600 }}>Trier par</span>
            <select value={sortDepartementBy} onChange={(e) => setSortDepartementBy(e.target.value)} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.82rem' }}>
              <option value="nom">Nom</option>
              <option value="entite">Entité</option>
              <option value="direction">Direction</option>
            </select>
            <span style={{ fontSize: '0.82rem', color: '#334155', fontWeight: 600 }}>Valeur</span>
            <select value={sortDepartementValue} onChange={(e) => setSortDepartementValue(e.target.value)} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.82rem', minWidth: 170 }}>
              <option value="all">Toutes</option>
              {departementValueOptions.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {sortedDepartements.map((dept) => (
              <div key={dept.dept_id} className="card" style={{ borderLeft: '4px solid #6b7280', padding: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, flex: 1 }}>
                    <div>
                      <h4 style={{ margin: 0, color: '#021630', fontSize: '0.9rem' }}>{dept.nom}</h4>
                      <p style={{ margin: '2px 0 0 0', color: '#666', fontSize: '0.75rem' }}>ID: {dept.dept_id}</p>
                    </div>
                    <div>
                      <p style={{ margin: 0, color: '#666', fontSize: '0.75rem' }}>Entité</p>
                      <p style={{ margin: '2px 0 0 0', fontWeight: '600', color: '#021630', fontSize: '0.82rem' }}>{dept.entite_nom}</p>
                    </div>
                    <div>
                      <p style={{ margin: 0, color: '#666', fontSize: '0.75rem' }}>Direction</p>
                      <p style={{ margin: '2px 0 0 0', fontWeight: '600', color: '#021630', fontSize: '0.82rem' }}>{dept.direction_nom}</p>
                    </div>
                  </div>
                  {canEditAdmin && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => startEditDept(dept)} style={{ background: '#021630', color: 'white', border: 'none', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.77rem' }}>
                        <Pencil size={12}/> {"Modifier"}
                      </button>
                      <button onClick={() => deleteDept(dept)} style={{ background: '#ce2b2b', color: 'white', border: 'none', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.77rem' }}>
                        <Trash2 size={12}/> {"Supprimer"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fonctions Tab */}
      {activeTab === 'fonctions' && !loading && (
        <div>
          <style>{`
            @keyframes fonctionFormPulse {
              0%   { box-shadow: 0 0 0 0 rgba(206,43,43,0.55), 0 2px 8px rgba(0,0,0,0.08); border-color: #ce2b2b; }
              40%  { box-shadow: 0 0 0 10px rgba(206,43,43,0.12), 0 2px 16px rgba(206,43,43,0.18); border-color: #ce2b2b; }
              100% { box-shadow: 0 2px 8px rgba(0,0,0,0.08); border-color: transparent; }
            }
            .fonction-form-highlight {
              animation: fonctionFormPulse 1.5s ease-out forwards;
              border: 2px solid #ce2b2b !important;
            }
          `}</style>
          <div
            ref={fonctionFormRef}
            className={`card${fonctionFormHighlight ? ' fonction-form-highlight' : ''}`}
            style={{ marginBottom: 20 }}>
            <h3 style={{ marginTop: 0, marginBottom: 12, color: '#021630', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Briefcase size={16}/> Référentiel des fonctions
            </h3>
            {canManageAdministration && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    value={fonctionForm.libelle}
                    onChange={(e) => setFonctionForm(f => ({ ...f, libelle: e.target.value }))}
                    placeholder="Saisir le libellé de la fonction"
                    style={{ flex: 1, minWidth: 260, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8 }}
                  />
                  <select
                    value={fonctionForm.id_direction}
                    onChange={(e) => setFonctionForm(f => ({ ...f, id_direction: e.target.value }))}
                    style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, minWidth: 180 }}
                  >
                    <option value="">— Aucune direction —</option>
                    {directionsData.map(d => <option key={d.id_direction} value={d.id_direction}>{d.nom}</option>)}
                  </select>
                  <select
                    value={fonctionForm.dept_id}
                    onChange={(e) => setFonctionForm(f => ({ ...f, dept_id: e.target.value }))}
                    style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, minWidth: 180 }}
                  >
                    <option value="">— Aucun département —</option>
                    {departementsData.map(d => <option key={d.dept_id} value={d.dept_id}>{d.nom}</option>)}
                  </select>
                  <button
                    onClick={submitFonction}
                    disabled={savingFonction}
                    style={{ background: '#ce2b2b', color: 'white', border: 'none', borderRadius: 8, padding: '10px 14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Plus size={14}/> {editingFonctionId ? "Mettre à jour" : "Ajouter"}
                  </button>
                  {editingFonctionId && (
                    <button
                      onClick={resetFonctionForm}
                      style={{ background: '#e5e7eb', color: 'var(--text)', border: 'none', borderRadius: 8, padding: '10px 14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <X size={14}/> {"Annuler"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {fonctionsData.length === 0 ? (
              <div className="card" style={{ color: 'var(--text-secondary)' }}>Aucune fonction de référence</div>
            ) : (
              fonctionsData.map((f) => (
                <div key={f.id_fonction} className="card" style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderLeft: '6px solid #021630' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>{f.libelle}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 2 }}>ID: {f.id_fonction}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      {f.direction_nom && (
                        <span style={{ padding: '1px 7px', borderRadius: 99, background: '#eff6ff', color: '#2563eb', fontSize: '0.75rem', fontWeight: 600 }}>Dir. {f.direction_nom}</span>
                      )}
                      {f.dept_nom && (
                        <span style={{ padding: '1px 7px', borderRadius: 99, background: '#f0fdf4', color: '#16a34a', fontSize: '0.75rem', fontWeight: 600 }}>Dépt. {f.dept_nom}</span>
                      )}
                    </div>
                  </div>
                  {canManageAdministration && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => startEditFonction(f)}
                        style={{ background: '#021630', color: 'white', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <Pencil size={13}/> {"Modifier"}
                      </button>
                      <button
                        onClick={() => deleteFonction(f)}
                        style={{ background: '#ce2b2b', color: 'white', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <Trash2 size={13}/> {"Supprimer"}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Organigramme Tab */}
      {activeTab === 'organigramme' && !loading && (
        <div>
          <OrgChart />
        </div>
      )}

      {/* CI/CD Tab (ADMIN uniquement) */}
      {activeTab === 'ci' && isAdmin && (
        <div>
          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#021630', display:'flex', alignItems:'center', gap: 8 }}>
                <Activity size={18}/> {"Statut du pipeline CI/CD"}
              </div>
              <button
                onClick={loadCiStatus}
                disabled={ciLoading}
                style={{ background:'white', border:'1px solid #ccc', borderRadius: 6, padding:'6px 10px', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6, fontSize:'0.8rem' }}
              >
                <RefreshCw size={13} className={ciLoading ? 'spin' : ''}/> {"Actualiser"}
              </button>
            </div>

            {ciLoading && <div style={{ color:'#666', padding: 12 }}>{"Chargement..."}</div>}

            {!ciLoading && ciStatus?.error && (
              <div style={{ background:'#fef2f2', border:'1px solid #fecaca', color:'#991b1b', padding: 12, borderRadius: 6, fontSize:'0.85rem' }}>
                {ciStatus.error}
              </div>
            )}

            {!ciLoading && ciStatus && !ciStatus.error && !ciStatus.configured && (
              <div style={{ background:'#fffbeb', border:'1px solid #fde68a', color:'#92400e', padding: 12, borderRadius: 6, fontSize:'0.85rem' }}>
                {ciStatus.message || "Configuration GitHub manquante."}
                <div style={{ marginTop: 6, fontSize:'0.78rem', color:'#78350f' }}>
                  {"Variables à définir côté backend : GITHUB_OWNER, GITHUB_REPO, GITHUB_PAT"}
                </div>
              </div>
            )}

            {!ciLoading && ciStatus?.configured && !ciStatus.has_run && (
              <div style={{ color:'#666', fontSize:'0.85rem' }}>{"Aucune exécution du workflow CI pour le moment."}</div>
            )}

            {!ciLoading && ciStatus?.configured && ciStatus.has_run && (() => {
              const conc = ciStatus.conclusion || ciStatus.status
              const isSuccess = conc === 'success'
              const isFailure = conc === 'failure' || conc === 'cancelled' || conc === 'timed_out'
              const isRunning = ciStatus.status === 'in_progress' || ciStatus.status === 'queued' || ciStatus.status === 'waiting'
              const bg = isSuccess ? '#dcfce7' : isFailure ? '#fee2e2' : isRunning ? '#fef3c7' : '#f1f5f9'
              const fg = isSuccess ? '#166534' : isFailure ? '#991b1b' : isRunning ? '#92400e' : '#334155'
              const label = isSuccess ? 'Succès' : isFailure ? 'Échec' : isRunning ? 'En cours' : (conc || '—')
              return (
                <div>
                  <div style={{ display:'flex', gap: 12, flexWrap:'wrap', alignItems:'center' }}>
                    <span style={{ background: bg, color: fg, padding:'6px 12px', borderRadius: 999, fontWeight: 700, fontSize:'0.82rem' }}>
                      {label}
                    </span>
                    <span style={{ fontSize:'0.85rem', color:'#021630' }}>
                      <strong>{ciStatus.name || 'CI'}</strong>{" sur "}<code style={{ background:'#f1f5f9', padding:'2px 6px', borderRadius: 4 }}>{ciStatus.head_branch || '—'}</code>
                    </span>
                    <span style={{ fontSize:'0.82rem', color:'#64748b' }}>
                      {"par "}{ciStatus.actor || '—'}
                    </span>
                    <span style={{ fontSize:'0.82rem', color:'#64748b' }}>
                      {ciStatus.created_at ? new Date(ciStatus.created_at).toLocaleString('fr-FR') : '—'}
                    </span>
                  </div>
                </div>
              )
            })()}

            <div style={{ display:'flex', gap: 8, marginTop: 14, flexWrap:'wrap' }}>
              {ciStatus?.html_url && (
                <a href={ciStatus.html_url} target="_blank" rel="noopener noreferrer" style={{ background:'#021630', color:'white', padding:'8px 12px', borderRadius: 6, textDecoration:'none', fontSize:'0.82rem', display:'inline-flex', alignItems:'center', gap:6 }}>
                  <ExternalLink size={13}/> {"Voir ce run"}
                </a>
              )}
              {ciStatus?.actions_url && (
                <a href={ciStatus.actions_url} target="_blank" rel="noopener noreferrer" style={{ background:'white', color:'#021630', border:'1px solid #021630', padding:'8px 12px', borderRadius: 6, textDecoration:'none', fontSize:'0.82rem', display:'inline-flex', alignItems:'center', gap:6 }}>
                  <ExternalLink size={13}/> {"GitHub Actions"}
                </a>
              )}
            </div>
          </div>

          <div className="card" style={{ padding: 14, fontSize:'0.85rem', color:'#334155' }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{"Gestion avancée CI/CD, backups et déploiements"}</div>
            <div>{"Pour le pipeline complet (versioning, releases, backups manuels, tests E2E, rollback), utilisez l'application locale "}<strong>{"DevOps Manager"}</strong>{" située dans "}<code>{"extranet/devops-manager/"}</code>{". Lancez "}<code>{"start.bat"}</code>{" puis ouvrez "}<code>{"http://localhost:9000"}</code>{"."}</div>
          </div>
        </div>
      )}
    </div>
  )
}
