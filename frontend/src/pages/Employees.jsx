import React, {useEffect, useState, useMemo, useRef} from 'react'
import api from '../services/api'
import {Link} from 'react-router-dom'
import {useAuth} from '../contexts/AuthContext'
import {Pencil, ClipboardList, Briefcase, Building2, Clock, Upload, Download, MoreHorizontal, ChevronRight, Database, Trash2, AlertTriangle} from 'lucide-react'
import AvatarCircle from '../components/AvatarCircle'

export default function Employees(){
  const {user} = useAuth()
  const role = String(user?.role || '').toUpperCase()
  const isRhAdmin = ['RH','ADMIN','PCA','AG'].includes(role)
  const isAdmin = role === 'ADMIN'
  const [list,setList]=useState([])
  const [loading,setLoading]=useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortConfig, setSortConfig] = useState({key: 'nom', direction: 'asc'})
  const [deleteTarget, setDeleteTarget] = useState(null)   // {matricule, nom, prenom}
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [selectedPays, setSelectedPays] = useState('')
  const [selectedVille, setSelectedVille] = useState('')
  const [selectedEntite, setSelectedEntite] = useState('')
  const [selectedDirection, setSelectedDirection] = useState('')
  const [selectedDepartement, setSelectedDepartement] = useState('')
  const [paysOptions, setPaysOptions] = useState([])
  const [villeOptions, setVilleOptions] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [importReport, setImportReport] = useState(null)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [actionMenuOpen, setActionMenuOpen] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [accessSelection, setAccessSelection] = useState(null)
  const fileInputRef = useRef(null)
  const actionMenuRef = useRef(null)

  const calculateAge = (dateNaissance) => {
    if (!dateNaissance) return '-'
    const birth = new Date(dateNaissance)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return `${age} ans`
  }

  const calculateAnciennete = (dateEmbauche) => {
    if (!dateEmbauche) return '-'
    const date = new Date(dateEmbauche)
    const today = new Date()
    const diffTime = today - date
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    const years = Math.floor(diffDays / 365.25)
    const months = Math.floor((diffDays % 365.25) / 30.44)
    
    if (years === 0) return `${months} mois`
    if (months === 0) return `${years} an${years > 1 ? 's' : ''}`
    return `${years} an${years > 1 ? 's' : ''} ${months} mois`
  }

  const formatSalaire = (amount, currency = 'XAF') => {
    if (amount == null || amount === '') return 'Non renseigne'
    const n = Number(amount)
    if (Number.isNaN(n)) return `${amount} ${currency}`
    return `${n.toLocaleString('fr-FR')} ${currency}`
  }

  const getEmployeeInitial = (employee) => {
    const firstName = String(employee?.prenom || '').trim()
    const lastName = String(employee?.nom || '').trim()
    const initial = firstName.charAt(0) || lastName.charAt(0) || '?'
    return initial.toUpperCase()
  }

  useEffect(()=>{
    api.get('/employees/scoped')
      .then(r=>{setList(r.data)})
      .catch(async ()=>{
        const fallback = await api.get('/employees/').catch(() => ({data: []}))
        setList(fallback.data || [])
      })
      .finally(()=>setLoading(false))
  },[])

  useEffect(() => {
    api.get('/employees/autocomplete/pays')
      .then((r) => setPaysOptions(Array.isArray(r.data) ? r.data : []))
      .catch(() => setPaysOptions([]))
  }, [])

  useEffect(() => {
    setSelectedVille('')
    if (!selectedPays) {
      setVilleOptions([])
      return
    }

    api.get('/employees/autocomplete/villes', { params: { id_pays: Number(selectedPays) } })
      .then((r) => setVilleOptions(Array.isArray(r.data) ? r.data : []))
      .catch(() => setVilleOptions([]))
  }, [selectedPays])

  useEffect(() => {
    const handleMouseDown = (event) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target)) {
        setActionMenuOpen(false)
        setExportMenuOpen(false)
      }
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setActionMenuOpen(false)
        setExportMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Créer une map nom/prenom des employés pour chercher N1
  const employeeMap = useMemo(() => {
    const map = {}
    list.forEach(e => {
      map[e.matricule] = `${e.prenom} ${e.nom}`
    })
    return map
  }, [list])

  // Nom du supérieur hiérarchique (N1) — fetch si absent de la liste scoped
  const [superiorName, setSuperiorName] = useState(null)
  useEffect(() => {
    if (!selectedEmployee?.n1) { setSuperiorName(null); return }
    if (employeeMap[selectedEmployee.n1]) { setSuperiorName(null); return }
    api.get(`/employees/${selectedEmployee.n1}`)
      .then(r => setSuperiorName(`${r.data.prenom} ${r.data.nom}`))
      .catch(() => setSuperiorName(null))
  }, [selectedEmployee, employeeMap])

  // Options organisation dérivées de la liste
  const entiteOptions = useMemo(() => {
    const seen = new Set()
    return list.filter(e => e.entite && !seen.has(e.entite) && seen.add(e.entite)).map(e => e.entite).sort()
  }, [list])

  const directionOptions = useMemo(() => {
    const seen = new Set()
    return list
      .filter(e => (!selectedEntite || e.entite === selectedEntite) && e.direction && !seen.has(e.direction) && seen.add(e.direction))
      .map(e => e.direction).sort()
  }, [list, selectedEntite])

  const departementOptions = useMemo(() => {
    const seen = new Set()
    return list
      .filter(e => {
        if (selectedEntite && e.entite !== selectedEntite) return false
        if (selectedDirection && e.direction !== selectedDirection) return false
        return e.departement && !seen.has(e.departement) && seen.add(e.departement)
      })
      .map(e => e.departement).sort()
  }, [list, selectedEntite, selectedDirection])

  // Filter
  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase()
    const includes = (v) => String(v || '').toLowerCase().includes(q)
    return list.filter(e => 
      includes(e.matricule) ||
      includes(e.email) ||
      includes(e.nom) ||
      includes(e.prenom) ||
      includes(e.departement) ||
      includes(e.entite) ||
      includes(e.telephone) ||
      includes(e.sexe) ||
      includes(e.fonction) ||
      includes(e.direction || e.id_direction) ||
      includes(e.role) ||
      includes(e.categorie) ||
      includes(e.diplome) ||
      includes(e.statut_employe) ||
      includes(e.ville) ||
      includes(e.pays)
    ).filter((e) => {
      if (selectedPays && String(e.id_pays || '') !== String(selectedPays)) return false
      if (selectedVille && String(e.id_localisation || '') !== String(selectedVille)) return false
      if (selectedEntite && e.entite !== selectedEntite) return false
      if (selectedDirection && e.direction !== selectedDirection) return false
      if (selectedDepartement && e.departement !== selectedDepartement) return false
      return true
    })
  }, [list, searchTerm, selectedPays, selectedVille, selectedEntite, selectedDirection, selectedDepartement])

  const canCreateEmployee = ['RH', 'PCA', 'ADMIN'].includes(String(user?.role || '').toUpperCase())

  const formatImportError = (detail) => {
    if (!detail) return "Erreur lors de l'import"
    if (typeof detail === 'string') return detail
    if (typeof detail?.message === 'string') return detail.message
    return "Erreur lors de l'import"
  }

  const parseDownloadFilename = (contentDisposition, fallback) => {
    if (!contentDisposition) return fallback
    const match = contentDisposition.match(/filename=([^;]+)/i)
    if (!match) return fallback
    return match[1].trim().replace(/^"|"$/g, '')
  }

  // Sort
  const sorted = useMemo(() => {
    let sortable = [...filtered]
    sortable.sort((a, b) => {
      const aVal = String(sortConfig.key === 'direction' ? (a.direction || a.id_direction || '') : (a[sortConfig.key] || ''))
      const bVal = String(sortConfig.key === 'direction' ? (b.direction || b.id_direction || '') : (b[sortConfig.key] || ''))
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
    return sortable
  }, [filtered, sortConfig])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / rowsPerPage))
  const startIdx = (currentPage - 1) * rowsPerPage
  const paginatedList = sorted.slice(startIdx, startIdx + rowsPerPage)

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
    setCurrentPage(1)
  }

  const handleSearch = (e) => {
    setSearchTerm(e.target.value)
    setCurrentPage(1)
  }

  const handlePrevious = () => {
    setCurrentPage(prev => Math.max(1, prev - 1))
  }

  const handleNext = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1))
  }

  const handleRowsPerPageChange = (e) => {
    setRowsPerPage(Number(e.target.value))
    setCurrentPage(1)
  }

  const handleImportClick = () => {
    setImportReport(null)
    setActionMenuOpen(false)
    setExportMenuOpen(false)
    fileInputRef.current?.click()
  }

  const refreshEmployees = async () => {
    const refreshed = await api.get('/employees/scoped').catch(async () => {
      const fallback = await api.get('/employees/').catch(() => ({ data: [] }))
      return fallback
    })
    setList(refreshed.data || [])
    setCurrentPage(1)
  }

  const submitImport = async (file, table = null) => {
    setImporting(true)
    setImportReport(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const query = table ? `?table=${encodeURIComponent(table)}` : ''
      const res = await api.post(`/employees/import${query}`, formData)
      setImportReport(res.data)
      setAccessSelection(null)
      await refreshEmployees()
    } catch (err) {
      const detail = err?.response?.data?.detail
      if (detail && typeof detail === 'object' && detail.code === 'access_table_required' && Array.isArray(detail.available_tables)) {
        setAccessSelection({
          file,
          tables: detail.available_tables,
          selectedTable: detail.available_tables[0] || '',
        })
        return
      }
      setImportReport({ error: formatImportError(detail) })
    } finally {
      setImporting(false)
    }
  }

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const allowed = ['.csv', '.xlsx', '.xls', '.mdb', '.accdb']
    const lower = file.name.toLowerCase()
    if (!allowed.some(ext => lower.endsWith(ext))) {
      setImportReport({ error: 'Format non supporté. Utiliser .csv, .xlsx, .xls, .mdb ou .accdb' })
      e.target.value = ''
      return
    }

    await submitImport(file)
    e.target.value = ''
  }

  const handleExport = async (format) => {
    setExporting(true)
    try {
      const url_path = format === 'pdf' ? '/api/pdf/report/employees' : `/employees/export?format=${format}`
      const res = await api.get(url_path, { responseType: 'blob' })
      const blob = new Blob([res.data])
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = parseDownloadFilename(res.headers?.['content-disposition'], `employees_export.${format}`)
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      setActionMenuOpen(false)
      setExportMenuOpen(false)
    } catch (err) {
      setImportReport({ error: err?.response?.data?.detail || "Erreur lors de l'export" })
    } finally {
      setExporting(false)
    }
  }

  const handleSoftDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      await api.delete(`/employees/${deleteTarget.matricule}`)
      setList(prev => prev.filter(e => e.matricule !== deleteTarget.matricule))
      setSelectedEmployee(null)
      setDeleteTarget(null)
    } catch (err) {
      setDeleteError(err?.response?.data?.detail || 'Erreur lors de la suppression')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="container">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h2>Employés</h2>
        <div style={{display: 'flex', gap: 10, alignItems: 'center'}}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.mdb,.accdb"
            onChange={handleImportFile}
            style={{ display: 'none' }}
          />
          {canCreateEmployee && (
            <div ref={actionMenuRef} className="toolbar-menu">
              <button
                type="button"
                className="icon-action-button"
                aria-label="Actions import et export"
                aria-haspopup="menu"
                aria-expanded={actionMenuOpen}
                onClick={() => {
                  setActionMenuOpen(open => !open)
                  setExportMenuOpen(false)
                }}
              >
                <MoreHorizontal size={18} />
              </button>
              {actionMenuOpen && (
                <div className="floating-menu" role="menu" aria-label="Menu import export">
                  <button
                    type="button"
                    className="floating-menu-item floating-menu-item-import"
                    onClick={handleImportClick}
                    disabled={importing}
                  >
                    <span className="floating-menu-icon"><Upload size={16} /></span>
                    <span>{importing ? 'Import en cours...' : 'Import'}</span>
                  </button>
                  <div className="floating-menu-submenu-wrap">
                    <button
                      type="button"
                      className="floating-menu-item floating-menu-item-export"
                      onClick={() => setExportMenuOpen(open => !open)}
                      disabled={exporting}
                    >
                      <span className="floating-menu-icon"><Download size={16} /></span>
                      <span>{exporting ? 'Export en cours...' : 'Export'}</span>
                      <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
                    </button>
                    {exportMenuOpen && (
                      <div className="floating-submenu" role="menu" aria-label="Formats export">
                        <button type="button" className="floating-submenu-item" onClick={() => handleExport('csv')}>CSV</button>
                        <button type="button" className="floating-submenu-item" onClick={() => handleExport('xlsx')}>XLSX</button>
                        <button type="button" className="floating-submenu-item" onClick={() => handleExport('xls')}>XLS</button>
                        <button type="button" className="floating-submenu-item" onClick={() => handleExport('pdf')}>PDF</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <Link to="/rh/timeline" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', background: '#021630', color: 'white',
            borderRadius: '6px', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 700,
          }}><Clock size={14}/> Parcours Employé</Link>
          {canCreateEmployee && <Link to="/rh/employees/new" className="button">Nouvel employé</Link>}
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="card" style={{marginBottom: 20}}>
        {importReport?.error && (
          <p style={{ margin: '0 0 10px 0', color: '#991b1b', fontSize: '0.9rem' }}>{importReport.error}</p>
        )}
        {importReport && !importReport.error && (
          <div style={{ marginBottom: 10, padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', background: 'var(--bg)' }}>
            <strong>Import terminé:</strong> {importReport.imported_rows}/{importReport.total_rows} importé(s), {importReport.failed_rows} échec(s)
            {importReport.table && (
              <div style={{ marginTop: 6, color: '#334155', fontSize: '0.84rem' }}>Table Access: {importReport.table}</div>
            )}
            {Array.isArray(importReport.errors) && importReport.errors.length > 0 && (
              <div style={{ marginTop: 8, maxHeight: 110, overflowY: 'auto', fontSize: '0.84rem', color: '#7f1d1d' }}>
                {importReport.errors.map((er, i) => (
                  <div key={`${er.line}-${i}`}>Ligne {er.line}: {String(er.error)}</div>
                ))}
              </div>
            )}
          </div>
        )}
        <div style={{display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center'}}>
          <input
            type="text"
            placeholder="Rechercher..."
            className="input"
            value={searchTerm}
            onChange={handleSearch}
            style={{flex: '2 1 180px', minWidth: 160, padding: '8px 10px', fontSize: '0.88rem'}}
          />
          <select className="input" value={selectedEntite} onChange={(e) => { setSelectedEntite(e.target.value); setSelectedDirection(''); setSelectedDepartement(''); setCurrentPage(1) }} style={{flex: '1 1 110px', minWidth: 110, fontSize: '0.85rem'}}>
            <option value="">Entité</option>
            {entiteOptions.map((ent) => <option key={ent} value={ent}>{ent}</option>)}
          </select>
          <select className="input" value={selectedDirection} onChange={(e) => { setSelectedDirection(e.target.value); setSelectedDepartement(''); setCurrentPage(1) }} disabled={!selectedEntite} style={{flex: '1 1 140px', minWidth: 130, fontSize: '0.85rem'}}>
            <option value="">Direction</option>
            {directionOptions.map((dir) => <option key={dir} value={dir}>{dir}</option>)}
          </select>
          <select className="input" value={selectedDepartement} onChange={(e) => { setSelectedDepartement(e.target.value); setCurrentPage(1) }} disabled={!selectedEntite} style={{flex: '1 1 140px', minWidth: 130, fontSize: '0.85rem'}}>
            <option value="">Département</option>
            {departementOptions.map((dep) => <option key={dep} value={dep}>{dep}</option>)}
          </select>
          <select className="input" value={selectedPays} onChange={(e) => setSelectedPays(e.target.value)} style={{flex: '1 1 110px', minWidth: 100, fontSize: '0.85rem'}}>
            <option value="">Pays</option>
            {paysOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select className="input" value={selectedVille} onChange={(e) => setSelectedVille(e.target.value)} disabled={!selectedPays} style={{flex: '1 1 110px', minWidth: 100, fontSize: '0.85rem'}}>
            <option value="">Ville</option>
            {villeOptions.map((v) => <option key={v.id_localisation || v.value} value={v.id_localisation}>{v.label}</option>)}
          </select>
          <select className="input" value={rowsPerPage} onChange={handleRowsPerPageChange} style={{flex: '0 0 100px', width: 100, fontSize: '0.85rem'}}>
            <option value={10}>10 lignes</option>
            <option value={20}>20 lignes</option>
            <option value={30}>30 lignes</option>
            <option value={40}>40 lignes</option>
            <option value={50}>50 lignes</option>
          </select>
          <button
            onClick={() => { setSearchTerm(''); setSelectedPays(''); setSelectedVille(''); setSelectedEntite(''); setSelectedDirection(''); setSelectedDepartement(''); setSortConfig({key: 'nom', direction: 'asc'}); setCurrentPage(1) }}
            style={{flex: '0 0 auto', padding: '8px 14px', background: '#e5e7eb', color: '#1f2937', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500', whiteSpace: 'nowrap'}}
          >
            ✕ Réinitialiser
          </button>
        </div>
        <p style={{margin: '8px 0 0 0', color: '#64748b', fontSize: '0.85rem'}}>
          {filtered.length} employé{filtered.length !== 1 ? 's' : ''} trouvé{filtered.length !== 1 ? 's' : ''}
        </p>
        <p style={{margin: '6px 0 0 0', color: '#94a3b8', fontSize: '0.8rem'}}>
          Import supporté: CSV/XLSX/XLS/Access (.mdb/.accdb). Export disponible en CSV, XLSX et XLS.
        </p>
      </div>

      <div className="card" style={{marginTop: 12}}>
        {loading ? <p>Chargement...</p> : (
          <>
            {/* Table simple */}
            <table className="table" style={{marginBottom: 20}}>
              <thead>
                <tr>
                  <th style={{cursor: 'pointer', userSelect: 'none'}} onClick={() => handleSort('matricule')}>
                    Matricule {sortConfig.key === 'matricule' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '⇅'}
                  </th>
                  <th style={{cursor: 'pointer', userSelect: 'none'}} onClick={() => handleSort('nom')}>
                    Nom {sortConfig.key === 'nom' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '⇅'}
                  </th>
                  <th style={{cursor: 'pointer', userSelect: 'none'}} onClick={() => handleSort('fonction')}>
                    Fonction {sortConfig.key === 'fonction' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '⇅'}
                  </th>
                  <th style={{cursor: 'pointer', userSelect: 'none'}} onClick={() => handleSort('role')}>
                    Rôle {sortConfig.key === 'role' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '⇅'}
                  </th>
                  <th style={{cursor: 'pointer', userSelect: 'none'}} onClick={() => handleSort('departement')}>
                    Département {sortConfig.key === 'departement' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '⇅'}
                  </th>
                  <th style={{cursor: 'pointer', userSelect: 'none'}} onClick={() => handleSort('direction')}>
                    Direction {sortConfig.key === 'direction' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '⇅'}
                  </th>
                  <th style={{cursor: 'pointer', userSelect: 'none'}} onClick={() => handleSort('entite')}>
                    Entité {sortConfig.key === 'entite' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '⇅'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedList.length > 0 ? (
                  paginatedList.map(e => (
                    <tr key={e.matricule} onClick={() => setSelectedEmployee(e)} style={{cursor: 'pointer'}} className="hover-row">
                      <td>{e.matricule}</td>
                      <td>{e.nom} {e.prenom}</td>
                      <td>{e.fonction || '-'}</td>
                      <td>{e.role || '-'}</td>
                      <td>{e.departement || '-'}</td>
                      <td>{e.direction || e.id_direction || '-'}</td>
                      <td>{e.entite || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="7" style={{textAlign: 'center', padding: '20px'}}>Aucun employé trouvé</td></tr>
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '15px', borderTop: '1px solid #e2e8f0'}}>
                <button
                  onClick={handlePrevious}
                  disabled={currentPage === 1}
                  style={{
                    padding: '8px 16px',
                    background: currentPage === 1 ? '#e5e7eb' : '#3b82f6',
                    color: currentPage === 1 ? '#9ca3af' : 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  ← Précédent
                </button>
                <span style={{color: '#64748b', fontSize: '0.9rem'}}>
                  Page {currentPage} sur {totalPages} ({filtered.length} total)
                </span>
                <button
                  onClick={handleNext}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '8px 16px',
                    background: currentPage === totalPages ? '#e5e7eb' : '#3b82f6',
                    color: currentPage === totalPages ? '#9ca3af' : 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                  }}
                >
                  Suivant →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de détail */}
      {selectedEmployee && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }} onClick={() => setSelectedEmployee(null)}>
          <div style={{
            background: 'var(--card)',
            borderRadius: '12px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }} onClick={(e) => e.stopPropagation()}>
            {/* En-tête */}
            <div style={{
              background: 'linear-gradient(135deg, #021630 0%, #ce2b2b 100%)',
              color: 'white',
              padding: '20px',
              borderRadius: '12px 12px 0 0',
              position: 'relative'
            }}>
              <button onClick={() => setSelectedEmployee(null)} style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: 'white',
                fontSize: '1.5rem',
                width: '35px',
                height: '35px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>×</button>
              <div style={{display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px'}}>
                <div style={{flex: 1, minWidth: 0, paddingRight: '56px'}}>
                  <p style={{margin: '0 0 6px 0', fontSize: '0.9rem', color: 'white'}}>Matricule: {selectedEmployee.matricule}</p>
                  <h2 style={{margin: 0, fontSize: '1.5rem', color: 'white'}}>{selectedEmployee.nom} {selectedEmployee.prenom}</h2>
                  <p style={{margin: '6px 0 0 0', fontSize: '0.9rem', color: 'white'}}>{selectedEmployee.email}</p>
                  <div style={{marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                    <Link to={`/rh/employees/${selectedEmployee.matricule}`} style={{
                      padding: '8px 14px',
                      background: 'rgba(255,255,255,0.2)',
                      color: 'white',
                      borderRadius: '6px',
                      textDecoration: 'none',
                      fontSize: '0.85rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <Pencil size={13}/> Modifier
                    </Link>
                    <Link to={`/rh/timeline?emp=${selectedEmployee.matricule}`} style={{
                      padding: '8px 14px',
                      background: 'rgba(255,255,255,0.15)',
                      color: 'white',
                      borderRadius: '6px',
                      textDecoration: 'none',
                      fontSize: '0.85rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      border: '1px solid rgba(255,255,255,0.3)',
                    }}>
                      <Clock size={13}/> Parcours Employé
                    </Link>
                    {isAdmin && (
                      <button
                        onClick={() => setDeleteTarget({ matricule: selectedEmployee.matricule, nom: selectedEmployee.nom, prenom: selectedEmployee.prenom })}
                        style={{
                          padding: '8px 14px',
                          background: 'rgba(220,38,38,0.8)',
                          color: 'white',
                          borderRadius: '6px',
                          border: '1px solid rgba(220,38,38,0.5)',
                          fontSize: '0.85rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          fontWeight: 700,
                        }}
                      >
                        <Trash2 size={13}/> Supprimer
                      </button>
                    )}
                  </div>
                </div>
                <div data-testid="employee-modal-avatar" style={{marginRight: '52px', marginTop: '2px'}}>
                  <AvatarCircle
                    photoUrl={selectedEmployee.photo_url}
                    letter={getEmployeeInitial(selectedEmployee)}
                    size={72}
                    borderWidth={2}
                    borderColor="rgba(255,255,255,0.95)"
                    textColor="white"
                    fallbackBackground="transparent"
                  />
                </div>
              </div>
            </div>

            {/* Contenu */}
            <div style={{padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px'}}>
              {/* Informations Personnelles — visible RH/ADMIN/PCA/AG uniquement */}
              {isRhAdmin && (
              <div>
                <h3 style={{margin: '0 0 12px 0', color: '#1f2937', fontSize: '1.1rem', fontWeight: '600', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px'}}><ClipboardList size={16}/> Informations Personnelles</h3>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.9rem'}}>
                  <div><span style={{color: '#64748b'}}>Sexe:</span> <strong>{selectedEmployee.sexe || '-'}</strong></div>
                  <div><span style={{color: '#64748b'}}>Date de naissance:</span> <strong>{selectedEmployee.date_naissance ? new Date(selectedEmployee.date_naissance).toLocaleDateString('fr-FR') : '-'}</strong></div>
                  <div><span style={{color: '#64748b'}}>Âge:</span> <strong>{calculateAge(selectedEmployee.date_naissance)}</strong></div>
                  <div><span style={{color: '#64748b'}}>Téléphone:</span> <strong>{selectedEmployee.telephone || '-'}</strong></div>
                  <div><span style={{color: '#64748b'}}>Ville:</span> <strong>{selectedEmployee.ville || '-'}</strong></div>
                  <div><span style={{color: '#64748b'}}>Pays:</span> <strong>{selectedEmployee.pays || '-'}</strong></div>
                  <div style={{gridColumn: '1 / -1'}}><span style={{color: '#64748b'}}>Contact d'urgence:</span> <strong>{selectedEmployee.contact_urgence || '-'}</strong></div>
                  <div><span style={{color: '#64748b'}}>Statut matrimonial:</span> <strong>{selectedEmployee.statut_matrimonial || '-'}</strong></div>
                  <div><span style={{color: '#64748b'}}>Nombre d'enfants:</span> <strong>{selectedEmployee.nombre_enfants ?? '-'}</strong></div>
                </div>
              </div>
              )}

              {/* Informations Professionnelles */}
              <div>
                <h3 style={{margin: '0 0 12px 0', color: '#1f2937', fontSize: '1.1rem', fontWeight: '600', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px'}}><Briefcase size={16}/> Informations Professionnelles</h3>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.9rem'}}>
                  <div><span style={{color: '#64748b'}}>Diplôme:</span> <strong>{selectedEmployee.diplome || '-'}</strong></div>
                  <div><span style={{color: '#64748b'}}>Catégorie:</span> <strong>{selectedEmployee.categorie || '-'}</strong></div>
                  <div><span style={{color: '#64748b'}}>Années d'expérience:</span> <strong>{selectedEmployee.annee_experience ?? '-'} ans</strong></div>
                  <div><span style={{color: '#64748b'}}>N1 (Supérieur):</span> <strong>{employeeMap[selectedEmployee.n1] || superiorName || selectedEmployee.n1_fonction || (selectedEmployee.n1 ? `Matricule ${selectedEmployee.n1}` : '-')}</strong></div>
                  <div><span style={{color: '#64748b'}}>Date d'embauche:</span> <strong>{selectedEmployee.date_embauche ? new Date(selectedEmployee.date_embauche).toLocaleDateString('fr-FR') : '-'}</strong></div>
                  <div><span style={{color: '#64748b'}}>Ancienneté:</span> <strong>{calculateAnciennete(selectedEmployee.date_embauche)}</strong></div>
                  <div><span style={{color: '#64748b'}}>Solde de congés:</span> <strong>{selectedEmployee.solde_conges ?? '-'} jours</strong></div>
                  {isRhAdmin && (
                    <>
                      <div><span style={{color: '#64748b'}}>Salaire brut:</span> <strong>{formatSalaire(selectedEmployee.salaire_brut, selectedEmployee.salaire_devise || 'XAF')}</strong></div>
                      <div><span style={{color: '#64748b'}}>Devise salaire:</span> <strong>{selectedEmployee.salaire_devise || 'XAF'}</strong></div>
                    </>
                  )}
                </div>
              </div>

              {/* Positionnement Organisationnel */}
              <div>
                <h3 style={{margin: '0 0 12px 0', color: '#1f2937', fontSize: '1.1rem', fontWeight: '600', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px'}}><Building2 size={16}/> Positionnement Organisationnel</h3>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.9rem'}}>
                  <div><span style={{color: '#64748b'}}>Fonction:</span> <strong>{selectedEmployee.fonction || '-'}</strong></div>
                  <div><span style={{color: '#64748b'}}>Département:</span> <strong>{selectedEmployee.departement || '-'}</strong></div>
                  <div><span style={{color: '#64748b'}}>Direction:</span> <strong>{selectedEmployee.direction || selectedEmployee.id_direction || '-'}</strong></div>
                  <div><span style={{color: '#64748b'}}>Entité:</span> <strong>{selectedEmployee.entite || '-'}</strong></div>
                  <div><span style={{color: '#64748b'}}>Rôle:</span> <strong>{selectedEmployee.role || '-'}</strong></div>
                  <div style={{
                    padding: '6px 12px',
                    background: selectedEmployee.statut_employe === 'ACTIF' ? '#d1fae5' : '#fee2e2',
                    borderRadius: '6px',
                    color: selectedEmployee.statut_employe === 'ACTIF' ? '#065f46' : '#991b1b',
                    fontWeight: 'bold'
                  }}>
                    Statut: {selectedEmployee.statut_employe || '-'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, padding: '20px',
        }} onClick={() => { setDeleteTarget(null); setDeleteError(null) }}>
          <div style={{
            background: 'var(--card)', borderRadius: '14px', maxWidth: '420px', width: '100%',
            padding: '28px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={22} color="#dc2626" />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>Supprimer l'employé</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 2 }}>Cette action est irréversible dans la liste.</div>
              </div>
            </div>
            <p style={{ fontSize: '0.88rem', color: '#374151', marginBottom: 20, lineHeight: 1.6 }}>
              Confirmer la suppression de{' '}
              <strong>{deleteTarget.prenom} {deleteTarget.nom}</strong>{' '}
              (matricule {deleteTarget.matricule}) ?
              <br />
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                L'employé sera marqué comme congédié et son compte sera désactivé. Les données sont conservées.
              </span>
            </p>
            {deleteError && (
              <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#991b1b', fontSize: '0.84rem', marginBottom: 14 }}>
                {deleteError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setDeleteTarget(null); setDeleteError(null) }}
                style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: '#374151', fontSize: '0.86rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Annuler
              </button>
              <button
                onClick={handleSoftDelete}
                disabled={deleteLoading}
                style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#dc2626', color: 'white', fontSize: '0.86rem', fontWeight: 700, cursor: deleteLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 7, opacity: deleteLoading ? 0.7 : 1 }}
              >
                <Trash2 size={15} />
                {deleteLoading ? 'Suppression...' : 'Confirmer la suppression'}
              </button>
            </div>
          </div>
        </div>
      )}

      {accessSelection && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(2, 22, 46, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: 20,
        }} onClick={() => !importing && setAccessSelection(null)}>
          <div className="card" style={{ maxWidth: 460, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div className="floating-menu-icon floating-menu-icon-blue"><Database size={16} /></div>
              <div>
                <h3 style={{ marginBottom: 4 }}>Choisir la table Access</h3>
                <div className="small">La base contient plusieurs tables. Sélectionnez celle à importer.</div>
              </div>
            </div>
            <select
              className="input"
              aria-label="Table Access"
              value={accessSelection.selectedTable}
              onChange={(e) => setAccessSelection((current) => ({ ...current, selectedTable: e.target.value }))}
            >
              {accessSelection.tables.map((tableName) => (
                <option key={tableName} value={tableName}>{tableName}</option>
              ))}
            </select>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <button
                type="button"
                className="button"
                style={{ background: '#e5e7eb', color: '#1f2937' }}
                onClick={() => setAccessSelection(null)}
                disabled={importing}
              >
                Annuler
              </button>
              <button
                type="button"
                className="button"
                style={{ background: 'var(--bleu)' }}
                onClick={() => submitImport(accessSelection.file, accessSelection.selectedTable)}
                disabled={importing || !accessSelection.selectedTable}
              >
                {importing ? 'Import en cours...' : "Continuer l'import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
