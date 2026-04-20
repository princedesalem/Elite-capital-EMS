import React, {useEffect, useState} from 'react'
import {useAuth} from '../contexts/AuthContext'
import api from '../services/api'
import {Settings, FileDown} from 'lucide-react'


export const STATUT_COLORS_MAP = {
  'validé': '#16a34a',
  'valide': '#16a34a',
  'en attente': '#d97706',
  'refusé': '#dc2626',
  'refuse': '#dc2626',
}
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
  const [activeTab, setActiveTab] = useState('personnel') // 'personnel', 'departements'
  const [activeSlices, setActiveSlices] = useState({})
  const [filterMois, setFilterMois] = useState(null)
  const [filterAnnee, setFilterAnnee] = useState(null)

  // ── Widget config ──
  const WIDGET_DEFS = [
    { id: 'profil', label: 'Mon Profil' },
    { id: 'stats_perso', label: 'Mes statistiques' },
    { id: 'conges', label: 'Solde & congés' },
    { id: 'missions', label: 'Mes missions' },
    { id: 'org', label: 'Données organisation' },
    { id: 'charts', label: 'Graphiques' },
  ]
  const _widgetKey = () => `ems_widgets_${user?.matricule || 'default'}`
  const [widgets, setWidgets] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(_widgetKey()) || 'null')
      if (saved && typeof saved === 'object') return saved
    } catch {}
    return Object.fromEntries(WIDGET_DEFS.map(w => [w.id, true]))
  })
  const [showWidgetConfig, setShowWidgetConfig] = useState(false)

  const toggleWidget = (id) => {
    setWidgets(prev => {
      const next = { ...prev, [id]: !prev[id] }
      try { localStorage.setItem(_widgetKey(), JSON.stringify(next)) } catch {}
      return next
    })
  }

  const normalizedRole = String(analytics?.role || employe?.role || user?.role || '').toUpperCase()
  const canViewRhDashboard = Boolean(analytics?.show_org_stats)

  const getDashboardLabel = (role) => {
    const upperRole = String(role || '').toUpperCase()
    switch(upperRole) {
      case 'RESPONSABLE':
        return 'Dashboard Département'
      case 'DIRECTEUR':
        return 'Dashboard Direction'
      case 'RH':
      case 'ADMIN':
        return 'Dashboard RH'
      case 'DG':
        return 'Dashboard Entité'
      case 'PCA':
      case 'AG':
        return 'Dashboard Entités'
      default:
        return 'Dashboard RH'
    }
  }

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
          const params = new URLSearchParams()
          if (filterMois) params.append('mois', filterMois)
          if (filterAnnee) params.append('annee', filterAnnee)
          const analyticsRes = await api.get(`/dashboard/analytics/${matricule}?${params.toString()}`)
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

  useEffect(() => {
    if (!employe) return
    const fetchFiltered = async () => {
      try {
        const mat = Number(employe.matricule)
        const params = new URLSearchParams()
        if (filterMois) params.append('mois', filterMois)
        if (filterAnnee) params.append('annee', filterAnnee)
        const res = await api.get(`/dashboard/analytics/${mat}?${params.toString()}`)
        setAnalytics(res.data)
      } catch (e) {}
    }
    fetchFiltered()
  }, [filterMois, filterAnnee])

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

  // Palette corporate: bleu marine → bleu acier → teal → vert ardoise → brun or → violet ardoise
  const COLORS = ['#1b4f9e', '#2e75b6', '#3a9ab2', '#4e8c7a', '#7a5c2d', '#5e4a8e', '#4a6878', '#8c6040']

  const STATUT_COLORS = {
    'validé': '#16a34a',
    'valide': '#16a34a',
    'en attente': '#d97706',
    'refusé': '#dc2626',
    'refuse': '#dc2626',
  }

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

  const OP_COLORS = {
    'Congé': '#1b4f9e', 'conge': '#1b4f9e',
    'Permission': '#3a9ab2', 'permission': '#3a9ab2',
    'Mission': '#4a3470', 'mission': '#4a3470',
    'Sortie': '#7a5c2d', 'sortie': '#7a5c2d',
  }

  const renderOpsHistogram = (data, title) => {
    if (!data || data.length === 0) return null
    const typeKeys = [...new Set(data.flatMap(d => Object.keys(d).filter(k => k !== 'name')))]
    return (
      <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 12px rgba(2,22,48,0.09)', gridColumn: '1 / -1', borderTop: '3px solid #1b4f9e' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '0.88rem', color: '#021630', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: '0.75rem' }} angle={-35} textAnchor="end" height={90} interval={0} />
            <YAxis tick={{ fontSize: '0.75rem' }} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: '0.85rem' }} />
            <Legend wrapperStyle={{ fontSize: '0.8rem', paddingTop: 6 }} />
            {typeKeys.map((type, i) => (
              <Bar key={type} dataKey={type} name={type}
                   fill={OP_COLORS[type] || COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  const renderGeoBarChart = (data, nameKey, title) => {
    if (!data || data.length === 0) return null
    return (
      <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 12px rgba(2,22,48,0.09)', borderTop: '3px solid #1b4f9e' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '0.88rem', color: '#021630', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey={nameKey} tick={{ fontSize: '0.75rem' }} angle={-35} textAnchor="end" height={90} interval={0} />
            <YAxis tick={{ fontSize: '0.75rem' }} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: '0.85rem' }} />
            <Bar dataKey="count" fill="#1b4f9e" radius={[4, 4, 0, 0]}
                 label={{ position: 'top', fontSize: '0.75rem', fill: '#021630' }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Widget config panel */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8, position: 'relative', gap: 8 }}>
        {['ADMIN','RH','DG','PCA','AG','DIRECTEUR'].includes(normalizedRole) && (<>
          <button
            onClick={() => { api.get('/api/pdf/report/employees', { responseType: 'blob' }).then(res => { const url = URL.createObjectURL(res.data); const a = document.createElement('a'); a.href = url; a.download = 'rapport_employes.pdf'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url) }) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}
            title="Télécharger le rapport des employés en PDF"
          >
            <FileDown size={14} /> Rapport employés
          </button>
          <button
            onClick={() => { api.get('/api/pdf/report/analytics', { responseType: 'blob' }).then(res => { const url = URL.createObjectURL(res.data); const a = document.createElement('a'); a.href = url; a.download = 'rapport_analytics.pdf'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url) }) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}
            title="Télécharger le rapport analytique RH en PDF"
          >
            <FileDown size={14} /> Rapport RH
          </button>
        </>)}
        <button
          onClick={() => setShowWidgetConfig(p => !p)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}
        >
          <Settings size={14} /> Widgets
        </button>
        {showWidgetConfig && (
          <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 200, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, boxShadow: '0 12px 32px rgba(0,0,0,0.18)', minWidth: 220, marginTop: 6 }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)', marginBottom: 10 }}>{"Afficher / masquer les widgets"}</div>
            {WIDGET_DEFS.map(w => (
              <label key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', cursor: 'pointer', fontSize: '0.84rem', color: 'var(--text)' }}>
                <input
                  type="checkbox"
                  checked={!!widgets[w.id]}
                  onChange={() => toggleWidget(w.id)}
                  style={{ cursor: 'pointer', width: 16, height: 16 }}
                />
                {w.label}
              </label>
            ))}
          </div>
        )}
      </div>
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
          <p style={{ fontSize: '0.9rem' }}>{"Chargement..."}</p>
        </div>
      )}

      {!loading && employe && (
        <>
          {/* HEADER COMPACT */}
          {widgets.profil !== false && <div style={{
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
          </div>}

          {/* GRID 3 COLONNES INFO PERSONNELLES */}
          {widgets.profil !== false && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '8px' }}>
            <div style={{ background: 'white', padding: '16px', borderRadius: '10px', boxShadow: '0 1px 8px rgba(2,22,48,0.08)' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '0.78rem', color: '#6b7280', borderBottom: '2px solid #1b4f9e', paddingBottom: '6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{"Informations personnelles"}</h3>
              <div style={{ fontSize: '0.75rem', lineHeight: '1.6' }}>
                <div><strong>{"Naissance"}</strong> {employe.date_naissance ? new Date(employe.date_naissance).toLocaleDateString('fr-FR') : 'N/A'} ({calculateAge(employe.date_naissance)})</div>
                <div><strong>{"Sexe"}</strong> {employe.sexe || 'N/A'}</div>
                <div><strong>{"Email"}</strong> {employe.email || 'N/A'}</div>
                <div><strong>{"Téléphone"}</strong> {employe.telephone || 'N/A'}</div>
                <div><strong>{"Ville"}</strong> {employe.ville || 'N/A'}</div>
                <div><strong>{"Contact d'urgence"}</strong> {employe.contact_urgence || 'N/A'}</div>
              </div>
            </div>

            <div style={{ background: 'white', padding: '16px', borderRadius: '10px', boxShadow: '0 1px 8px rgba(2,22,48,0.08)' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '0.78rem', color: '#6b7280', borderBottom: '2px solid #1b4f9e', paddingBottom: '6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{"Informations professionnelles"}</h3>
              <div style={{ fontSize: '0.75rem', lineHeight: '1.6' }}>
                <div><strong>{"Embauche"}</strong> {employe.date_embauche ? new Date(employe.date_embauche).toLocaleDateString('fr-FR') : 'N/A'}</div>
                <div><strong>Ancienneté:</strong> {calculateAnciennete(employe.date_embauche)}</div>
                <div><strong>{"Diplôme"}</strong> {employe.diplome || 'N/A'}</div>
                <div><strong>{"Catégorie"}</strong> {employe.categorie || 'N/A'}</div>
                <div><strong>{"Expérience"}</strong> {employe.annee_experience ?? 'N/A'} ans</div>
                <div><strong>{"N+1"}</strong> {n1Info ? `${n1Info.prenom} ${n1Info.nom}` : (employe.n1 || 'N/A')}</div>
              </div>
            </div>

            <div style={{ background: 'white', padding: '16px', borderRadius: '10px', boxShadow: '0 1px 8px rgba(2,22,48,0.08)' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '0.78rem', color: '#6b7280', borderBottom: '2px solid #1b4f9e', paddingBottom: '6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{"Organisation"}</h3>
              <div style={{ fontSize: '0.75rem', lineHeight: '1.6' }}>
                <div><strong>{"Fonction"}</strong> {employe.fonction || 'N/A'}</div>
                <div><strong>{"Département"}</strong> {employe.dept_id || 'N/A'}</div>
                <div><strong>{"Direction"}</strong> {employe.id_direction || 'N/A'}</div>
                <div><strong>{"Entité"}</strong> {employe.id_entite || 'N/A'}</div>
                <div><strong>{"Rôle"}</strong> {employe.role || user?.role || 'N/A'}</div>
                <div><strong>{"Statut"}</strong> <span style={{ color: employe.statut_employe === 'ACTIF' ? '#27ae60' : '#e74c3c' }}>{employe.statut_employe || 'N/A'}</span></div>
              </div>
            </div>
          </div>}

          {/* ANALYTICS */}
          {analytics && (
            <>
              {/* ONGLETS role-based: Mes operations personnelles + Dashboard RH */}
              {canViewRhDashboard && (
                <div style={{ 
                  display: 'flex', 
                  gap: '0',
                  marginTop: '16px', 
                  marginBottom: '0',
                  borderBottom: '2px solid #e0e3e8',
                  background: 'white',
                  padding: '0 16px',
                  borderRadius: '10px 10px 0 0',
                  boxShadow: '0 1px 4px rgba(2,22,48,0.06)'
                }}>
                  <button 
                    onClick={() => setActiveTab('personnel')}
                    style={{
                      padding: '12px 20px',
                      background: 'none',
                      color: activeTab === 'personnel' ? '#1b4f9e' : '#6b7280',
                      border: 'none',
                      borderBottom: activeTab === 'personnel' ? '3px solid #1b4f9e' : '3px solid transparent',
                      marginBottom: '-2px',
                      cursor: 'pointer',
                      fontSize: '0.88rem',
                      fontWeight: activeTab === 'personnel' ? 700 : 500,
                      letterSpacing: '0.01em'
                    }}
                  >
                    {"Mes Opérations"}
                  </button>
                  <button 
                    onClick={() => setActiveTab('departements')}
                    style={{
                      padding: '12px 20px',
                      background: 'none',
                      color: activeTab === 'departements' ? '#1b4f9e' : '#6b7280',
                      border: 'none',
                      borderBottom: activeTab === 'departements' ? '3px solid #1b4f9e' : '3px solid transparent',
                      marginBottom: '-2px',
                      cursor: 'pointer',
                      fontSize: '0.88rem',
                      fontWeight: activeTab === 'departements' ? 700 : 500,
                      letterSpacing: '0.01em'
                    }}
                  >
                    {getDashboardLabel(normalizedRole)}
                  </button>
                </div>
              )}

              {/* DASHBOARD PERSONNEL */}
              {(activeTab === 'personnel' || !canViewRhDashboard) && widgets.stats_perso !== false && (
              <>
              {/* TITRE SECTION MES OPÉRATIONS */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '2px solid #e0e3e8', paddingBottom: '10px', marginTop: '20px', marginBottom: '16px' }}>
                <div style={{ width: '4px', height: '20px', background: '#1b4f9e', borderRadius: '2px', flexShrink: 0 }}></div>
                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#021630', letterSpacing: '0.02em' }}>{"Mes opérations personnelles"}</h2>
              </div>

              {/* MES OPÉRATIONS - KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '12px' }}>
                <div style={{
                  background: 'none',
                  border: '1px solid rgba(27,79,158,0.22)',
                  borderLeft: '4px solid #1b4f9e',
                  borderRadius: '10px',
                  padding: '20px 16px',
                  textAlign: 'center',
                  boxShadow: '0 4px 24px rgba(27,79,158,0.10), 0 1px 6px rgba(0,0,0,0.06)',
                }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#1b4f9e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>{"Mes Opérations"}</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#021630', lineHeight: 1 }}>
                    {analytics.mes_operations?.total || 0}
                  </div>
                </div>

                <div style={{
                  background: 'none',
                  border: '1px solid rgba(78,140,122,0.22)',
                  borderLeft: '4px solid #4e8c7a',
                  borderRadius: '10px',
                  padding: '20px 16px',
                  textAlign: 'center',
                  boxShadow: '0 4px 24px rgba(78,140,122,0.10), 0 1px 6px rgba(0,0,0,0.06)',
                }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#4e8c7a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>{"Validées"}</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#021630', lineHeight: 1 }}>
                    {analytics.mes_operations?.by_statut?.find(s => s.statut === 'validé')?.count || 0}
                  </div>
                </div>

                <div style={{
                  background: 'none',
                  border: '1px solid rgba(122,92,45,0.22)',
                  borderLeft: '4px solid #7a5c2d',
                  borderRadius: '10px',
                  padding: '20px 16px',
                  textAlign: 'center',
                  boxShadow: '0 4px 24px rgba(122,92,45,0.10), 0 1px 6px rgba(0,0,0,0.06)',
                }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#7a5c2d', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>{"En Attente"}</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#021630', lineHeight: 1 }}>
                    {analytics.mes_operations?.by_statut?.find(s => s.statut === 'en attente')?.count || 0}
                  </div>
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
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {analytics.mes_operations.by_statut.map((entry, index) => (
                            <Cell key={`cell-statut-${index}`} fill={STATUT_COLORS[entry.statut] || COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
              </>
              )}

              {/* ONGLET DÉPARTEMENTS - Opérations et Employés */}
              {activeTab === 'departements' && analytics.show_org_stats && widgets.org !== false && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '2px solid #e0e3e8', paddingBottom: '10px', marginTop: '20px', marginBottom: '16px' }}>
                    <div style={{ width: '4px', height: '20px', background: '#1b4f9e', borderRadius: '2px', flexShrink: 0 }}></div>
                    <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#021630', letterSpacing: '0.02em' }}>
                      {getDashboardLabel(normalizedRole)} — Périmètre {normalizedRole ? `(${normalizedRole})` : ''}
                      {analytics.scope_level ? ` · ${String(analytics.scope_level).toUpperCase()}` : ''}
                    </h2>
                  </div>

                  {/* FILTRE TEMPOREL */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'white',
                    padding: '8px 12px', borderRadius: '6px', marginBottom: '8px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#021630' }}>Filtrer les opérations :</span>
                    <select value={filterAnnee || ''} onChange={e => setFilterAnnee(e.target.value ? Number(e.target.value) : null)}
                      style={{ padding: '4px 8px', fontSize: '0.82rem', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}>
                      <option value="">Toutes les années</option>
                      {[2022, 2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select value={filterMois || ''} onChange={e => setFilterMois(e.target.value ? Number(e.target.value) : null)}
                      style={{ padding: '4px 8px', fontSize: '0.82rem', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}>
                      <option value="">Tous les mois</option>
                      {['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
                        .map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                    </select>
                    {(filterMois || filterAnnee) && (
                      <button onClick={() => { setFilterMois(null); setFilterAnnee(null) }}
                        style={{ padding: '4px 12px', fontSize: '0.82rem', background: '#dc2626', color: 'white',
                          border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>
                        Tout afficher
                      </button>
                    )}
                  </div>

                  {/* PÉRIMÈTRE - KPIs EFFECTIF */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '10px' }}>
                    <div style={{
                      background: 'none',
                      border: '1px solid rgba(27,79,158,0.22)',
                      borderLeft: '4px solid #1b4f9e',
                      borderRadius: '10px',
                      padding: '20px 16px',
                      textAlign: 'center',
                      boxShadow: '0 4px 24px rgba(27,79,158,0.10), 0 1px 6px rgba(0,0,0,0.06)',
                    }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#1b4f9e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>{"Total employés"}</div>
                      <div style={{ fontSize: '2rem', fontWeight: 800, color: '#021630', lineHeight: 1 }}>
                        {analytics.perimetre.total_employes || 0}
                      </div>
                    </div>

                    <div style={{
                      background: 'none',
                      border: '1px solid rgba(46,117,182,0.22)',
                      borderLeft: '4px solid #2e75b6',
                      borderRadius: '10px',
                      padding: '20px 16px',
                      textAlign: 'center',
                      boxShadow: '0 4px 24px rgba(46,117,182,0.10), 0 1px 6px rgba(0,0,0,0.06)',
                    }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#2e75b6', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Hommes</div>
                      <div style={{ fontSize: '2rem', fontWeight: 800, color: '#021630', lineHeight: 1 }}>
                        {analytics.perimetre?.kpis?.hommes || 0}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '6px', fontWeight: 500 }}>
                        {analytics.perimetre?.kpis?.hommes_pct || 0}%
                      </div>
                    </div>

                    <div style={{
                      background: 'none',
                      border: '1px solid rgba(78,140,122,0.22)',
                      borderLeft: '4px solid #4e8c7a',
                      borderRadius: '10px',
                      padding: '20px 16px',
                      textAlign: 'center',
                      boxShadow: '0 4px 24px rgba(78,140,122,0.10), 0 1px 6px rgba(0,0,0,0.06)',
                    }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#4e8c7a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Femmes</div>
                      <div style={{ fontSize: '2rem', fontWeight: 800, color: '#021630', lineHeight: 1 }}>
                        {analytics.perimetre?.kpis?.femmes || 0}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '6px', fontWeight: 500 }}>
                        {analytics.perimetre?.kpis?.femmes_pct || 0}%
                      </div>
                    </div>

                    <div style={{
                      background: 'none',
                      border: '1px solid rgba(74,52,112,0.22)',
                      borderLeft: '4px solid #4a3470',
                      borderRadius: '10px',
                      padding: '20px 16px',
                      textAlign: 'center',
                      boxShadow: '0 4px 24px rgba(74,52,112,0.10), 0 1px 6px rgba(0,0,0,0.06)',
                    }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#4a3470', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Opérations</div>
                      <div style={{ fontSize: '2rem', fontWeight: 800, color: '#021630', lineHeight: 1 }}>
                        {analytics.perimetre?.total_operations || 0}
                      </div>
                    </div>
                  </div>

                  {/* PÉRIMÈTRE - KPIs PAR CATÉGORIE */}
                  {analytics.perimetre?.kpis?.by_categorie && analytics.perimetre.kpis.by_categorie.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px', background: 'white', padding: '16px', borderRadius: '10px', boxShadow: '0 1px 8px rgba(2,22,48,0.07)' }}>
                    <div style={{ gridColumn: '1 / -1', borderBottom: '1px solid #f0f2f5', paddingBottom: '8px', marginBottom: '4px' }}>
                      <h3 style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Répartition par Catégorie</h3>
                    </div>
                    {analytics.perimetre.kpis.by_categorie.map((cat) => (
                      <div key={cat.categorie} style={{ 
                        background: '#f8f9fb', 
                        padding: '10px 12px', 
                        borderRadius: '8px',
                        borderLeft: '3px solid #1b4f9e',
                        boxShadow: '0 1px 3px rgba(2,22,48,0.05)'
                      }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{cat.categorie}</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#021630' }}>
                          {cat.count} <span style={{ fontSize: '0.72rem', color: '#1b4f9e', fontWeight: 600 }}>({cat.pct}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  )}

                  {/* PÉRIMÈTRE - KPIs PAR VILLE */}
                  {analytics.perimetre?.kpis?.by_ville && analytics.perimetre.kpis.by_ville.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '14px', background: 'white', padding: '16px', borderRadius: '10px', boxShadow: '0 1px 8px rgba(2,22,48,0.07)' }}>
                    <div style={{ gridColumn: '1 / -1', borderBottom: '1px solid #f0f2f5', paddingBottom: '8px', marginBottom: '4px' }}>
                      <h3 style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Répartition par Ville</h3>
                    </div>
                    {analytics.perimetre.kpis.by_ville.map((ville) => (
                      <div key={ville.ville} style={{ 
                        background: '#f8f9fb', 
                        padding: '10px 12px', 
                        borderRadius: '8px',
                        borderLeft: '3px solid #3a9ab2',
                        boxShadow: '0 1px 3px rgba(2,22,48,0.05)'
                      }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{ville.ville}</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#021630' }}>
                          {ville.count} <span style={{ fontSize: '0.72rem', color: '#3a9ab2', fontWeight: 600 }}>({ville.pct}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  )}

                  {/* PÉRIMÈTRE - KPIs PAR ÂGE */}
                  {analytics.perimetre?.kpis?.by_age && analytics.perimetre.kpis.by_age.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '14px', background: 'white', padding: '16px', borderRadius: '10px', boxShadow: '0 1px 8px rgba(2,22,48,0.07)' }}>
                    <div style={{ gridColumn: '1 / -1', borderBottom: '1px solid #f0f2f5', paddingBottom: '8px', marginBottom: '4px' }}>
                      <h3 style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Répartition par Tranche d'Âge</h3>
                    </div>
                    {analytics.perimetre.kpis.by_age.map((age) => (
                      <div key={age.tranche} style={{ 
                        background: '#f8f9fb', 
                        padding: '10px 12px', 
                        borderRadius: '8px',
                        borderLeft: '3px solid #5e4a8e',
                        boxShadow: '0 1px 3px rgba(2,22,48,0.05)'
                      }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{age.tranche} ans</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#021630' }}>
                          {age.count} <span style={{ fontSize: '0.72rem', color: '#5e4a8e', fontWeight: 600 }}>({age.pct}%)</span>
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
                                <Cell key={`cell-${index}`} fill={STATUT_COLORS[entry.statut] || COLORS[index % COLORS.length]} />
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
                            <Bar dataKey="hommes" fill="#2e75b6" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="femmes" fill="#c85a78" radius={[3, 3, 0, 0]} />
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
                                <Cell key={`cell-${index}`} fill={entry.sexe === 'M' ? '#2e75b6' : '#c85a78'} />
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

                  {/* OPÉRATIONS PAR STRUCTURE ORGANISATIONNELLE */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
                    {analytics.organisation?.operations_by_entite?.length > 0 &&
                      renderOpsHistogram(analytics.organisation.operations_by_entite, 'Opérations par Entité')
                    }
                    {analytics.organisation?.operations_by_direction?.length > 0 &&
                      renderOpsHistogram(analytics.organisation.operations_by_direction, 'Opérations par Direction')
                    }
                    {analytics.organisation?.operations_by_departement?.length > 0 &&
                      renderOpsHistogram(analytics.organisation.operations_by_departement, 'Opérations par Département')
                    }
                  </div>
                </>
              )}

              {/* Section organisation integree au Dashboard RH */}
              {activeTab === 'departements' && analytics.show_org_stats && widgets.org !== false && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '2px solid #e0e3e8', paddingBottom: '10px', marginTop: '20px', marginBottom: '16px' }}>
                    <div style={{ width: '4px', height: '20px', background: '#4a3470', borderRadius: '2px', flexShrink: 0 }}></div>
                    <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#021630', letterSpacing: '0.02em' }}>Dashboard RH — Organisation</h2>
                  </div>

                  {/* ORGANISATION - KPIs PAR PAYS */}
                  {analytics.perimetre?.kpis?.by_pays && analytics.perimetre.kpis.by_pays.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '8px', background: 'white', padding: '10px', borderRadius: '6px' }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <h3 style={{ margin: '0 0 10px 0', fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Répartition par Pays</h3>
                    </div>
                    {analytics.perimetre.kpis.by_pays.map((pays) => (
                      <div key={pays.pays} style={{ 
                        background: '#f8f9fb', 
                        padding: '10px 12px', 
                        borderRadius: '8px',
                        borderLeft: '3px solid #4e8c7a',
                        boxShadow: '0 1px 3px rgba(2,22,48,0.05)'
                      }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{pays.pays}</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#021630' }}>
                          {pays.count} <span style={{ fontSize: '0.72rem', color: '#4e8c7a', fontWeight: 600 }}>({pays.pct}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  )}

                  {/* ORGANISATION - KPIs PAR VILLE */}
                  {analytics.perimetre?.kpis?.by_ville && analytics.perimetre.kpis.by_ville.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '14px', background: 'white', padding: '16px', borderRadius: '10px', boxShadow: '0 1px 8px rgba(2,22,48,0.07)' }}>
                    <div style={{ gridColumn: '1 / -1', borderBottom: '1px solid #f0f2f5', paddingBottom: '8px', marginBottom: '4px' }}>
                      <h3 style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Répartition par Ville</h3>
                    </div>
                    {analytics.perimetre.kpis.by_ville.map((ville) => (
                      <div key={ville.ville} style={{ 
                        background: '#f8f9fb', 
                        padding: '10px 12px', 
                        borderRadius: '8px',
                        borderLeft: '3px solid #3a9ab2',
                        boxShadow: '0 1px 3px rgba(2,22,48,0.05)'
                      }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{ville.ville}</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#021630' }}>
                          {ville.count} <span style={{ fontSize: '0.72rem', color: '#3a9ab2', fontWeight: 600 }}>({ville.pct}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  )}

                  {/* ORGANISATION - KPIs PAR ÂGE */}
                  {analytics.perimetre?.kpis?.by_age && analytics.perimetre.kpis.by_age.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '14px', background: 'white', padding: '16px', borderRadius: '10px', boxShadow: '0 1px 8px rgba(2,22,48,0.07)' }}>
                    <div style={{ gridColumn: '1 / -1', borderBottom: '1px solid #f0f2f5', paddingBottom: '8px', marginBottom: '4px' }}>
                      <h3 style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Répartition par Tranche d'Âge</h3>
                    </div>
                    {analytics.perimetre.kpis.by_age.map((age) => (
                      <div key={age.tranche} style={{ 
                        background: '#f8f9fb', 
                        padding: '10px 12px', 
                        borderRadius: '8px',
                        borderLeft: '3px solid #5e4a8e',
                        boxShadow: '0 1px 3px rgba(2,22,48,0.05)'
                      }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{age.tranche} ans</div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#021630' }}>
                          {age.count} <span style={{ fontSize: '0.72rem', color: '#5e4a8e', fontWeight: 600 }}>({age.pct}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  )}

                  {/* ORGANISATION - Graphiques Opérations par Départements + Directions par Ville */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {analytics.perimetre?.org_structure_by_geo?.directions_by_ville?.length > 0 &&
                      renderGeoBarChart(analytics.perimetre.org_structure_by_geo.directions_by_ville, 'ville', 'Directions par Ville')
                    }

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
