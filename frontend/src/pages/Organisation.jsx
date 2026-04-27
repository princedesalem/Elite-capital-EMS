import React, { useState, useEffect, useMemo } from 'react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { Building2, Globe, MapPin, Plus, Pencil, Trash2, ChevronDown, ChevronRight, ArrowLeft, GitBranch, LayoutGrid, X } from 'lucide-react'
import '../styles/Organisation.css'
import { toast, confirmDialog } from '../components/ui/bridge'


export default function Organisation() {
  const { user } = useAuth()
  const roleUtilisateur = useMemo(() => String(user?.role || '').toUpperCase(), [user])
  const peutModifierOrganisation = useMemo(
    () => ['ADMIN', 'DG', 'PCA', 'AG'].includes(roleUtilisateur),
    [roleUtilisateur]
  )

  const [pays, setPays] = useState([])
  const [villes, setVilles] = useState([])
  const [selectedPays, setSelectedPays] = useState(null)
  const [selectedVille, setSelectedVille] = useState(null)
  const [activeTab, setActiveTab] = useState('entites')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Data for organization structure
  const [entitesData, setEntitesData] = useState([])
  const [directionsData, setDirectionsData] = useState([])
  const [departementsData, setDepartementsData] = useState([])
  const [selectedEntite, setSelectedEntite] = useState(null)
  const [selectedDirection, setSelectedDirection] = useState(null)

  // Sort and filter options
  const [sortDirectionsBy, setSortDirectionsBy] = useState('nom') // 'nom' or 'entite'
  const [filterDirectionsByEntite, setFilterDirectionsByEntite] = useState('') // filter directions by entite
  const [sortDepartmentsBy, setSortDepartmentsBy] = useState('nom') // 'nom', 'entite', or 'direction'
  const [filterDepartmentsBy, setFilterDepartmentsBy] = useState('') // filter departments - can be by entite or direction

  // Modals and inputs
  const [showAddPaysModal, setShowAddPaysModal] = useState(false)
  const [showAddVilleModal, setShowAddVilleModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(null)
  const [showEditModal, setShowEditModal] = useState(null)
  const [showLinkDeptModal, setShowLinkDeptModal] = useState(false)
  const [linkableDepts, setLinkableDepts] = useState([])
  const [linkDeptId, setLinkDeptId] = useState('')
  const [editingItem, setEditingItem] = useState(null)
  const [newPaysQuery, setNewPaysQuery] = useState('')
  const [newVilleQuery, setNewVilleQuery] = useState('')
  const [worldCountries, setWorldCountries] = useState([])
  const [worldCities, setWorldCities] = useState([])
  const [createForm, setCreateForm] = useState({ nom: '', id_entite: '', id_direction: '' })
  const [editForm, setEditForm] = useState({ nom: '', id_entite: '', id_direction: '' })

  // Initial load
  useEffect(() => {
    loadPays()
  }, [])

  // Load pays
  const loadPays = async () => {
    try {
      const res = await api.get('/employees/pays-avec-entites')
      setPays(res.data || [])
      setSelectedPays(null)
      setSelectedVille(null)
    } catch (err) {
      setError('Erreur chargement pays: ' + (err.response?.data?.detail || err.message))
    }
  }

  // Load villes by pays
  const loadVillesByPays = async (id_pays) => {
    try {
      const res = await api.get(`/employees/pays/${id_pays}/villes-avec-entites`)
      setVilles(res.data || [])
    } catch (err) {
      setError('Erreur chargement villes: ' + (err.response?.data?.detail || err.message))
    }
  }

  // Handle select pays
  const handleSelectPaysForVille = (p) => {
    setSelectedPays(p)
    setSelectedVille(null)
    setSelectedEntite(null)
    setSelectedDirection(null)
    loadVillesByPays(p.id_pays)
  }

  // Handle select ville - load organization structure
  const handleSelectLocation = async (ville) => {
    setSelectedVille(ville)
    setSelectedEntite(null)
    setSelectedDirection(null)
    setActiveTab('entites')
    await loadDataByTab('entites', ville.id_localisation)
  }

  // Load data based on active tab
  const loadDataByTab = async (tab, villeId) => {
    try {
      setLoading(true)
      if (tab === 'entites') {
        // Load ALL entites from database with nested directions
        const res = await api.get(`/employees/entites?id_localisation=${villeId}`)
        setEntitesData(res.data || [])
      } else if (tab === 'directions') {
        // Load ALL directions from database with nested departements
        const res = await api.get(`/employees/directions?id_localisation=${villeId}`)
        setDirectionsData(res.data || [])
      } else if (tab === 'departements') {
        // Load ALL departements from database
        const res = await api.get(`/employees/departements?id_localisation=${villeId}`)
        setDepartementsData(res.data || [])
      }
    } catch (err) {
      setError('Erreur chargement données: ' + (err.response?.data?.detail || err.message))
    } finally {
      setLoading(false)
    }
  }

  // Search world countries
  const searchWorldCountries = async (query) => {
    if (!query.trim()) {
      setWorldCountries([])
      return
    }
    try {
      const res = await api.get(`/employees/world-countries/search?q=${query}`)
      setWorldCountries(res.data || [])
    } catch (err) {
      console.error('Search error:', err)
      setWorldCountries([])
    }
  }

  // Search world cities
  const searchWorldCities = async (query) => {
    if (!query.trim() || !selectedPays) {
      setWorldCities([])
      return
    }
    try {
      const res = await api.get(`/employees/world-cities/search?country_code=${selectedPays.code_pays}&q=${query}`)
      setWorldCities(res.data || [])
    } catch (err) {
      console.error('Search error:', err)
      setWorldCities([])
    }
  }

  // Handle add pays
  const handleAddPays = async (country) => {
    const exists = pays.find((p) => p.code_pays.toUpperCase() === country.code.toUpperCase())
    if (exists) {
      toast.warning('Ce pays est déjà présent')
      return
    }

    try {
      await api.post('/employees/pays', {
        nom_pays: country.name,
        code_pays: country.code,
      })
      setNewPaysQuery('')
      setWorldCountries([])
      setShowAddPaysModal(false)
      await loadPays()
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message)
    }
  }

  // Handle add ville
  const handleAddVille = async (city) => {
    if (!selectedPays) {
      toast.warning('Sélectionnez un pays d’abord')
      return
    }

    const exists = villes.find((v) => v.ville.toLowerCase() === city.name.toLowerCase())
    if (exists) {
      toast.warning('Cette ville est déjà présente')
      return
    }

    try {
      await api.post('/employees/villes', {
        nom: city.name,
        id_pays: selectedPays.id_pays,
      })
      setNewVilleQuery('')
      setWorldCities([])
      setShowAddVilleModal(false)
      await loadVillesByPays(selectedPays.id_pays)
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message)
    }
  }

  // Handle create item
  const handleCreateItem = async (e) => {
    e.preventDefault()
    try {
      if (showCreateModal === 'entite') {
        await api.post('/employees/entites', { 
          nom: createForm.nom,
          id_localisation: selectedVille?.id_localisation
        })
      } else if (showCreateModal === 'direction') {
        await api.post('/employees/directions', {
          nom: createForm.nom,
          id_entite: parseInt(createForm.id_entite),
          id_localisation: selectedVille?.id_localisation,
        })
      } else if (showCreateModal === 'departement') {
        await api.post('/employees/departements', {
          nom: createForm.nom,
          id_direction: parseInt(createForm.id_direction),
          id_entite: parseInt(createForm.id_entite),
          id_localisation: selectedVille?.id_localisation,
        })
      }
      setCreateForm({ nom: '', id_entite: '', id_direction: '' })
      setShowCreateModal(null)
      if (selectedVille) {
        await loadDataByTab(activeTab, selectedVille.id_localisation)
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message)
    }
  }

  // Delete pays
  const handleDeletePays = async (id_pays, e) => {
    e.stopPropagation()
    const ok = await confirmDialog({ title: 'Supprimer le pays', message: 'Êtes-vous sûr de vouloir supprimer ce pays ?', variant: 'danger', confirmLabel: 'Supprimer' })
    if (ok) {
      try {
        await api.delete(`/employees/pays/${id_pays}`)
        await loadPays()
      } catch (err) {
        toast.error(err.response?.data?.detail || err.message)
      }
    }
  }

  // Delete ville
  const handleDeleteVille = async (id_localisation, e) => {
    e.stopPropagation()
    const ok = await confirmDialog({ title: 'Supprimer la ville', message: 'Êtes-vous sûr de vouloir supprimer cette ville ?', variant: 'danger', confirmLabel: 'Supprimer' })
    if (ok) {
      try {
        await api.delete(`/employees/villes/${id_localisation}`)
        if (selectedPays) {
          await loadVillesByPays(selectedPays.id_pays)
        }
      } catch (err) {
        toast.error(err.response?.data?.detail || err.message)
      }
    }
  }

  // Open create modal and load necessary data
  const handleOpenCreateModal = async (type) => {
    // Load entites for direction and departement modals
    if (type === 'direction' || type === 'departement') {
      if (entitesData.length === 0) {
        const res = selectedVille
          ? await api.get(`/employees/entites?id_localisation=${selectedVille.id_localisation}`)
          : await api.get('/employees/entites')
        setEntitesData(res.data || [])
      }
    }
    // Load directions for departement modal
    if (type === 'departement') {
      if (directionsData.length === 0) {
        const res = selectedVille
          ? await api.get(`/employees/directions?id_localisation=${selectedVille.id_localisation}`)
          : await api.get('/employees/directions')
        setDirectionsData(res.data || [])
      }
    }
    setShowCreateModal(type)
  }

  // Handle edit item
  const handleEditItem = async (type, item) => {
    setEditingItem({ type, ...item })
    setEditForm({ nom: item.nom, id_entite: item.id_entite || '', id_direction: item.id_direction || '' })
    
    // Load necessary data if not loaded
    if (type === 'direction' || type === 'departement') {
      if (entitesData.length === 0) {
        const res = selectedVille
          ? await api.get(`/employees/entites?id_localisation=${selectedVille.id_localisation}`)
          : await api.get('/employees/entites')
        setEntitesData(res.data || [])
      }
    }
    if (type === 'departement') {
      if (directionsData.length === 0) {
        const res = selectedVille
          ? await api.get(`/employees/directions?id_localisation=${selectedVille.id_localisation}`)
          : await api.get('/employees/directions')
        setDirectionsData(res.data || [])
      }
    }
    setShowEditModal(type)
  }

  // Handle update item
  const handleUpdateItem = async (e) => {
    e.preventDefault()
    try {
      const type = showEditModal
      if (type === 'entite') {
        await api.put(`/employees/entites/${editingItem.id_entite}`, { nom: editForm.nom })
      } else if (type === 'direction') {
        await api.put(`/employees/directions/${editingItem.id_direction}`, {
          nom: editForm.nom,
          id_entite: parseInt(editForm.id_entite),
          id_localisation: selectedVille?.id_localisation,
        })
      } else if (type === 'departement') {
        await api.put(`/employees/departements/${editingItem.dept_id}`, {
          nom: editForm.nom,
          id_entite: parseInt(editForm.id_entite),
          id_direction: editForm.id_direction ? parseInt(editForm.id_direction) : null,
          id_localisation: selectedVille?.id_localisation,
        })
      }
      setEditForm({ nom: '', id_entite: '', id_direction: '' })
      setEditingItem(null)
      setShowEditModal(null)
      if (selectedVille) {
        await loadDataByTab(activeTab, selectedVille.id_localisation)
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message)
    }
  }

  // Handle delete item
  const handleDeleteItem = async (type, id) => {
    const ok = await confirmDialog({ title: 'Supprimer', message: 'Êtes-vous sûr de vouloir supprimer cet élément ?', variant: 'danger', confirmLabel: 'Supprimer' })
    if (ok) {
      try {
        if (type === 'entite') {
          await api.delete(`/employees/entites/${id}`)
        } else if (type === 'direction') {
          await api.delete(`/employees/directions/${id}`)
        } else if (type === 'departement') {
          await api.delete(`/employees/departements/${id}`)
        }
        if (selectedVille) {
          await loadDataByTab(activeTab, selectedVille.id_localisation)
        }
      } catch (err) {
        toast.error(err.response?.data?.detail || err.message)
      }
    }
  }

  // Unlink a department from the current city (does NOT delete the dept globally)
  const handleUnlinkDept = async (dept) => {
    const ok = await confirmDialog({
      title: 'Retirer le département',
      message: `Retirer «${dept.nom}» de ${selectedVille?.ville} ? Le département reste dans l’Administration.`,
      variant: 'warning',
      confirmLabel: 'Retirer',
    })
    if (!ok) return
    try {
      await api.delete(`/employees/departements/${dept.dept_id}/villes/${selectedVille.id_localisation}`)
      await loadDataByTab('departements', selectedVille.id_localisation)
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message)
    }
  }

  // Open "Lier un département existant" modal
  const handleOpenLinkDeptModal = async () => {
    try {
      const [allRes, entitesRes] = await Promise.all([
        api.get('/employees/departements'),
        api.get(`/employees/entites?id_localisation=${selectedVille.id_localisation}`),
      ])
      const linkedIds = new Set(departementsData.map((d) => d.dept_id))
      const implantedEntiteIds = new Set(entitesRes.data.map((e) => e.id_entite))
      const linkable = (allRes.data || []).filter(
        (d) => implantedEntiteIds.has(d.id_entite) && !linkedIds.has(d.dept_id)
      )
      setLinkableDepts(linkable)
      setLinkDeptId('')
      setShowLinkDeptModal(true)
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message)
    }
  }

  // Confirm link from modal
  const handleLinkDept = async () => {
    if (!linkDeptId) return
    try {
      await api.post(`/employees/departements/${linkDeptId}/villes/${selectedVille.id_localisation}`)
      setShowLinkDeptModal(false)
      setLinkDeptId('')
      await loadDataByTab('departements', selectedVille.id_localisation)
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message)
    }
  }

  // Sort directions based on selected sort option
  const getSortedDirections = () => {
    let filtered = [...directionsData]
    
    // Apply entite filter if selected
    if (filterDirectionsByEntite) {
      filtered = filtered.filter(d => d.entite_nom === filterDirectionsByEntite)
    }

    if (sortDirectionsBy === 'entite') {
      return filtered.sort((a, b) => (a.entite_nom || '').localeCompare(b.entite_nom || ''))
    }
    return filtered.sort((a, b) => a.nom.localeCompare(b.nom))
  }

  const sortedDirections = getSortedDirections()

  // Sort departments based on selected sort option
  const getSortedDepartments = () => {
    let filtered = [...departementsData]
    
    // Apply filter based on sort type
    if (sortDepartmentsBy === 'entite' && filterDepartmentsBy) {
      filtered = filtered.filter(d => d.entite_nom === filterDepartmentsBy)
    } else if (sortDepartmentsBy === 'direction' && filterDepartmentsBy) {
      filtered = filtered.filter(d => d.direction_nom === filterDepartmentsBy)
    }

    // Apply sort
    if (sortDepartmentsBy === 'entite') {
      return filtered.sort((a, b) => (a.entite_nom || '').localeCompare(b.entite_nom || ''))
    } else if (sortDepartmentsBy === 'direction') {
      return filtered.sort((a, b) => (a.direction_nom || '').localeCompare(b.direction_nom || ''))
    }
    return filtered.sort((a, b) => a.nom.localeCompare(b.nom))
  }

  const sortedDepartments = getSortedDepartments()

  // Get filter options based on sort type
  const getDepartmentFilterOptions = () => {
    if (sortDepartmentsBy === 'entite') {
      const entities = new Set(departementsData.map(d => d.entite_nom).filter(Boolean))
      return Array.from(entities).sort()
    } else if (sortDepartmentsBy === 'direction') {
      const directions = new Set(departementsData.map(d => d.direction_nom).filter(Boolean))
      return Array.from(directions).sort()
    }
    return []
  }

  const getDepartmentFilterLabel = () => {
    if (sortDepartmentsBy === 'entite') return 'Entité'
    if (sortDepartmentsBy === 'direction') return 'Direction'
    return 'Filtrer'
  }

  // Reset filter when sort changes
  useEffect(() => {
    setFilterDepartmentsBy('')
  }, [sortDepartmentsBy])

  useEffect(() => {
    setFilterDirectionsByEntite('')
  }, [sortDirectionsBy])

  return (
    <div className="organisation-container">
      <header className="org-header">
        <h1 style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Building2 size={20} /> {"Organisation"}</h1>
        <p>Gestion des Pays, Villes et Structure Organisationnelle</p>
      </header>

      <div className="org-content">
        {/* Page 1: Pays Selection */}
        {!selectedPays ? (
          <div className="pays-view">
            <div className="section-card">
              <div className="section-header">
                <h2 style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Globe size={18} /> Pays</h2>
                {peutModifierOrganisation && (
                  <button className="btn-add" onClick={() => setShowAddPaysModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={14} /> Ajouter un pays
                  </button>
                )}
              </div>

              {/* Pays Buttons */}
              <div className="pays-buttons-group">
                {pays.length === 0 ? (
                  <p className="empty-state">Aucun pays disponible</p>
                ) : (
                  <>
                    {pays.map((p) => (
                      <div
                        key={p.id_pays}
                        className="pays-button"
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelectPaysForVille(p)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSelectPaysForVille(p)}
                      >
                        <span className="pays-button-flag">{p.code_pays}</span>
                        <div className="pays-button-info">
                          <span className="pays-button-name">{p.nom_pays}</span>
                          <span className="pays-button-code">{p.code_pays}</span>
                        </div>
                        {peutModifierOrganisation && (
                          <button
                            className="btn-delete-small"
                            onClick={(e) => handleDeletePays(p.id_pays, e)}
                            title="Supprimer"
                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                    {/* C3 — label informatif (pas un bouton) */}
                    <span
                      className="pays-autres-label"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '6px 12px',
                        marginLeft: 4,
                        color: '#64748b',
                        fontFamily: 'inherit',
                        fontStyle: 'italic',
                        fontSize: '0.85rem',
                        userSelect: 'none'
                      }}
                    >
                      et autres
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : !selectedVille ? (
          /* Page 2: Villes Selection */
          <div className="villes-view">
            <div className="section-card">
              <div className="villes-section">
                  <div className="section-header">
                    <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><MapPin size={16} /> Villes - {selectedPays.nom_pays}</h3>
                    {peutModifierOrganisation && (
                      <button className="btn-add" onClick={() => setShowAddVilleModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Plus size={14} /> Ajouter une ville
                      </button>
                    )}
                  </div>

                  {/* Villes Buttons */}
                  <div className="villes-buttons-group">
                    {villes.length === 0 ? (
                      <p className="empty-state">Aucune ville</p>
                    ) : (
                      villes.map((v) => (
                        <div
                          key={v.id_localisation}
                          className="ville-button"
                          role="button"
                          tabIndex={0}
                          onClick={() => handleSelectLocation(v)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSelectLocation(v)}
                        >
                          <span className="ville-button-flag">{selectedPays.code_pays}</span>
                          <div className="pays-button-info">
                            <span className="ville-button-name">{v.ville}</span>
                            <span className="ville-button-code">{selectedPays.code_pays}</span>
                          </div>
                          {peutModifierOrganisation && (
                            <button
                              className="btn-delete-small"
                              onClick={(e) => handleDeleteVille(v.id_localisation, e)}
                              title="Supprimer"
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Navigation Page 2 */}
                  <div className="navigation-buttons">
                    <button
                      className="btn-nav-back"
                      onClick={() => {
                        setSelectedPays(null)
                        setVilles([])
                      }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <ArrowLeft size={14} /> Retour aux Pays
                    </button>
                  </div>
                </div>
            </div>
          </div>
        ) : (
          /* Page 3: Organisation Structure */
          <div className="organisation-view">
            <div className="org-view-header">
              <div>
                <h2 style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><MapPin size={18} /> {selectedVille.ville}, {selectedPays.nom_pays}</h2>
                <p className="breadcrumb">Structure organisationnelle</p>
              </div>
            </div>

            {/* Tabs Navigation */}
            <div className="tabs-header">
              <button
                className={`tab-button ${activeTab === 'entites' ? 'active' : ''}`}
                onClick={async () => {
                  setActiveTab('entites')
                  setSelectedEntite(null)
                  setSelectedDirection(null)
                  await loadDataByTab('entites', selectedVille.id_localisation)
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Building2 size={14} /> Entités</span>
              </button>
              <button
                className={`tab-button ${activeTab === 'directions' ? 'active' : ''}`}
                onClick={async () => {
                  setActiveTab('directions')
                  setSelectedEntite(null)
                  setSelectedDirection(null)
                  await loadDataByTab('directions', selectedVille.id_localisation)
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><GitBranch size={14} /> Directions</span>
              </button>
              <button
                className={`tab-button ${activeTab === 'departements' ? 'active' : ''}`}
                onClick={async () => {
                  setActiveTab('departements')
                  setSelectedEntite(null)
                  setSelectedDirection(null)
                  await loadDataByTab('departements', selectedVille.id_localisation)
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><LayoutGrid size={14} /> Départements</span>
              </button>
            </div>

            {/* Tabs Content */}
            <div className="tabs-content">
              {loading ? (
                <div className="loading-state">{"Chargement..."}</div>
              ) : (
                <div>
                  {/* Entités Tab */}
                  {activeTab === 'entites' && (
                    <div className="tab-content">
                      <div className="content-header">
                        <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Building2 size={16} /> Entités</h3>
                        {peutModifierOrganisation && (
                          <button className="btn-add" onClick={() => handleOpenCreateModal('entite')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <Plus size={14} /> Créer entité
                          </button>
                        )}
                      </div>
                      <div className="data-container">
                        {entitesData.length === 0 ? (
                          <p className="empty-state">Aucune entité définie</p>
                        ) : (
                          entitesData.map((entite) => (
                            <div key={entite.id_entite} className="entite-card-tab">
                              <div className="card-header-with-actions">
                                <div
                                  className="entite-header-tab"
                                  onClick={() => setSelectedEntite(selectedEntite?.id_entite === entite.id_entite ? null : entite)}
                                  style={{ cursor: 'pointer', flex: 1 }}
                                >
                                  <div>
                                    <h4>{entite.nom}</h4>
                                  </div>
                                  <div>
                                    <span className="badge">{entite.directions_count || 0} direction(s)</span>
                                    <span className="expand-icon">
                                      {selectedEntite?.id_entite === entite.id_entite ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </span>
                                  </div>
                                </div>
                                {peutModifierOrganisation && (
                                  <div className="card-actions">
                                    <button
                                      className="btn-edit"
                                      onClick={() => handleEditItem('entite', entite)}
                                      title={"Modifier"}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                    >
                                      <Pencil size={13} /> {"Modifier"}
                                    </button>
                                    <button
                                      className="btn-delete"
                                      onClick={() => handleDeleteItem('entite', entite.id_entite)}
                                      title={"Supprimer"}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                    >
                                      <Trash2 size={13} /> {"Supprimer"}
                                    </button>
                                  </div>
                                )}
                              </div>
                              {selectedEntite?.id_entite === entite.id_entite && entite.directions && entite.directions.length > 0 && (
                                <div className="sub-items">
                                  <p className="sub-title">{entite.directions.length} direction(s)</p>
                                  <div className="directions-list">
                                    {entite.directions.map((dir) => (
                                      <div key={dir.id_direction} className="sub-item">
                                        <span>{dir.nom}</span>
                                        <span className="badge">{dir.departements_count || 0} dept</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Directions Tab */}
                  {activeTab === 'directions' && (
                    <div className="tab-content">
                      <div className="content-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: '6px' }}><GitBranch size={16} /> Directions ({sortedDirections.length})</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center' }}><ChevronDown size={16} /></span>
                          <select 
                            className="input"
                            value={sortDirectionsBy}
                            onChange={(e) => setSortDirectionsBy(e.target.value)}
                            style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', minWidth: '140px', fontSize: '0.9rem' }}
                          >
                            <option value="nom">Trier par Nom</option>
                            <option value="entite">Trier par Entité</option>
                          </select>
                          {sortDirectionsBy === 'entite' && (
                            <select 
                              className="input"
                              value={filterDirectionsByEntite}
                              onChange={(e) => setFilterDirectionsByEntite(e.target.value)}
                              style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', minWidth: '140px', fontSize: '0.9rem' }}
                            >
                              <option value="">Filtrer par Entité</option>
                              {Array.from(new Set(directionsData.map(d => d.entite_nom).filter(Boolean))).sort().map(ent => (
                                <option key={ent} value={ent}>{ent}</option>
                              ))}
                            </select>
                          )}
                          {peutModifierOrganisation && (
                            <button className="btn-add" onClick={() => handleOpenCreateModal('direction')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <Plus size={14} /> Créer
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="data-container">
                        {directionsData.length === 0 ? (
                          <p className="empty-state">Aucune direction définie</p>
                        ) : sortedDirections.length === 0 ? (
                          <p className="empty-state">Aucune direction trouvée avec les filtres appliqués</p>
                        ) : (
                          sortedDirections.map((direction) => (
                            <div key={direction.id_direction} className="direction-card-tab">
                              <div className="card-header-with-actions">
                                <div
                                  className="direction-header-tab"
                                  onClick={() => setSelectedDirection(selectedDirection?.id_direction === direction.id_direction ? null : direction)}
                                  style={{ cursor: 'pointer', flex: 1 }}
                                >
                                  <div>
                                    <h4>{direction.nom}</h4>
                                    <p className="code-label">{direction.entite_nom || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <span className="badge">{direction.departements_count || 0} dept</span>
                                    <span className="expand-icon">
                                      {selectedDirection?.id_direction === direction.id_direction ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </span>
                                  </div>
                                </div>
                                {peutModifierOrganisation && (
                                  <div className="card-actions">
                                    <button
                                      className="btn-edit"
                                      onClick={() => handleEditItem('direction', direction)}
                                      title={"Modifier"}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                    >
                                      <Pencil size={13} /> {"Modifier"}
                                    </button>
                                    <button
                                      className="btn-delete"
                                      onClick={() => handleDeleteItem('direction', direction.id_direction)}
                                      title={"Supprimer"}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                    >
                                      <Trash2 size={13} /> {"Supprimer"}
                                    </button>
                                  </div>
                                )}
                              </div>
                              {selectedDirection?.id_direction === direction.id_direction && direction.departements && direction.departements.length > 0 && (
                                <div className="sub-items">
                                  <p className="sub-title">{direction.departements.length} département(s)</p>
                                  <div className="departements-list">
                                    {direction.departements.map((dept) => (
                                      <div key={dept.dept_id} className="sub-item">
                                        <span>{dept.nom}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Départements Tab */}
                  {activeTab === 'departements' && (
                    <div className="tab-content">
                      <div className="content-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: '6px' }}><LayoutGrid size={16} /> Départements ({sortedDepartments.length})</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center' }}><ChevronDown size={16} /></span>
                          <select 
                            className="input"
                            value={sortDepartmentsBy}
                            onChange={(e) => setSortDepartmentsBy(e.target.value)}
                            style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', minWidth: '140px', fontSize: '0.9rem' }}
                          >
                            <option value="nom">Trier par Nom</option>
                            <option value="entite">Trier par Entité</option>
                            <option value="direction">Trier par Direction</option>
                          </select>
                          {getDepartmentFilterOptions().length > 0 && (
                            <select 
                              className="input"
                              value={filterDepartmentsBy}
                              onChange={(e) => setFilterDepartmentsBy(e.target.value)}
                              style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', minWidth: '140px', fontSize: '0.9rem' }}
                            >
                              <option value="">{`Filtrer par ${getDepartmentFilterLabel()}`}</option>
                              {getDepartmentFilterOptions().map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          )}
                          {peutModifierOrganisation && (
                            <>
                              <button className="btn-add" onClick={() => handleOpenLinkDeptModal()} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#6366f1' }}>
                                <Plus size={14} /> Lier
                              </button>
                              <button className="btn-add" onClick={() => handleOpenCreateModal('departement')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <Plus size={14} /> Créer
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="data-container">
                        {departementsData.length === 0 ? (
                          <p className="empty-state">Aucun département défini</p>
                        ) : sortedDepartments.length === 0 ? (
                          <p className="empty-state">Aucun département trouvé avec les filtres appliqués</p>
                        ) : (
                          sortedDepartments.map((dept) => (
                            <div key={dept.dept_id} className="departement-card-tab">
                              <div className="card-header-with-actions">
                                <div style={{ flex: 1 }}>
                                  <h4>{dept.nom}</h4>
                                  <p className="meta-info">
                                    {dept.entite_nom || 'N/A'} • {selectedVille?.ville || dept.localisation_nom || dept.direction_nom || 'N/A'}
                                  </p>
                                </div>
                                {peutModifierOrganisation && (
                                  <div className="card-actions">
                                    <button
                                      className="btn-edit"
                                      onClick={() => handleEditItem('departement', dept)}
                                      title={"Modifier"}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                    >
                                      <Pencil size={13} /> {"Modifier"}
                                    </button>
                                    <button
                                      className="btn-delete"
                                      onClick={() => handleUnlinkDept(dept)}
                                      title="Retirer de cette ville"
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f59e0b', color: '#fff' }}
                                    >
                                      <X size={13} /> Retirer
                                    </button>
                                    <button
                                      className="btn-delete"
                                      onClick={() => handleDeleteItem('departement', dept.dept_id)}
                                      title="Supprimer (global)"
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                    >
                                      <Trash2 size={13} /> {"Supprimer"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Navigation Page 3 */}
            <div className="navigation-buttons">
              <button
                className="btn-nav-back"
                onClick={() => {
                  setSelectedVille(null)
                  setSelectedEntite(null)
                  setSelectedDirection(null)
                  setActiveTab('entites')
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <ArrowLeft size={14} /> Retour aux Villes
              </button>
              <div className="tab-indicator">
                {selectedVille && `${selectedVille.ville} • ${selectedPays.nom_pays}`}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Add Pays */}
      {showAddPaysModal && (
        <div className="modal-overlay" onClick={() => setShowAddPaysModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Ajouter un pays</h2>
            <input
              type="text"
              placeholder="Tapez un nom de pays (ex: Congo, Cameroon)"
              value={newPaysQuery}
              onChange={(e) => {
                setNewPaysQuery(e.target.value)
                searchWorldCountries(e.target.value)
              }}
              className="modal-input"
              autoFocus
            />
            <div className="autocomplete-results">
              {worldCountries.length === 0 && newPaysQuery && (
                <p className="empty-state">Aucun pays trouvé</p>
              )}
              {worldCountries.map((country) => (
                <div
                  key={country.code}
                  className="autocomplete-item"
                  onClick={() => handleAddPays(country)}
                >
                  <div
                    className="autocomplete-color-badge"
                    style={{ background: getCountryGradient(country.code) }}
                  />
                  <span>{country.name}</span>
                  <span className="autocomplete-code">{country.code}</span>
                </div>
              ))}
            </div>
            <button className="btn-cancel" onClick={() => setShowAddPaysModal(false)}>
              {"Annuler"}
            </button>
          </div>
        </div>
      )}

      {/* Modal: Add Ville */}
      {showAddVilleModal && (
        <div className="modal-overlay" onClick={() => setShowAddVilleModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Ajouter une ville</h2>
            {!selectedPays && (
              <p className="warning-message">
                Sélectionnez d'abord un pays
              </p>
            )}
            {selectedPays && (
              <div>
                <p className="info-message">
                  Ajout d'une ville pour: <strong>{selectedPays.nom_pays}</strong>
                </p>
                <input
                  type="text"
                  placeholder="Tapez un nom de ville (ex: Yaoundé, Lagos)"
                  value={newVilleQuery}
                  onChange={(e) => {
                    setNewVilleQuery(e.target.value)
                    searchWorldCities(e.target.value)
                  }}
                  className="modal-input"
                  autoFocus
                />
                <div className="autocomplete-results">
                  {worldCities.length === 0 && newVilleQuery && (
                    <p className="empty-state">Aucune ville trouvée</p>
                  )}
                  {worldCities.map((city, idx) => (
                    <div
                      key={idx}
                      className="autocomplete-item"
                      onClick={() => handleAddVille(city)}
                    >
                      <div
                        className="autocomplete-color-badge"
                        style={{ background: getCountryGradient(city.country_code) }}
                      />
                      <span>{city.name}</span>
                      <span className="autocomplete-code">{city.country_code}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button className="btn-cancel" onClick={() => setShowAddVilleModal(false)}>
              {"Annuler"}
            </button>
          </div>
        </div>
      )}

      {/* Modal: Create Entity/Direction/Department */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>
              Créer {showCreateModal === 'entite' ? 'Entité' : showCreateModal === 'direction' ? 'Direction' : 'Département'}
            </h2>
            <form onSubmit={handleCreateItem}>
              <input
                type="text"
                placeholder="Nom"
                value={createForm.nom}
                onChange={(e) => setCreateForm({ ...createForm, nom: e.target.value })}
                className="modal-input"
                required
              />
              {showCreateModal === 'direction' && (
                <select
                  value={createForm.id_entite}
                  onChange={(e) => setCreateForm({ ...createForm, id_entite: e.target.value })}
                  className="modal-input"
                  required
                >
                  <option value="">-- Sélectionner une Entité --</option>
                  {entitesData.map((e) => (
                    <option key={e.id_entite} value={e.id_entite}>
                      {e.nom}
                    </option>
                  ))}
                </select>
              )}
              {showCreateModal === 'departement' && (
                <div>
                  <select
                    value={createForm.id_entite}
                    onChange={(e) => setCreateForm({ ...createForm, id_entite: e.target.value })}
                    className="modal-input"
                    required
                  >
                    <option value="">-- Sélectionner une Entité --</option>
                    {entitesData.map((e) => (
                      <option key={e.id_entite} value={e.id_entite}>
                        {e.nom}
                      </option>
                    ))}
                  </select>
                  <select
                    value={createForm.id_direction}
                    onChange={(e) => setCreateForm({ ...createForm, id_direction: e.target.value })}
                    className="modal-input"
                  >
                    <option value="">-- Sélectionner une Direction (optionnel) --</option>
                    {directionsData
                      .filter((d) => !createForm.id_entite || d.id_entite == createForm.id_entite)
                      .map((d) => (
                        <option key={d.id_direction} value={d.id_direction}>
                          {d.nom} ({d.entite_nom})
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <div className="modal-buttons">
                <button type="submit" className="btn-submit">
                  {"Créer"}
                </button>
                <button type="button" className="btn-cancel" onClick={() => setShowCreateModal(null)}>
                  {"Annuler"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Entity/Direction/Department */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>
              Modifier {showEditModal === 'entite' ? 'Entité' : showEditModal === 'direction' ? 'Direction' : 'Département'}
            </h2>
            <form onSubmit={handleUpdateItem}>
              <input
                type="text"
                placeholder="Nom"
                value={editForm.nom}
                onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })}
                className="modal-input"
                required
              />
              {showEditModal === 'direction' && (
                <select
                  value={editForm.id_entite}
                  onChange={(e) => setEditForm({ ...editForm, id_entite: e.target.value })}
                  className="modal-input"
                  required
                >
                  <option value="">-- Sélectionner une Entité --</option>
                  {entitesData.map((e) => (
                    <option key={e.id_entite} value={e.id_entite}>
                      {e.nom}
                    </option>
                  ))}
                </select>
              )}
              {showEditModal === 'departement' && (
                <div>
                  <select
                    value={editForm.id_entite}
                    onChange={(e) => setEditForm({ ...editForm, id_entite: e.target.value })}
                    className="modal-input"
                    required
                  >
                    <option value="">-- Sélectionner une Entité --</option>
                    {entitesData.map((e) => (
                      <option key={e.id_entite} value={e.id_entite}>
                        {e.nom}
                      </option>
                    ))}
                  </select>
                  <select
                    value={editForm.id_direction}
                    onChange={(e) => setEditForm({ ...editForm, id_direction: e.target.value })}
                    className="modal-input"
                  >
                    <option value="">-- Sélectionner une Direction (optionnel) --</option>
                    {directionsData
                      .filter((d) => !editForm.id_entite || d.id_entite == editForm.id_entite)
                      .map((d) => (
                        <option key={d.id_direction} value={d.id_direction}>
                          {d.nom} ({d.entite_nom})
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <div className="modal-buttons">
                <button type="submit" className="btn-submit">
                  {"Mettre à jour"}
                </button>
                <button type="button" className="btn-cancel" onClick={() => setShowEditModal(null)}>
                  {"Annuler"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Lier un département existant à cette ville */}
      {showLinkDeptModal && (
        <div className="modal-overlay" onClick={() => setShowLinkDeptModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Lier un département à {selectedVille?.ville}</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Seuls les départements dont l'entité est implantée dans cette ville sont listés.
            </p>
            {linkableDepts.length === 0 ? (
              <p className="empty-state">Aucun département disponible à lier (tous déjà liés ou aucune entité implantée).</p>
            ) : (
              <select
                value={linkDeptId}
                onChange={(e) => setLinkDeptId(e.target.value)}
                className="modal-input"
              >
                <option value="">-- Sélectionner un département --</option>
                {linkableDepts.map((d) => (
                  <option key={d.dept_id} value={d.dept_id}>
                    {d.nom} ({d.entite_nom})
                  </option>
                ))}
              </select>
            )}
            <div className="modal-buttons">
              <button
                type="button"
                className="btn-submit"
                onClick={handleLinkDept}
                disabled={!linkDeptId}
              >
                Lier
              </button>
              <button type="button" className="btn-cancel" onClick={() => setShowLinkDeptModal(false)}>
                {"Annuler"}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="error-message">
          {error} <button onClick={() => setError(null)}>{"Fermer"}</button>
        </div>
      )}
    </div>
  )
}
