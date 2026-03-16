import React, { useState, useEffect, useMemo } from 'react'
import api from '../services/api'
import { Settings, Building2, GitBranch, LayoutGrid, Briefcase, Plus, Pencil, Trash2, X, Users } from 'lucide-react'
import OrgChart from './OrgChart'

export default function Administration() {
  const [activeTab, setActiveTab] = useState('entites')
  const [entitesData, setEntitesData] = useState([])
  const [directionsData, setDirectionsData] = useState([])
  const [departementsData, setDepartementsData] = useState([])
  const [fonctionsData, setFonctionsData] = useState([])
  const [fonctionInput, setFonctionInput] = useState('')
  const [editingFonctionId, setEditingFonctionId] = useState(null)
  const [savingFonction, setSavingFonction] = useState(false)
  const [sortDirectionBy, setSortDirectionBy] = useState('nom')
  const [sortDirectionValue, setSortDirectionValue] = useState('all')
  const [sortDepartementBy, setSortDepartementBy] = useState('nom')
  const [sortDepartementValue, setSortDepartementValue] = useState('all')
  const [openEntiteDirections, setOpenEntiteDirections] = useState({})
  const [openEntiteDepartements, setOpenEntiteDepartements] = useState({})
  const [openDirectionDepartements, setOpenDirectionDepartements] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
    const failed = []
    let entites = []
    let directions = []
    let departements = []
    let fonctions = []

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
        failed.push('fonctions')
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

    if (failed.length > 0) {
      setError(`Certaines donnees n'ont pas pu etre chargees: ${failed.join(', ')}. Verifiez vos droits (RH/DG/PCA/ADMIN/AG) et le backend.`)
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
    setEditingFonctionId(null)
  }

  const submitFonction = async () => {
    const libelle = fonctionInput.trim()
    if (!libelle) {
      setError('Le libelle de la fonction est obligatoire')
      return
    }
    setSavingFonction(true)
    setError('')
    try {
      if (editingFonctionId) {
        await api.put(`/employees/admin/fonctions-reference/${editingFonctionId}`, { libelle })
      } else {
        await api.post('/employees/admin/fonctions-reference', { libelle })
      }
      resetFonctionForm()
      await loadFonctions()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Erreur lors de la sauvegarde de la fonction')
    } finally {
      setSavingFonction(false)
    }
  }

  const startEditFonction = (f) => {
    setEditingFonctionId(f.id_fonction)
    setFonctionInput(f.libelle)
  }

  const deleteFonction = async (f) => {
    if (!window.confirm(`Supprimer la fonction \"${f.libelle}\" ?`)) return
    setError('')
    try {
      await api.delete(`/employees/admin/fonctions-reference/${f.id_fonction}`)
      if (editingFonctionId === f.id_fonction) resetFonctionForm()
      await loadFonctions()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Erreur lors de la suppression de la fonction')
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  return (
    <div style={{ padding: '12px', background: 'linear-gradient(135deg, #f7f8fb 0%, #e8f4f8 100%)', minHeight: '100vh' }}>
      <div
        style={{
          background: 'linear-gradient(90deg, #021630 0%, #ce2b2b 100%)',
          color: 'white',
          padding: '16px 14px',
          borderRadius: '10px',
          marginBottom: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}
      >
        <h1 style={{ margin: 0, marginBottom: 4, fontSize: '1.2rem', fontWeight: '700', display:'flex', alignItems:'center', gap:8 }}>
          <Settings size={28}/> Administration
        </h1>
        <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.95 }}>
          Gestion des Entités, Directions, Départements et Fonctions
        </p>
      </div>

      {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '6px', marginBottom: '20px' }}>{error}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, borderBottom: '1px solid #e5e7eb', paddingBottom: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('entites')}
          style={{ background: activeTab === 'entites' ? '#ce2b2b' : 'white', color: activeTab === 'entites' ? 'white' : '#021630', padding: '7px 12px', borderRadius: '6px 6px 0px 0px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.82rem', display:'inline-flex', alignItems:'center', gap:6 }}
        >
          <Building2 size={15}/> Entités ({entitesData.length})
        </button>
        <button
          onClick={() => setActiveTab('directions')}
          style={{ background: activeTab === 'directions' ? '#ce2b2b' : 'white', color: activeTab === 'directions' ? 'white' : '#021630', padding: '7px 12px', borderRadius: '6px 6px 0px 0px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.82rem', display:'inline-flex', alignItems:'center', gap:6 }}
        >
          <GitBranch size={15}/> Directions ({directionsData.length})
        </button>
        <button
          onClick={() => setActiveTab('departements')}
          style={{ background: activeTab === 'departements' ? '#ce2b2b' : 'white', color: activeTab === 'departements' ? 'white' : '#021630', padding: '7px 12px', borderRadius: '6px 6px 0px 0px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.82rem', display:'inline-flex', alignItems:'center', gap:6 }}
        >
          <LayoutGrid size={15}/> Départements ({departementsData.length})
        </button>
        <button
          onClick={() => setActiveTab('fonctions')}
          style={{ background: activeTab === 'fonctions' ? '#ce2b2b' : 'white', color: activeTab === 'fonctions' ? 'white' : '#021630', padding: '7px 12px', borderRadius: '6px 6px 0px 0px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.82rem', display:'inline-flex', alignItems:'center', gap:6 }}
        >
          <Briefcase size={15}/> Fonctions ({fonctionsData.length})
        </button>
        <button
          onClick={() => setActiveTab('organigramme')}
          style={{ background: activeTab === 'organigramme' ? '#ce2b2b' : 'white', color: activeTab === 'organigramme' ? 'white' : '#021630', padding: '7px 12px', borderRadius: '6px 6px 0px 0px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.82rem', display:'inline-flex', alignItems:'center', gap:6 }}
        >
          <Users size={15}/> Organigramme
        </button>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Chargement...</div>}

      {/* Entités Tab */}
      {activeTab === 'entites' && !loading && (
        <div>
          <div style={{ display: 'grid', gap: 8 }}>
            {entitesData.map((entite) => (
              <div key={entite.id_entite} className="card" style={{ borderLeft: '4px solid #021630', padding: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, color: '#021630', display:'flex', alignItems:'center', gap:6, fontSize: '0.95rem' }}>
                    <Building2 size={15}/> {entite.nom} (ID: {entite.id_entite})
                  </h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => toggleOpen(setOpenEntiteDirections, entite.id_entite)}
                      style={{ background: '#e2e8f0', color: '#021630', padding: '3px 9px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '600', border: 'none', cursor: 'pointer' }}
                      title="Cliquer pour afficher/masquer les directions"
                    >
                      {entite.directions_count} direction{entite.directions_count !== 1 ? 's' : ''}
                    </button>
                    <button
                      onClick={() => toggleOpen(setOpenEntiteDepartements, entite.id_entite)}
                      style={{ background: '#e2e8f0', color: '#021630', padding: '3px 9px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '600', border: 'none', cursor: 'pointer' }}
                      title="Cliquer pour afficher/masquer les départements"
                    >
                      {entite.departements_count} département{entite.departements_count !== 1 ? 's' : ''}
                    </button>
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
                      <GitBranch size={15}/> {direction.nom} (ID: {direction.id_direction})
                    </h3>
                    <p style={{ margin: 0, color: '#666', fontSize: '0.8rem' }}>
                      Entité: <strong>{direction.entite_nom}</strong>
                    </p>
                  </div>
                  <button
                    onClick={() => toggleOpen(setOpenDirectionDepartements, direction.id_direction)}
                    style={{ background: '#e2e8f0', color: '#021630', padding: '4px 9px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '600', border: 'none', cursor: 'pointer' }}
                    title="Cliquer pour afficher/masquer les départements"
                  >
                    {direction.departements_count} département{direction.departements_count !== 1 ? 's' : ''}
                  </button>
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
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, alignItems: 'center' }}>
                  <div>
                            <h4 style={{ margin: 0, color: '#021630', fontSize: '0.9rem' }}>{dept.nom}</h4>
                    <p style={{ margin: '2px 0 0 0', color: '#666', fontSize: '0.75rem' }}>
                      ID: {dept.dept_id}
                    </p>
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
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fonctions Tab */}
      {activeTab === 'fonctions' && !loading && (
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ marginTop: 0, marginBottom: 12, color: '#021630', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Briefcase size={16}/> Référentiel des fonctions
            </h3>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                value={fonctionInput}
                onChange={(e) => setFonctionInput(e.target.value)}
                placeholder="Saisir le libelle de la fonction"
                style={{ flex: 1, minWidth: 260, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8 }}
              />
              <button
                onClick={submitFonction}
                disabled={savingFonction}
                style={{ background: '#ce2b2b', color: 'white', border: 'none', borderRadius: 8, padding: '10px 14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={14}/> {editingFonctionId ? 'Mettre à jour' : 'Ajouter'}
              </button>
              {editingFonctionId && (
                <button
                  onClick={resetFonctionForm}
                  style={{ background: '#e5e7eb', color: '#111827', border: 'none', borderRadius: 8, padding: '10px 14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <X size={14}/> Annuler
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {fonctionsData.length === 0 ? (
              <div className="card" style={{ color: '#6b7280' }}>Aucune fonction de référence</div>
            ) : (
              fonctionsData.map((f) => (
                <div key={f.id_fonction} className="card" style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderLeft: '6px solid #021630' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{f.libelle}</div>
                    <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>ID: {f.id_fonction}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => startEditFonction(f)}
                      style={{ background: '#021630', color: 'white', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <Pencil size={13}/> Modifier
                    </button>
                    <button
                      onClick={() => deleteFonction(f)}
                      style={{ background: '#ce2b2b', color: 'white', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <Trash2 size={13}/> Supprimer
                    </button>
                  </div>
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
    </div>
  )
}
