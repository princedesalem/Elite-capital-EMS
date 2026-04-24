import React, {useEffect, useState} from 'react'
import {useAuth} from '../contexts/AuthContext'
import api from '../services/api'
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

export default function Dashboard(){
  const {user} = useAuth()
  const [employe, setEmploye] = useState(null)
  const [n1Info, setN1Info] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const powerBiEmbedUrl = import.meta.env.VITE_POWERBI_EMBED_URL

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
          const analyticsRes = await api.get('/dashboard/analytics')
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
    
    if (years === 0) return `${months} mois`
    if (months === 0) return `${years} an${years > 1 ? 's' : ''}`
    return `${years} an${years > 1 ? 's' : ''} ${months} mois`
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
    return `${age} ans`
  }

  return (
    <div className="container">
      {error && (
        <div style={{ 
          background: '#fadbd8', 
          color: '#c0392b', 
          padding: '15px', 
          borderRadius: '8px', 
          marginBottom: '20px',
          border: '1px solid #ec7063'
        }}>
          ❌ {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>⏳ Chargement de vos informations...</p>
        </div>
      )}

      {!loading && employe && (
        <>
          {/* CARTE IDENTITÉ EN HAUT */}
          <div className="card" style={{
            background: 'linear-gradient(90deg, #02162e 0%, #02162e 50%, #0a2e57 72%, #274a73 100%)',
            color: 'white',
            marginBottom: '30px',
            padding: '30px'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '30px', alignItems: 'center' }}>
              <div style={{ fontSize: '4em' }}>👤</div>
              <div>
                <h1 style={{ margin: '0 0 10px 0', fontSize: '2em' }}>
                  {employe.prenom} {employe.nom}
                </h1>
                <p style={{ margin: '5px 0', fontSize: '1.1em', opacity: 0.9 }}>
                  <strong>Matricule:</strong> {employe.matricule}
                </p>
                <p style={{ margin: '5px 0', fontSize: '1.1em', opacity: 0.9 }}>
                  <strong>Fonction:</strong> {employe.fonction || 'N/A'}
                </p>
                <p style={{ margin: '5px 0', fontSize: '1.1em', opacity: 0.9 }}>
                  <strong>Entité:</strong> {employe.id_entite || 'N/A'}
                </p>
                <div style={{
                  marginTop: '15px',
                  padding: '12px 20px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  display: 'inline-block'
                }}>
                  <p style={{ margin: '0', fontSize: '0.95em' }}>
                    📅 <strong>Ancienneté:</strong> {calculateAnciennete(employe.date_embauche)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* INFOS DÉTAILLÉES */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            <div className="card">
              <h3>📋 Informations Personnelles</h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <strong>Date de naissance:</strong>
                  <p>{employe.date_naissance ? new Date(employe.date_naissance).toLocaleDateString('fr-FR') : 'N/A'}</p>
                </div>
                <div>
                  <strong>Âge:</strong>
                  <p>{calculateAge(employe.date_naissance)}</p>
                </div>
                <div>
                  <strong>Sexe:</strong>
                  <p>{employe.sexe || 'N/A'}</p>
                </div>
                <div>
                  <strong>Email:</strong>
                  <p>{employe.email || 'N/A'}</p>
                </div>
                <div>
                  <strong>Téléphone:</strong>
                  <p>{employe.telephone || 'N/A'}</p>
                </div>
                <div>
                  <strong>Ville:</strong>
                  <p>{employe.ville || 'N/A'}</p>
                </div>
                <div>
                  <strong>Contact d'urgence:</strong>
                  <p>{employe.contact_urgence || 'N/A'}</p>
                </div>
              </div>
            </div>

            <div className="card">
              <h3>💼 Informations Professionnelles</h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <strong>Date d'embauche:</strong>
                  <p>{employe.date_embauche ? new Date(employe.date_embauche).toLocaleDateString('fr-FR') : 'N/A'}</p>
                </div>
                <div>
                  <strong>Ancienneté:</strong>
                  <p>{calculateAnciennete(employe.date_embauche)}</p>
                </div>
                <div>
                  <strong>Diplôme:</strong>
                  <p>{employe.diplome || 'N/A'}</p>
                </div>
                <div>
                  <strong>Catégorie:</strong>
                  <p>{employe.categorie || 'N/A'}</p>
                </div>
                <div>
                  <strong>Années d'expérience:</strong>
                  <p>{employe.annee_experience ?? 'N/A'}</p>
                </div>
                <div>
                  <strong>Niveau 1 (N1):</strong>
                  <p>{n1Info ? `${n1Info.prenom} ${n1Info.nom}` : (employe.n1 || 'N/A')}</p>
                </div>
                <div>
                  <strong>Solde de congés:</strong>
                  <p>{employe.solde_conges ?? 'N/A'} jours</p>
                </div>
              </div>
            </div>

            <div className="card">
              <h3>🏢 Positionnement Organisationnel</h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <strong>Fonction:</strong>
                  <p>{employe.fonction || 'N/A'}</p>
                </div>
                <div>
                  <strong>Département:</strong>
                  <p>{employe.dept_id || 'N/A'}</p>
                </div>
                <div>
                  <strong>Direction:</strong>
                  <p>{employe.id_direction || 'N/A'}</p>
                </div>
                <div>
                  <strong>Entité:</strong>
                  <p>{employe.id_entite || 'N/A'}</p>
                </div>
                <div>
                  <strong>Rôle:</strong>
                  <p>{employe.role || user?.role || 'N/A'}</p>
                </div>
                <div>
                  <strong>Statut:</strong>
                  <p style={{ color: employe.statut_employe === 'ACTIF' ? '#27ae60' : '#e74c3c' }}>
                    {employe.statut_employe || 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ANALYTICS AVEC GRAPHIQUES */}
          {analytics && (
            <>
              {/* KPIs Cards - Ligne 1 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginTop: '30px' }}>
                <div className="card" style={{ 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  textAlign: 'center',
                  padding: '24px 16px'
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>👥</div>
                  <div style={{ fontSize: '2.2rem', fontWeight: 'bold', marginBottom: '4px' }}>
                    {analytics.kpis?.total_employes || 0}
                  </div>
                  <div style={{ opacity: 0.9, fontSize: '0.9rem' }}>Total Employés</div>
                </div>

                <div className="card" style={{ 
                  background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                  color: 'white',
                  textAlign: 'center',
                  padding: '24px 16px'
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>✨</div>
                  <div style={{ fontSize: '2.2rem', fontWeight: 'bold', marginBottom: '4px' }}>
                    {analytics.kpis?.nouvelles_recrues || 0}
                  </div>
                  <div style={{ opacity: 0.9, fontSize: '0.9rem' }}>Recrues {new Date().getFullYear()}</div>
                </div>

                <div className="card" style={{ 
                  background: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
                  color: 'white',
                  textAlign: 'center',
                  padding: '24px 16px'
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📅</div>
                  <div style={{ fontSize: '2.2rem', fontWeight: 'bold', marginBottom: '4px' }}>
                    {analytics.kpis?.anciennete_moyenne || 0} ans
                  </div>
                  <div style={{ opacity: 0.9, fontSize: '0.9rem' }}>Ancienneté Moyenne</div>
                </div>

                <div className="card" style={{ 
                  background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
                  color: 'var(--text)',
                  textAlign: 'center',
                  padding: '24px 16px'
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🏖️</div>
                  <div style={{ fontSize: '2.2rem', fontWeight: 'bold', marginBottom: '4px' }}>
                    {analytics.kpis?.solde_conges_moyen || 0}j
                  </div>
                  <div style={{ opacity: 0.8, fontSize: '0.9rem' }}>Congés Moyens</div>
                </div>
              </div>

              {/* KPIs Cards - Ligne 2 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginTop: '16px' }}>
                <div className="card" style={{ 
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  color: 'white',
                  textAlign: 'center',
                  padding: '24px 16px'
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📋</div>
                  <div style={{ fontSize: '2.2rem', fontWeight: 'bold', marginBottom: '4px' }}>
                    {analytics.kpis?.total_operations || 0}
                  </div>
                  <div style={{ opacity: 0.9, fontSize: '0.9rem' }}>Total Opérations</div>
                </div>

                <div className="card" style={{ 
                  background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                  color: 'white',
                  textAlign: 'center',
                  padding: '24px 16px'
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔧</div>
                  <div style={{ fontSize: '2.2rem', fontWeight: 'bold', marginBottom: '4px' }}>
                    {analytics.kpis?.total_types_operations || 0}
                  </div>
                  <div style={{ opacity: 0.9, fontSize: '0.9rem' }}>Types Opérations</div>
                </div>

                <div className="card" style={{ 
                  background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                  color: 'white',
                  textAlign: 'center',
                  padding: '24px 16px'
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>✅</div>
                  <div style={{ fontSize: '2.2rem', fontWeight: 'bold', marginBottom: '4px' }}>
                    {analytics.kpis?.taux_approbation || 0}%
                  </div>
                  <div style={{ opacity: 0.9, fontSize: '0.9rem' }}>Taux Approbation</div>
                </div>

                <div className="card" style={{ 
                  background: 'linear-gradient(135deg, #FF6B6B 0%, #FFE66D 100%)',
                  color: 'white',
                  textAlign: 'center',
                  padding: '24px 16px'
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>
                    {analytics.repartition_sexe && analytics.repartition_sexe.find(s => s.sexe === 'F') 
                      ? '♀️' : '♂️'}
                  </div>
                  <div style={{ fontSize: '2.2rem', fontWeight: 'bold', marginBottom: '4px' }}>
                    {analytics.repartition_sexe && analytics.repartition_sexe.find(s => s.sexe === 'F')?.percentage || 0}%
                  </div>
                  <div style={{ opacity: 0.9, fontSize: '0.9rem' }}>Femmes</div>
                </div>
              </div>

              {/* Section Titre */}
              <div style={{ marginTop: '40px', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '1.8rem', color: '#021630', borderBottom: '3px solid #ce2b2b', paddingBottom: '8px' }}>
                  📊 Analyses Démographiques & Organisationnelles
                </h2>
              </div>

              {/* Graphiques Démographiques */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
                
                {/* Répartition H/F */}
                {analytics.repartition_sexe && analytics.repartition_sexe.length > 0 && (
                  <div className="card">
                    <h3 style={{ marginBottom: '20px' }}>♂️♀️ Répartition Hommes/Femmes</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={analytics.repartition_sexe}
                          dataKey="count"
                          nameKey="sexe"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          label={(entry) => `${entry.sexe}: ${entry.percentage}%`}
                        >
                          {analytics.repartition_sexe.map((entry, index) => {
                            const colors = {'M': '#4facfe', 'F': '#fa709a', 'Autre': '#43e97b'};
                            return <Cell key={`cell-${index}`} fill={colors[entry.sexe] || '#999'} />;
                          })}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Tranches d'âge */}
                {analytics.repartition_age && analytics.repartition_age.length > 0 && (
                  <div className="card">
                    <h3 style={{ marginBottom: '20px' }}>🎂 Répartition par Âge</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analytics.repartition_age}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="tranche" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="count" fill="#667eea" name="Nombre d'employés" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Recrues par mois */}
                {analytics.recrues_par_mois && analytics.recrues_par_mois.length > 0 && (
                  <div className="card">
                    <h3 style={{ marginBottom: '20px' }}>✨ Nouvelles Recrues (6 derniers mois)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={analytics.recrues_par_mois}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="mois" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="count" stroke="#fa709a" strokeWidth={3} name="Recrues" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Catégories */}
                {analytics.repartition_categorie && analytics.repartition_categorie.length > 0 && (
                  <div className="card">
                    <h3 style={{ marginBottom: '20px' }}>🏷️ Répartition par Catégorie</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={analytics.repartition_categorie}
                          dataKey="count"
                          nameKey="categorie"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          label
                        >
                          {analytics.repartition_categorie.map((entry, index) => {
                            const colors = ['#667eea', '#f5576c', '#4facfe', '#43e97b', '#fa709a', '#30cfd0'];
                            return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                          })}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Employés par Ville */}
                {analytics.employes_par_ville && analytics.employes_par_ville.length > 0 && (
                  <div className="card">
                    <h3 style={{ marginBottom: '20px' }}>🌍 Employés par Ville</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analytics.employes_par_ville}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="ville" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="count" fill="#43e97b" name="Nombre d'employés" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Rôles */}
                {analytics.repartition_role && analytics.repartition_role.length > 0 && (
                  <div className="card">
                    <h3 style={{ marginBottom: '20px' }}>👔 Répartition par Rôle</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analytics.repartition_role}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="role" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="count" fill="#764ba2" name="Nombre" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Section Organisationnel */}
              <div style={{ marginTop: '40px', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '1.8rem', color: '#021630', borderBottom: '3px solid #ce2b2b', paddingBottom: '8px' }}>
                  🏢 Organisation & Opérations
                </h2>
              </div>

              {/* Graphiques Organisationnels */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
                
                {/* Employés par Entité */}
                <div className="card">
                  <h3 style={{ marginBottom: '20px' }}>🏢 Employés par Entité</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.employes_by_entite || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="entite" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#667eea" name="Nombre d'employés" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Départements par Ville */}
                <div className="card">
                  <h3 style={{ marginBottom: '20px' }}>📍 Départements par Ville</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.departments_by_city || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="ville" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#f5576c" name="Nombre de départements" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Opérations par Type */}
                <div className="card">
                  <h3 style={{ marginBottom: '20px' }}>🧾 Opérations par Type</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={analytics.operations_by_type || []}
                        dataKey="count"
                        nameKey="type"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label
                      >
                        {(analytics.operations_by_type || []).map((entry, index) => {
                          const colors = ['#667eea', '#f5576c', '#4facfe', '#43e97b', '#fa709a'];
                          return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                        })}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Validations par Statut */}
                {analytics.validations_by_status && analytics.validations_by_status.length > 0 && (
                  <div className="card">
                    <h3 style={{ marginBottom: '20px' }}>✅ Validations par Statut</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analytics.validations_by_status || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="statut" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="count" fill="#43e97b" name="Nombre de validations" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </>
          )}

          {/* POWER BI EMBED */}
          {powerBiEmbedUrl && (
            <div className="card" style={{ marginTop: '24px' }}>
              <h3>📈 Dashboard Power BI</h3>
              <iframe
                title="Power BI Dashboard"
                src={powerBiEmbedUrl}
                style={{ width: '100%', height: '520px', border: '1px solid var(--border)', borderRadius: '8px' }}
                allowFullScreen
              />
            </div>
          )}
        </>
      )}

      {!loading && !employe && !error && (
        <div className="card" style={{ textAlign: 'center' }}>
          <p>Impossible de charger vos informations</p>
        </div>
      )}
    </div>
  )
}
