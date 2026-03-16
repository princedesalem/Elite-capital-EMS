import React, {useEffect, useState} from 'react'
import {useAuth} from '../contexts/AuthContext'
import api from '../services/api'
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Sector
} from 'recharts'
import {
  User,
  ClipboardList,
  Briefcase,
  Calendar,
  Umbrella,
  CheckCircle,
  Clock
} from 'lucide-react'

export default function Dashboard(){
  const {user} = useAuth()
  const [employe, setEmploye] = useState(null)
  const [n1Info, setN1Info] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('personnel') // 'personnel', 'departements', 'organisation'
  const [activeSlices, setActiveSlices] = useState({})

  useEffect(() => {
    const loadEmployeInfo = async () => {
      try {
        setLoading(true)
        const matricule = Number(user?.matricule || user?.sub || 0)
        if (!matricule) {
          setError('Impossible de récupérer votre matricule')
          return
        }
        const res = await api.get(`/employees/${matricule}`)
        setEmploye(res.data)

        try {
          const analyticsRes = await api.get(`/dashboard/analytics/${matricule}`)
          setAnalytics(analyticsRes.data)
        } catch (analyticsError) {
          console.error('Impossible de charger analytics dashboard:', analyticsError)
        }
        
        // Charger le nom du N1 si disponible
        if (res.data?.n1) {
          try {
            const n1Res = await api.get(`/employees/${res.data.n1}`)
            setN1Info(n1Res.data)
          } catch (e) {
            console.error('Impossible de charger le N1:', e)
          }
        }
      } catch (e) {
        setError(e.response?.data?.detail || 'Impossible de charger vos informations')
      } finally {
        setLoading(false)
      }
    }
    loadEmployeInfo()
  }, [user])

  const calculateAnciennete = (dateEmbauche) => {
    if (!dateEmbauche) return 'N/A'
    const date = new Date(dateEmbauche)
    const today = new Date()
    const diffTime = today - date
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    const years = Math.floor(diffDays / 365.25)
    const months = Math.floor((diffDays % 365.25) / 30.44)
    
    if (years === 0) return `${months}m`
    if (months === 0) return `${years}a`
    return `${years}a ${months}m`
  }

  const calculateAge = (dateNaissance) => {
    if (!dateNaissance) return 'N/A'
    const birth = new Date(dateNaissance)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return `${age}ans`
  }

  const COLORS = ['#667eea', '#f5576c', '#4facfe', '#43e97b', '#fa709a', '#30cfd0', '#a8edea', '#FFE66D']

  const renderInteractivePie = (chartKey, data, nameKey, valueKey = 'count') => {
    const activeIndex = activeSlices[chartKey] ?? -1
    return (
      <>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              dataKey={valueKey}
              nameKey={nameKey}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={72}
              activeIndex={activeIndex}
              activeShape={(props) => <Sector {...props} outerRadius={84} />}
              onMouseEnter={(_, index) => setActiveSlices((prev) => ({ ...prev, [chartKey]: index }))}
              onClick={(_, index) => setActiveSlices((prev) => ({ ...prev, [chartKey]: prev[chartKey] === index ? -1 : index }))}
              label={({payload, percent}) => `${payload?.[nameKey] || 'N/A'} ${(percent * 100).toFixed(1)}%`}
              labelStyle={{ fontSize: '0.6rem', fontWeight: 'bold' }}
            >
              {data.map((entry, index) => (
                <Cell key={`${chartKey}-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, _name, props) => [value, `${props?.payload?.[nameKey] || 'Valeur'}`]}
              contentStyle={{ fontSize: '0.75rem' }}
            />
            <Legend wrapperStyle={{ fontSize: '0.68rem' }} />
          </PieChart>
        </ResponsiveContainer>
        {activeIndex >= 0 && data[activeIndex] && (
          <div style={{ fontSize: '0.72rem', marginTop: '4px', color: '#021630', background: '#f8f9fa', padding: '6px', borderRadius: '4px' }}>
            <strong>Détail:</strong> {data[activeIndex][nameKey]} = {data[activeIndex][valueKey]} ({((data[activeIndex][valueKey] / (data.reduce((s, d) => s + (d[valueKey] || 0), 0) || 1)) * 100).toFixed(1)}%)
          </div>
        )}
      </>
    )
  }

  return (
    <div style={{ padding: '8px', background: '#f8f9fa', minHeight: '100vh' }}>
      {error && (
        <div style={{ 
          background: '#fadbd8', 
          color: '#c0392b', 
          padding: '8px', 
          borderRadius: '4px', 
          marginBottom: '8px',
          border: '1px solid #ec7063',
          fontSize: '0.85rem'
        }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <p style={{ fontSize: '0.9rem' }}>Chargement...</p>
        </div>
      )}

      {!loading && employe && (
        <>
          {/* HEADER COMPACT */}
          <div style={{
            background: 'linear-gradient(135deg, #021630 0%, #ce2b2b 100%)',
            color: 'white',
            marginBottom: '8px',
            padding: '12px 16px',
            borderRadius: '6px',
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            gap: '16px',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={28} /></div>
            <div>
              <h1 style={{ margin: '0 0 4px 0', fontSize: '1.3em' }}>
                {employe.prenom} {employe.nom}
              </h1>
              <div style={{ fontSize: '0.8em', opacity: 0.9, display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{display:'inline-flex',alignItems:'center',gap:4}}><ClipboardList size={13}/> {employe.matricule}</span>
                <span style={{display:'inline-flex',alignItems:'center',gap:4}}><Briefcase size={13}/> {employe.fonction || 'N/A'}</span>
                <span style={{display:'inline-flex',alignItems:'center',gap:4}}><Calendar size={13}/> {calculateAnciennete(employe.date_embauche)}</span>
                <span style={{display:'inline-flex',alignItems:'center',gap:4}}><Umbrella size={13}/> {employe.solde_conges ?? 'N/A'}j</span>
              </div>
            </div>
            <div style={{ 
              padding: '8px 12px', 
              background: 'rgba(255,255,255,0.2)', 
              borderRadius: '4px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.75em', opacity: 0.9 }}>Rôle</div>
              <div style={{ fontSize: '0.9em', fontWeight: 'bold' }}>{employe.role || user?.role || 'N/A'}</div>
            </div>
          </div>

          {/* GRID 3 COLONNES INFO PERSONNELLES */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '8px' }}>
            <div style={{ background: 'white', padding: '10px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#021630', borderBottom: '2px solid #ce2b2b', paddingBottom: '4px' }}>Personnel</h3>
              <div style={{ fontSize: '0.75rem', lineHeight: '1.6' }}>
                <div><strong>Naissance:</strong> {employe.date_naissance ? new Date(employe.date_naissance).toLocaleDateString('fr-FR') : 'N/A'} ({calculateAge(employe.date_naissance)})</div>
                <div><strong>Sexe:</strong> {employe.sexe || 'N/A'}</div>
                <div><strong>Email:</strong> {employe.email || 'N/A'}</div>
                <div><strong>Tél:</strong> {employe.telephone || 'N/A'}</div>
                <div><strong>Ville:</strong> {employe.ville || 'N/A'}</div>
                <div><strong>Urgence:</strong> {employe.contact_urgence || 'N/A'}</div>
              </div>
            </div>

            <div style={{ background: 'white', padding: '10px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#021630', borderBottom: '2px solid #ce2b2b', paddingBottom: '4px' }}>Professionnel</h3>
              <div style={{ fontSize: '0.75rem', lineHeight: '1.6' }}>
                <div><strong>Embauche:</strong> {employe.date_embauche ? new Date(employe.date_embauche).toLocaleDateString('fr-FR') : 'N/A'}</div>
                <div><strong>Ancienneté:</strong> {calculateAnciennete(employe.date_embauche)}</div>
                <div><strong>Diplôme:</strong> {employe.diplome || 'N/A'}</div>
                <div><strong>Catégorie:</strong> {employe.categorie || 'N/A'}</div>
                <div><strong>Expérience:</strong> {employe.annee_experience ?? 'N/A'} ans</div>
                <div><strong>N+1:</strong> {n1Info ? `${n1Info.prenom} ${n1Info.nom}` : (employe.n1 || 'N/A')}</div>
              </div>
            </div>

            <div style={{ background: 'white', padding: '10px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#021630', borderBottom: '2px solid #ce2b2b', paddingBottom: '4px' }}>Organisation</h3>
              <div style={{ fontSize: '0.75rem', lineHeight: '1.6' }}>
                <div><strong>Fonction:</strong> {employe.fonction || 'N/A'}</div>
                <div><strong>Département:</strong> {employe.dept_id || 'N/A'}</div>
                <div><strong>Direction:</strong> {employe.id_direction || 'N/A'}</div>
                <div><strong>Entité:</strong> {employe.id_entite || 'N/A'}</div>
                <div><strong>Rôle:</strong> {employe.role || user?.role || 'N/A'}</div>
                <div><strong>Statut:</strong> <span style={{ color: employe.statut_employe === 'ACTIF' ? '#27ae60' : '#e74c3c' }}>{employe.statut_employe || 'N/A'}</span></div>
              </div>
            </div>
          </div>

          {/* ANALYTICS */}
          {analytics && (
            <>
              {/* ONGLETS (si role supérieur à EMPLOYE) */}
              {['RESPONSABLE', 'DIRECTEUR', 'DG', 'RH', 'ADMIN', 'PCA', 'AG'].includes(employe.role || user?.role) && (
                <div style={{ 
                  display: 'flex', 
                  gap: '6px', 
                  marginTop: '8px', 
                  marginBottom: '8px',
                  borderBottom: '2px solid #ddd',
                  background: 'white',
                  padding: '8px',
                  borderRadius: '6px 6px 0 0'
                }}>
                  <button 
                    onClick={() => setActiveTab('personnel')}
                    style={{
                      padding: '8px 16px',
                      background: activeTab === 'personnel' ? 'linear-gradient(135deg, #021630 0%, #ce2b2b 100%)' : '#f0f0f0',
                      color: activeTab === 'personnel' ? 'white' : '#333',
                      border: 'none',
                      borderRadius: '4px 4px 0 0',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: activeTab === 'personnel' ? 'bold' : 'normal'
                    }}
                  >
                    Personnel
                  </button>
                  <button 
                    onClick={() => setActiveTab('departements')}
                    style={{
                      padding: '8px 16px',
                      background: activeTab === 'departements' ? 'linear-gradient(135deg, #021630 0%, #ce2b2b 100%)' : '#f0f0f0',
                      color: activeTab === 'departements' ? 'white' : '#333',
                      border: 'none',
                      borderRadius: '4px 4px 0 0',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: activeTab === 'departements' ? 'bold' : 'normal'
                    }}
                  >
                    Entreprise - Départements
                  </button>
                  <button 
                    onClick={() => setActiveTab('organisation')}
                    style={{
                      padding: '8px 16px',
                      background: activeTab === 'organisation' ? 'linear-gradient(135deg, #021630 0%, #ce2b2b 100%)' : '#f0f0f0',
                      color: activeTab === 'organisation' ? 'white' : '#333',
                      border: 'none',
                      borderRadius: '4px 4px 0 0',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: activeTab === 'organisation' ? 'bold' : 'normal'
                    }}
                  >
                    Entreprise - Organisation
                  </button>
                </div>
              )}

              {/* DASHBOARD PERSONNEL */}
              {(activeTab === 'personnel' || !['RESPONSABLE', 'DIRECTEUR', 'DG', 'RH', 'ADMIN', 'PCA', 'AG'].includes(employe.role || user?.role)) && (
              <>
              {/* TITRE SECTION MES OPÉRATIONS */}
              <div style={{ 
                background: 'linear-gradient(135deg, #021630 0%, #ce2b2b 100%)',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '6px',
                marginTop: '8px',
                marginBottom: '6px'
              }}>
                <h2 style={{ margin: 0, fontSize: '1rem' }}>Mes Opérations Personnelles</h2>
              </div>

              {/* MES OPÉRATIONS - KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '8px' }}>
                <div style={{ 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  textAlign: 'center',
                  padding: '10px 6px',
                  borderRadius: '6px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ display:'flex', justifyContent:'center' }}><ClipboardList size={20} /></div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 'bold', margin: '4px 0' }}>
                    {analytics.mes_operations?.total || 0}
                  </div>
                  <div style={{ opacity: 0.9, fontSize: '0.7rem' }}>Mes Opérations</div>
                </div>

                <div style={{ 
                  background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                  color: 'white',
                  textAlign: 'center',
                  padding: '10px 6px',
                  borderRadius: '6px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ display:'flex', justifyContent:'center' }}><CheckCircle size={20} /></div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 'bold', margin: '4px 0' }}>
                    {analytics.mes_operations?.by_statut?.find(s => s.statut === 'validé')?.count || 0}
                  </div>
                  <div style={{ opacity: 0.9, fontSize: '0.7rem' }}>Validées</div>
                </div>

                <div style={{ 
                  background: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
                  color: 'white',
                  textAlign: 'center',
                  padding: '10px 6px',
                  borderRadius: '6px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ display:'flex', justifyContent:'center' }}><Clock size={20} /></div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 'bold', margin: '4px 0' }}>
                    {analytics.mes_operations?.by_statut?.find(s => s.statut === 'en attente')?.count || 0}
                  </div>
                  <div style={{ opacity: 0.9, fontSize: '0.7rem' }}>En Attente</div>
                </div>
              </div>

              {/* MES OPÉRATIONS - Graphiques */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '12px' }}>
                {/* Mes Opérations par Type */}
                {analytics.mes_operations?.by_type && analytics.mes_operations.by_type.length > 0 && (
                  <div style={{ background: 'white', padding: '10px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#021630' }}>Mes Opérations par Type</h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={analytics.mes_operations.by_type}
                          dataKey="count"
                          nameKey="type"
                          cx="50%"
                          cy="50%"
                          outerRadius={60}
                          label={(entry) => entry.type?.substring(0, 8)}
                          labelStyle={{ fontSize: '0.6rem' }}
                        >
                          {analytics.mes_operations.by_type.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: '0.75rem' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Mes Opérations par Statut */}
                {analytics.mes_operations?.by_statut && analytics.mes_operations.by_statut.length > 0 && (
                  <div style={{ background: 'white', padding: '10px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#021630' }}>Mes Opérations par Statut</h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={analytics.mes_operations.by_statut}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="statut" tick={{ fontSize: '0.65rem' }} />
                        <YAxis tick={{ fontSize: '0.65rem' }} />
                        <Tooltip contentStyle={{ fontSize: '0.75rem' }} />
                        <Bar dataKey="count" fill="#43e97b" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
              </>
              )}

              {/* ONGLET DÉPARTEMENTS - Opérations et Employés */}
              {activeTab === 'departements' && analytics.perimetre && analytics.perimetre.total_operations > 0 && (
                <>
                  <div style={{ 
                    background: 'linear-gradient(135deg, #021630 0%, #ce2b2b 100%)',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    marginTop: '8px',
                    marginBottom: '6px'
                  }}>
                    <h2 style={{ margin: 0, fontSize: '1rem' }}>
                      Entreprise - Départements ({analytics.role || ''})
                    </h2>
                  </div>

                  {/* PÉRIMÈTRE - KPIs EFFECTIF */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '8px' }}>
                    <div style={{ 
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      textAlign: 'center',
                      padding: '10px 6px',
                      borderRadius: '6px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                      <div style={{ fontSize: '1.2rem' }}>Employés</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 'bold', margin: '4px 0' }}>
                        {analytics.perimetre.total_employes || 0}
                      </div>
                      <div style={{ opacity: 0.9, fontSize: '0.7rem' }}>Total Employés</div>
                    </div>

                    <div style={{ 
                      background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                      color: 'white',
                      textAlign: 'center',
                      padding: '10px 6px',
                      borderRadius: '6px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                      <div style={{ fontSize: '1.2rem' }}>Hommes</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 'bold', margin: '4px 0' }}>
                        {analytics.perimetre?.kpis?.hommes || 0}
                      </div>
                      <div style={{ opacity: 0.9, fontSize: '0.7rem' }}>
                        Hommes ({analytics.perimetre?.kpis?.hommes_pct || 0}%)
                      </div>
                    </div>

                    <div style={{ 
                      background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                      color: 'white',
                      textAlign: 'center',
                      padding: '10px 6px',
                      borderRadius: '6px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                      <div style={{ fontSize: '1.2rem' }}>Femmes</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 'bold', margin: '4px 0' }}>
                        {analytics.perimetre?.kpis?.femmes || 0}
                      </div>
                      <div style={{ opacity: 0.9, fontSize: '0.7rem' }}>
                        Femmes ({analytics.perimetre?.kpis?.femmes_pct || 0}%)
                      </div>
                    </div>

                    <div style={{ 
                      background: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
                      color: 'white',
                      textAlign: 'center',
                      padding: '10px 6px',
                      borderRadius: '6px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                      <div style={{ display:'flex', justifyContent:'center' }}><ClipboardList size={20} /></div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 'bold', margin: '4px 0' }}>
                        {analytics.perimetre?.total_operations || 0}
                      </div>
                      <div style={{ opacity: 0.9, fontSize: '0.7rem' }}>Opérations</div>
                    </div>
                  </div>

                  {/* PÉRIMÈTRE - KPIs PAR CATÉGORIE */}
                  {analytics.perimetre?.kpis?.by_categorie && analytics.perimetre.kpis.by_categorie.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '8px', background: 'white', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#021630', fontWeight: 'bold' }}>Répartition par Catégorie</h3>
                    </div>
                    {analytics.perimetre.kpis.by_categorie.map((cat) => (
                      <div key={cat.categorie} style={{ 
                        background: '#f9f9f9', 
                        padding: '8px', 
                        borderRadius: '4px',
                        borderLeft: '3px solid #ce2b2b'
                      }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#333' }}>{cat.categorie}</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#ce2b2b' }}>
                          {cat.count} ({cat.pct}%)
                        </div>
                      </div>
                    ))}
                  </div>
                  )}

                  {/* PÉRIMÈTRE - KPIs PAR RÔLE */}
                  {analytics.perimetre?.kpis?.by_role && analytics.perimetre.kpis.by_role.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '8px', background: 'white', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#021630', fontWeight: 'bold' }}>Répartition par Rôle</h3>
                    </div>
                    {analytics.perimetre.kpis.by_role.map((role) => (
                      <div key={role.role} style={{ 
                        background: '#f9f9f9', 
                        padding: '8px', 
                        borderRadius: '4px',
                        borderLeft: '3px solid #667eea'
                      }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#333' }}>{role.role}</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#667eea' }}>
                          {role.count} ({role.pct}%)
                        </div>
                      </div>
                    ))}
                  </div>
                  )}

                  {/* PÉRIMÈTRE - KPIs PAR VILLE */}
                  {analytics.perimetre?.kpis?.by_ville && analytics.perimetre.kpis.by_ville.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '8px', background: 'white', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#021630', fontWeight: 'bold' }}>Répartition par Ville</h3>
                    </div>
                    {analytics.perimetre.kpis.by_ville.map((ville) => (
                      <div key={ville.ville} style={{ 
                        background: '#f9f9f9', 
                        padding: '8px', 
                        borderRadius: '4px',
                        borderLeft: '3px solid #30cfd0'
                      }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#333' }}>{ville.ville}</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#30cfd0' }}>
                          {ville.count} ({ville.pct}%)
                        </div>
                      </div>
                    ))}
                  </div>
                  )}

                  {/* PÉRIMÈTRE - KPIs PAR ÂGE */}
                  {analytics.perimetre?.kpis?.by_age && analytics.perimetre.kpis.by_age.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '8px', background: 'white', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#021630', fontWeight: 'bold' }}>Répartition par Tranche d'Âge</h3>
                    </div>
                    {analytics.perimetre.kpis.by_age.map((age) => (
                      <div key={age.tranche} style={{ 
                        background: '#f9f9f9', 
                        padding: '8px', 
                        borderRadius: '4px',
                        borderLeft: '3px solid #fa709a'
                      }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#333' }}>{age.tranche} ans</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#fa709a' }}>
                          {age.count} ({age.pct}%)
                        </div>
                      </div>
                    ))}
                  </div>
                  )}
                  {/* PÉRIMÈTRE - Graphiques */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '12px' }}>
                    {/* Opérations Périmètre par Type */}
                    {analytics.perimetre?.by_type && analytics.perimetre.by_type.length > 0 && (
                      <div style={{ background: 'white', padding: '10px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#021630' }}>Opérations par Type</h3>
                        {renderInteractivePie('perimetre_by_type', analytics.perimetre.by_type, 'type')}
                      </div>
                    )}

                    {/* Opérations Périmètre par Statut */}
                    {analytics.perimetre?.by_statut && analytics.perimetre.by_statut.length > 0 && (
                      <div style={{ background: 'white', padding: '10px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#021630' }}>Opérations par Statut</h3>
                        <ResponsiveContainer width="100%" height={180}>
                          <PieChart>
                            <Pie
                              data={analytics.perimetre.by_statut}
                              dataKey="count"
                              nameKey="statut"
                              cx="50%"
                              cy="50%"
                              outerRadius={60}
                              label={(entry) => entry.statut}
                              labelStyle={{ fontSize: '0.6rem' }}
                            >
                              {analytics.perimetre.by_statut.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ fontSize: '0.75rem' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Opérations par Sexe */}
                    {analytics.perimetre?.kpis?.operations_by_sexe && analytics.perimetre.kpis.operations_by_sexe.length > 0 && (
                      <div style={{ background: 'white', padding: '10px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#021630' }}>Employés Opérations par Sexe</h3>
                        {renderInteractivePie('operations_by_sexe', analytics.perimetre.kpis.operations_by_sexe, 'sexe')}
                      </div>
                    )}

                    {/* Opérations par Type ET Sexe */}
                    {analytics.perimetre?.kpis?.operations_by_type_and_sexe && analytics.perimetre.kpis.operations_by_type_and_sexe.length > 0 && (
                      <div style={{ background: 'white', padding: '10px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#021630' }}>Opérations: Type & Sexe</h3>
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={analytics.perimetre.kpis.operations_by_type_and_sexe}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="type" tick={{ fontSize: '0.6rem' }} angle={-45} textAnchor="end" height={80} />
                            <YAxis tick={{ fontSize: '0.65rem' }} />
                            <Tooltip contentStyle={{ fontSize: '0.75rem' }} />
                            <Legend />
                            <Bar dataKey="hommes" fill="#4facfe" />
                            <Bar dataKey="femmes" fill="#fa709a" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Employés par Sexe */}
                    {analytics.perimetre?.kpis?.by_sexe && analytics.perimetre.kpis.by_sexe.length > 0 && (
                      <div style={{ background: 'white', padding: '10px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#021630' }}>Employés par Sexe</h3>
                        <ResponsiveContainer width="100%" height={180}>
                          <PieChart>
                            <Pie
                              data={analytics.perimetre.kpis.by_sexe}
                              dataKey="count"
                              nameKey="sexe"
                              cx="50%"
                              cy="50%"
                              outerRadius={60}
                              label={(entry) => `${entry.sexe} (${entry.pct}%)`}
                              labelStyle={{ fontSize: '0.65rem' }}
                            >
                              {analytics.perimetre.kpis.by_sexe.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.sexe === 'M' ? '#4facfe' : '#fa709a'} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ fontSize: '0.75rem' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Employés par Catégorie */}
                    {analytics.perimetre?.kpis?.by_categorie && analytics.perimetre.kpis.by_categorie.length > 0 && (
                      <div style={{ background: 'white', padding: '10px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#021630' }}>Par Catégorie</h3>
                        {renderInteractivePie('by_categorie', analytics.perimetre.kpis.by_categorie, 'categorie')}
                      </div>
                    )}

                    {/* Employés par Rôle */}
                    {analytics.perimetre?.kpis?.by_role && analytics.perimetre.kpis.by_role.length > 0 && (
                      <div style={{ background: 'white', padding: '10px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#021630' }}>Par Rôle</h3>
                        {renderInteractivePie('by_role', analytics.perimetre.kpis.by_role, 'role')}
                      </div>
                    )}

                    {/* Employés par Ville */}
                    {analytics.perimetre?.kpis?.by_ville && analytics.perimetre.kpis.by_ville.length > 0 && (
                      <div style={{ background: 'white', padding: '10px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#021630' }}>Par Ville</h3>
                        {renderInteractivePie('by_ville', analytics.perimetre.kpis.by_ville, 'ville')}
                      </div>
                    )}

                    {/* Employés par Pays */}
                    {analytics.perimetre?.kpis?.by_pays && analytics.perimetre.kpis.by_pays.length > 0 && (
                      <div style={{ background: 'white', padding: '10px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#021630' }}>Par Pays</h3>
                        {renderInteractivePie('by_pays', analytics.perimetre.kpis.by_pays, 'pays')}
                      </div>
                    )}

                    {/* Employés par Âge */}
                    {analytics.perimetre?.kpis?.by_age && analytics.perimetre.kpis.by_age.length > 0 && (
                      <div style={{ background: 'white', padding: '10px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#021630' }}>Par Âge</h3>
                        {renderInteractivePie('by_age', analytics.perimetre.kpis.by_age, 'tranche')}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ONGLET ORGANISATION - Pays, Villes, KPIs Géographiques */}
              {activeTab === 'organisation' && analytics.show_org_stats && (
                <>
                  <div style={{ 
                    background: 'linear-gradient(135deg, #021630 0%, #ce2b2b 100%)',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    marginTop: '8px',
                    marginBottom: '6px'
                  }}>
                    <h2 style={{ margin: 0, fontSize: '1rem' }}>Entreprise - Organisation</h2>
                  </div>

                  {/* ORGANISATION - KPIs PAR PAYS */}
                  {analytics.perimetre?.kpis?.by_pays && analytics.perimetre.kpis.by_pays.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '8px', background: 'white', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#021630', fontWeight: 'bold' }}>Répartition par Pays</h3>
                    </div>
                    {analytics.perimetre.kpis.by_pays.map((pays) => (
                      <div key={pays.pays} style={{ 
                        background: '#f9f9f9', 
                        padding: '8px', 
                        borderRadius: '4px',
                        borderLeft: '3px solid #43e97b'
                      }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#333' }}>{pays.pays}</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#43e97b' }}>
                          {pays.count} ({pays.pct}%)
                        </div>
                      </div>
                    ))}
                  </div>
                  )}

                  {/* ORGANISATION - KPIs PAR VILLE */}
                  {analytics.perimetre?.kpis?.by_ville && analytics.perimetre.kpis.by_ville.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '8px', background: 'white', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#021630', fontWeight: 'bold' }}>Répartition par Ville</h3>
                    </div>
                    {analytics.perimetre.kpis.by_ville.map((ville) => (
                      <div key={ville.ville} style={{ 
                        background: '#f9f9f9', 
                        padding: '8px', 
                        borderRadius: '4px',
                        borderLeft: '3px solid #30cfd0'
                      }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#333' }}>{ville.ville}</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#30cfd0' }}>
                          {ville.count} ({ville.pct}%)
                        </div>
                      </div>
                    ))}
                  </div>
                  )}

                  {/* ORGANISATION - KPIs PAR ÂGE */}
                  {analytics.perimetre?.kpis?.by_age && analytics.perimetre.kpis.by_age.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '8px', background: 'white', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#021630', fontWeight: 'bold' }}>Répartition par Tranche d'Âge</h3>
                    </div>
                    {analytics.perimetre.kpis.by_age.map((age) => (
                      <div key={age.tranche} style={{ 
                        background: '#f9f9f9', 
                        padding: '8px', 
                        borderRadius: '4px',
                        borderLeft: '3px solid #fa709a'
                      }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#333' }}>{age.tranche} ans</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#fa709a' }}>
                          {age.count} ({age.pct}%)
                        </div>
                      </div>
                    ))}
                  </div>
                  )}

                  {/* ORGANISATION - Graphiques par Entités/Directions/Départements */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {/* Employés par Entité */}
                    {analytics.organisation?.employes_by_entite && analytics.organisation.employes_by_entite.length > 0 && (
                      <div style={{ background: 'white', padding: '10px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#021630' }}>Par Entité</h3>
                        {renderInteractivePie('org_entite', analytics.organisation.employes_by_entite, 'entite')}
                      </div>
                    )}

                    {/* Employés par Direction */}
                    {analytics.organisation?.employes_by_direction && analytics.organisation.employes_by_direction.length > 0 && (
                      <div style={{ background: 'white', padding: '10px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#021630' }}>Opérations Par Direction</h3>
                        {renderInteractivePie('org_direction', analytics.organisation.employes_by_direction, 'direction')}
                      </div>
                    )}

                    {/* Employés par Département */}
                    {analytics.organisation?.employes_by_departement && analytics.organisation.employes_by_departement.length > 0 && (
                      <div style={{ background: 'white', padding: '10px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#021630' }}>Par Département</h3>
                        {renderInteractivePie('org_departement', analytics.organisation.employes_by_departement, 'departement')}
                      </div>
                    )}

                    {/* Directions par Ville */}
                    {analytics.perimetre?.org_structure_by_geo?.directions_by_ville && analytics.perimetre.org_structure_by_geo.directions_by_ville.length > 0 && (
                      <div style={{ background: 'white', padding: '10px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#021630' }}>Directions par Ville</h3>
                        {renderInteractivePie('dir_ville', analytics.perimetre.org_structure_by_geo.directions_by_ville, 'ville')}
                      </div>
                    )}

                    {/* Directions par Pays */}
                    {analytics.perimetre?.org_structure_by_geo?.directions_by_pays && analytics.perimetre.org_structure_by_geo.directions_by_pays.length > 0 && (
                      <div style={{ background: 'white', padding: '10px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#021630' }}>Directions par Pays</h3>
                        {renderInteractivePie('dir_pays', analytics.perimetre.org_structure_by_geo.directions_by_pays, 'pays')}
                      </div>
                    )}

                    {/* Départements par Ville */}
                    {analytics.perimetre?.org_structure_by_geo?.departments_by_ville && analytics.perimetre.org_structure_by_geo.departments_by_ville.length > 0 && (
                      <div style={{ background: 'white', padding: '10px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#021630' }}>Départements par Ville</h3>
                        {renderInteractivePie('dept_ville', analytics.perimetre.org_structure_by_geo.departments_by_ville, 'ville')}
                      </div>
                    )}

                    {/* Départements par Pays */}
                    {analytics.perimetre?.org_structure_by_geo?.departments_by_pays && analytics.perimetre.org_structure_by_geo.departments_by_pays.length > 0 && (
                      <div style={{ background: 'white', padding: '10px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#021630' }}>Départements par Pays</h3>
                        {renderInteractivePie('dept_pays', analytics.perimetre.org_structure_by_geo.departments_by_pays, 'pays')}
                      </div>
                    )}

                    {/* Entités par Ville */}
                    {analytics.perimetre?.org_structure_by_geo?.entities_by_ville && analytics.perimetre.org_structure_by_geo.entities_by_ville.length > 0 && (
                      <div style={{ background: 'white', padding: '10px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#021630' }}>Entités par Ville</h3>
                        {renderInteractivePie('entity_ville', analytics.perimetre.org_structure_by_geo.entities_by_ville, 'ville')}
                      </div>
                    )}

                    {/* Entités par Pays */}
                    {analytics.perimetre?.org_structure_by_geo?.entities_by_pays && analytics.perimetre.org_structure_by_geo.entities_by_pays.length > 0 && (
                      <div style={{ background: 'white', padding: '10px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#021630' }}>Entités par Pays</h3>
                        {renderInteractivePie('entity_pays', analytics.perimetre.org_structure_by_geo.entities_by_pays, 'pays')}
                      </div>
                    )}

                    {/* Info Département (pour RESPONSABLE) */}
                    {analytics.organisation?.departement && (
                      <div style={{ background: 'white', padding: '10px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#021630' }}>Mon Département</h3>
                        <div style={{ fontSize: '0.75rem', lineHeight: '1.6', marginTop: '20px' }}>
                          <div><strong>Nom:</strong> {analytics.organisation.departement.nom}</div>
                          <div><strong>Total Employés:</strong> {analytics.organisation.departement.total_employes}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {!loading && !employe && !error && (
        <div style={{ background: 'white', padding: '20px', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <p>Impossible de charger vos informations</p>
        </div>
      )}
    </div>
  )
}
