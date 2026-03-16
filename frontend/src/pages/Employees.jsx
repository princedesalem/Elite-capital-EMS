import React, {useEffect, useState, useMemo} from 'react'
import api from '../services/api'
import {Link} from 'react-router-dom'
import {Pencil, ClipboardList, Briefcase, Building2, Clock} from 'lucide-react'

export default function Employees(){
  const [list,setList]=useState([])
  const [loading,setLoading]=useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortConfig, setSortConfig] = useState({key: 'nom', direction: 'asc'})
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const itemsPerPage = 10

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

  const demoEmployee = {
    matricule: '99999',
    nom: 'Test',
    prenom: 'Affichage',
    date_naissance: '1990-05-15',
    sexe: 'M',
    telephone: '+237690000000',
    email: 'test.affichage@demo.local',
    departement: 'Finance',
    fonction: 'Analyste',
    ville: 'Douala',
    contact_urgence: '+237691111111',
    diplome: 'Licence',
    solde_conges: 12,
    date_embauche: '2024-01-10',
    entite: 'ELCAM',
    role: 'EMPLOYE',
    annee_experience: 3,
    categorie: 'IIIB',
    direction: 'Direction Finance',
    id_direction: 'Direction Finance',
    statut_employe: 'ACTIF',
    n1: '1001'
  }

  useEffect(()=>{
    api.get('/employees').then(r=>{setList(r.data)}).catch(()=>{}).finally(()=>setLoading(false))
  },[])

  const listWithDemo = useMemo(() => {
    const exists = list.some(e => String(e.matricule) === '99999')
    return exists ? list : [demoEmployee, ...list]
  }, [list, demoEmployee])

  // Créer une map nom/prenom des employés pour chercher N1
  const employeeMap = useMemo(() => {
    const map = {}
    listWithDemo.forEach(e => {
      map[e.matricule] = `${e.prenom} ${e.nom}`
    })
    return map
  }, [listWithDemo])

  // Filter
  const filtered = useMemo(() => {
    return listWithDemo.filter(e => 
      e.matricule?.toString().includes(searchTerm) ||
      e.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.departement?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.entite?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.telephone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.sexe?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.fonction?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.id_direction?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.categorie?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.diplome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.statut_employe?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [listWithDemo, searchTerm])

  // Sort
  const sorted = useMemo(() => {
    let sortable = [...filtered]
    sortable.sort((a, b) => {
      const aVal = a[sortConfig.key] || ''
      const bVal = b[sortConfig.key] || ''
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
    return sortable
  }, [filtered, sortConfig])

  // Pagination
  const totalPages = Math.ceil(sorted.length / itemsPerPage)
  const startIdx = (currentPage - 1) * itemsPerPage
  const paginatedList = sorted.slice(startIdx, startIdx + itemsPerPage)

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

  return (
    <div className="container">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h2>Employés</h2>
        <div style={{display: 'flex', gap: 10, alignItems: 'center'}}>
          <span style={{fontSize: '0.8rem', color: '#64748b', background: '#f1f5f9', padding: '6px 10px', borderRadius: '999px'}}>Démo: matricule 99999</span>
          <Link to="/rh/timeline" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', background: '#021630', color: 'white',
            borderRadius: '6px', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 700,
          }}><Clock size={14}/> Parcours Employé</Link>
          <Link to="/rh/employees/new" className="button">Nouvel employé</Link>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="card" style={{marginBottom: 20}}>
        <div style={{display: 'flex', gap: '10px', marginBottom: '10px'}}>
          <input
            type="text"
            placeholder="Rechercher par nom, email, matricule, téléphone, fonction, catégorie, statut..."
            className="input"
            value={searchTerm}
            onChange={handleSearch}
            style={{flex: 1, padding: '10px 12px', fontSize: '0.95rem'}}
          />
          <button
            onClick={() => {
              setSearchTerm('')
              setSortConfig({key: 'nom', direction: 'asc'})
              setCurrentPage(1)
            }}
            style={{
              padding: '10px 16px',
              background: '#e5e7eb',
              color: '#1f2937',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '500'
            }}
          >
            Annuler
          </button>
        </div>
        <p style={{margin: '8px 0 0 0', color: '#64748b', fontSize: '0.85rem'}}>
          {filtered.length} employé{filtered.length !== 1 ? 's' : ''} trouvé{filtered.length !== 1 ? 's' : ''}
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
                  <th style={{cursor: 'pointer', userSelect: 'none'}} onClick={() => handleSort('id_direction')}>
                    Direction {sortConfig.key === 'id_direction' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '⇅'}
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
                      <td>{e.id_direction || '-'}</td>
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
            background: 'white',
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
              <p style={{margin: '0 0 6px 0', fontSize: '0.9rem', opacity: 0.8}}>Matricule: {selectedEmployee.matricule}</p>
              <h2 style={{margin: 0, fontSize: '1.5rem'}}>{selectedEmployee.nom} {selectedEmployee.prenom}</h2>
              <p style={{margin: '6px 0 0 0', fontSize: '0.9rem', opacity: 0.8}}>{selectedEmployee.email}</p>
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
              </div>
            </div>

            {/* Contenu */}
            <div style={{padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px'}}>
              {/* Informations Personnelles */}
              <div>
                <h3 style={{margin: '0 0 12px 0', color: '#1f2937', fontSize: '1.1rem', fontWeight: '600', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px'}}><ClipboardList size={16}/> Informations Personnelles</h3>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.9rem'}}>
                  <div><span style={{color: '#64748b'}}>Sexe:</span> <strong>{selectedEmployee.sexe || '-'}</strong></div>
                  <div><span style={{color: '#64748b'}}>Date de naissance:</span> <strong>{selectedEmployee.date_naissance ? new Date(selectedEmployee.date_naissance).toLocaleDateString('fr-FR') : '-'}</strong></div>
                  <div><span style={{color: '#64748b'}}>Âge:</span> <strong>{calculateAge(selectedEmployee.date_naissance)}</strong></div>
                  <div><span style={{color: '#64748b'}}>Téléphone:</span> <strong>{selectedEmployee.telephone || '-'}</strong></div>
                  <div><span style={{color: '#64748b'}}>Ville:</span> <strong>{selectedEmployee.ville || '-'}</strong></div>
                  <div style={{gridColumn: '1 / -1'}}><span style={{color: '#64748b'}}>Contact d'urgence:</span> <strong>{selectedEmployee.contact_urgence || '-'}</strong></div>
                </div>
              </div>

              {/* Informations Professionnelles */}
              <div>
                <h3 style={{margin: '0 0 12px 0', color: '#1f2937', fontSize: '1.1rem', fontWeight: '600', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px'}}><Briefcase size={16}/> Informations Professionnelles</h3>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.9rem'}}>
                  <div><span style={{color: '#64748b'}}>Diplôme:</span> <strong>{selectedEmployee.diplome || '-'}</strong></div>
                  <div><span style={{color: '#64748b'}}>Catégorie:</span> <strong>{selectedEmployee.categorie || '-'}</strong></div>
                  <div><span style={{color: '#64748b'}}>Années d'expérience:</span> <strong>{selectedEmployee.annee_experience ?? '-'} ans</strong></div>
                  <div><span style={{color: '#64748b'}}>N1 (Supérieur):</span> <strong>{employeeMap[selectedEmployee.n1] || selectedEmployee.n1 || '-'}</strong></div>
                  <div><span style={{color: '#64748b'}}>Date d'embauche:</span> <strong>{selectedEmployee.date_embauche ? new Date(selectedEmployee.date_embauche).toLocaleDateString('fr-FR') : '-'}</strong></div>
                  <div><span style={{color: '#64748b'}}>Ancienneté:</span> <strong>{calculateAnciennete(selectedEmployee.date_embauche)}</strong></div>
                  <div><span style={{color: '#64748b'}}>Solde de congés:</span> <strong>{selectedEmployee.solde_conges ?? '-'} jours</strong></div>
                </div>
              </div>

              {/* Positionnement Organisationnel */}
              <div>
                <h3 style={{margin: '0 0 12px 0', color: '#1f2937', fontSize: '1.1rem', fontWeight: '600', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px'}}><Building2 size={16}/> Positionnement Organisationnel</h3>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.9rem'}}>
                  <div><span style={{color: '#64748b'}}>Fonction:</span> <strong>{selectedEmployee.fonction || '-'}</strong></div>
                  <div><span style={{color: '#64748b'}}>Département:</span> <strong>{selectedEmployee.departement || '-'}</strong></div>
                  <div><span style={{color: '#64748b'}}>Direction:</span> <strong>{selectedEmployee.id_direction || '-'}</strong></div>
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
    </div>
  )
}
