import React, { useState, useEffect, useMemo } from 'react'
import api from '../services/api'
import { Users, UserPlus, KeyRound, ShieldCheck, Search, Plus, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { confirmDialog } from '../components/ui/bridge'
export default function Utilisateurs() {
  const { user } = useAuth()
  const role = String(user?.role || '').toUpperCase()

  const [utilisateursData, setUtilisateursData] = useState([])
  const [rolesData, setRolesData] = useState([])
  const [employesSansCompte, setEmployesSansCompte] = useState([])
  const [creerCompteModal, setCreerCompteModal] = useState(null)
  const [creerCompteForm, setCreerCompteForm] = useState({ password: '', role: '', email: '' })
  const [creerCompteLoading, setCreerCompteLoading] = useState(false)
  const [showNouveauComptePanel, setShowNouveauComptePanel] = useState(false)
  const [utilisateursSearch, setUtilisateursSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadData = async () => {
    setLoading(true)
    setError('')
    setSuccess('')
    const failed = []
    let utilisateurs = []
    let roles = []

    try {
      const usr = await api.get('/employees/admin/utilisateurs')
      utilisateurs = usr.data || []
    } catch {
      utilisateurs = []
      failed.push('utilisateurs')
    }

    try {
      const sans = await api.get('/employees/admin/employes-sans-compte')
      setEmployesSansCompte(sans.data || [])
    } catch {
      setEmployesSansCompte([])
    }

    try {
      const rolesRes = await api.get('/roles/')
      roles = rolesRes.data || []
    } catch {
      roles = []
      failed.push('roles')
    }

    setUtilisateursData(utilisateurs)
    setRolesData(roles)

    if (failed.length > 0) {
      setError(`Certaines données n'ont pas pu être chargées: ${failed.join(', ')}.`)
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const adminRoleOptions = useMemo(() => {
    const fromApi = (rolesData || []).map((r) => String(r.name || '').trim()).filter(Boolean)
    const fromUsers = (utilisateursData || []).map((u) => String(u.role || '').trim()).filter(Boolean)
    // DFC n'est plus assignable manuellement — déduit de la fonction
    return Array.from(new Set([...fromApi, ...fromUsers]))
      .filter((r) => r.toUpperCase() !== 'DFC')
      .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))
  }, [rolesData, utilisateursData])

  const utilisateursStats = useMemo(() => {
    const total = utilisateursData.length
    const actifs = utilisateursData.filter((u) => !!u.active).length
    const mfaActifs = utilisateursData.filter((u) => !!u.mfa_enabled).length
    const tempPwd = utilisateursData.filter((u) => !!u.mot_de_passe_temporaire).length
    return { total, actifs, mfaActifs, tempPwd }
  }, [utilisateursData])

  const filteredUtilisateurs = useMemo(() => {
    const q = String(utilisateursSearch || '').trim().toLowerCase()
    if (!q) return utilisateursData
    return utilisateursData.filter((u) => {
      const fullName = [u.prenom, u.nom].filter(Boolean).join(' ').toLowerCase()
      return (
        String(u.matricule || '').toLowerCase().includes(q)
        || fullName.includes(q)
        || String(u.email || '').toLowerCase().includes(q)
        || String(u.role || '').toLowerCase().includes(q)
      )
    })
  }, [utilisateursData, utilisateursSearch])

  const updateUtilisateur = async (matricule, payload) => {
    setError('')
    setSuccess('')
    try {
      const res = await api.put(`/employees/admin/utilisateurs/${matricule}`, payload)
      const updated = res.data
      setUtilisateursData((prev) => prev.map((u) => (String(u.matricule) === String(matricule) ? updated : u)))
      setSuccess(`Compte ${matricule} mis à jour.`)
    } catch (e) {
      setError(e?.response?.data?.detail || `Erreur mise à jour compte ${matricule}`)
    }
  }

  const resetPasswordTemporaire = async (matricule) => {
    const ok = await confirmDialog({ title: 'Réinitialiser le mot de passe', message: `Réinitialiser le mot de passe du compte ${matricule} ?`, variant: 'warning', confirmLabel: 'Réinitialiser' })
    if (!ok) return
    setError('')
    setSuccess('')
    try {
      const res = await api.post(`/employees/admin/utilisateurs/${matricule}/reset-password-temp`, {})
      const temp = res?.data?.mot_de_passe_temporaire || '(non fourni)'
      setSuccess(`Mot de passe temporaire du compte ${matricule}: ${temp}`)
      await loadData()
    } catch (e) {
      setError(e?.response?.data?.detail || `Erreur reset mot de passe ${matricule}`)
    }
  }

  const ouvrirCreerCompte = (emp) => {
    setCreerCompteForm({ password: '', role: '', email: emp.email || '' })
    setCreerCompteModal(emp)
  }

  const soumettreCreerCompte = async () => {
    if (!creerCompteModal) return
    setCreerCompteLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await api.post(`/employees/admin/utilisateurs/${creerCompteModal.matricule}/creer-compte`, {
        password: creerCompteForm.password || null,
        role: creerCompteForm.role || null,
        email: creerCompteForm.email || null,
      })
      const temp = res?.data?.mot_de_passe_temporaire || '(non fourni)'
      setSuccess(`Compte créé pour le matricule ${creerCompteModal.matricule}. Mot de passe temporaire: ${temp}`)
      setCreerCompteModal(null)
      await loadData()
    } catch (e) {
      setError(e?.response?.data?.detail || "Erreur lors de la création du compte")
    } finally {
      setCreerCompteLoading(false)
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>{"Chargement..."}</div>

  return (
    <div style={{ padding: '12px', background: 'var(--bg)', minHeight: '100vh' }}>
      {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '6px', marginBottom: '14px' }}>{error}</div>}
      {success && <div style={{ background: '#dcfce7', color: '#166534', padding: '12px', borderRadius: '6px', marginBottom: '14px' }}>{success}</div>}

      <div
        className="card"
        style={{
          marginBottom: 14,
          padding: '16px 18px',
          background: 'linear-gradient(100deg, #1f2937 0%, #374151 58%, #4b5563 100%)',
          color: '#f9fafb',
          border: 'none',
          boxShadow: '0 8px 20px rgba(17,24,39,0.22)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={17}/> {"Gestion des utilisateurs"}
            </div>
            <div style={{ fontSize: '0.83rem', opacity: 0.95 }}>
              {"Comptes, rôles et sécurité"}
            </div>
          </div>
          <button
            onClick={() => setShowNouveauComptePanel((v) => !v)}
            style={{
              background: showNouveauComptePanel ? '#e5e7eb' : '#ffffff',
              color: 'var(--text)',
              border: 'none',
              borderRadius: 10,
              padding: '10px 14px',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              boxShadow: '0 4px 10px rgba(31,41,55,0.18)'
            }}
          >
            <UserPlus size={15}/> {showNouveauComptePanel ? "Fermer" + ' ' + "Nouveau compte" : "Nouveau compte"}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
        <div className="card" style={{ padding: '12px 14px', borderLeft: '5px solid #374151' }}>
          <div style={{ fontSize: '0.77rem', color: '#64748b', fontWeight: 700 }}>{"Total comptes"}</div>
          <div style={{ marginTop: 2, fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)' }}>{utilisateursStats.total}</div>
        </div>
        <div className="card" style={{ padding: '12px 14px', borderLeft: '5px solid #4b5563' }}>
          <div style={{ fontSize: '0.77rem', color: '#64748b', fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center' }}><ShieldCheck size={13}/> {"Comptes actifs"}</div>
          <div style={{ marginTop: 2, fontSize: '1.35rem', fontWeight: 800, color: '#1f2937' }}>{utilisateursStats.actifs}</div>
        </div>
        <div className="card" style={{ padding: '12px 14px', borderLeft: '5px solid #6b7280' }}>
          <div style={{ fontSize: '0.77rem', color: '#64748b', fontWeight: 700 }}>{"MFA activé"}</div>
          <div style={{ marginTop: 2, fontSize: '1.35rem', fontWeight: 800, color: '#1f2937' }}>{utilisateursStats.mfaActifs}</div>
        </div>
        <div className="card" style={{ padding: '12px 14px', borderLeft: '5px solid #9ca3af' }}>
          <div style={{ fontSize: '0.77rem', color: '#64748b', fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center' }}><KeyRound size={13}/> {"Mots de passe temporaires"}</div>
          <div style={{ marginTop: 2, fontSize: '1.35rem', fontWeight: 800, color: '#1f2937' }}>{utilisateursStats.tempPwd}</div>
        </div>
      </div>

      {/* Modal Créer un compte */}
      {creerCompteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--card)', borderRadius: 12, padding: 28, minWidth: 360, maxWidth: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700 }}>
              {"Créer un compte"} — {creerCompteModal.prenom} {creerCompteModal.nom} (#{creerCompteModal.matricule})
            </h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151' }}>{"Email (optionnel)"}</label>
              <input type="email" value={creerCompteForm.email} onChange={e => setCreerCompteForm(f => ({...f, email: e.target.value}))}
                placeholder={creerCompteModal.email || 'email@exemple.com'}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: '0.85rem', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151' }}>{"Rôle"}</label>
              <select value={creerCompteForm.role} onChange={e => setCreerCompteForm(f => ({...f, role: e.target.value}))}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: '0.85rem', boxSizing: 'border-box' }}>
                <option value="">EMPLOYE (défaut)</option>
                {adminRoleOptions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151' }}>
                {"Mot de passe initial"} <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>({"Auto-généré si vide"})</span>
              </label>
              <input type="text" value={creerCompteForm.password} onChange={e => setCreerCompteForm(f => ({...f, password: e.target.value}))}
                placeholder={`EMS@${creerCompteModal.matricule}!Compte1`}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: '0.85rem', fontFamily: 'monospace', boxSizing: 'border-box' }} />
              <p style={{ margin: '4px 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>{"Laissez vide pour un mot de passe temporaire auto-généré"}</p>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setCreerCompteModal(null)} style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid #d1d5db', background: 'var(--bg)', cursor: 'pointer', fontWeight: 600 }}>{"Annuler"}</button>
              <button onClick={soumettreCreerCompte} disabled={creerCompteLoading}
                style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: '#1f2937', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                {creerCompteLoading ? "Création en cours..." : "Créer le compte"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Employés sans compte */}
      {showNouveauComptePanel && (
        <div className="card" style={{ marginBottom: 14, padding: 0, overflowX: 'auto', border: '1px solid #d1d5db' }}>
          <div style={{ padding: '11px 13px', background: 'linear-gradient(90deg, #f3f4f6 0%, #f8fafc 100%)', borderBottom: '1px solid #d1d5db', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><UserPlus size={14}/> Employés sans compte ({employesSansCompte.length})</span>
            <span style={{ fontWeight: 500, color: '#475569', fontSize: '0.79rem' }}>Cliquez sur « Créer » pour générer un compte temporaire</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                <th style={{ textAlign: 'left', padding: '8px 10px' }}>{"Matricule"}</th>
                <th style={{ textAlign: 'left', padding: '8px 10px' }}>{"Nom"}</th>
                <th style={{ textAlign: 'left', padding: '8px 10px' }}>{"Email"}</th>
                <th style={{ textAlign: 'left', padding: '8px 10px' }}>Fonction</th>
                <th style={{ textAlign: 'left', padding: '8px 10px' }}>{"Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {employesSansCompte.map(emp => (
                <tr key={emp.matricule} style={{ borderTop: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 700 }}>{emp.matricule}</td>
                  <td style={{ padding: '8px 10px' }}>{[emp.prenom, emp.nom].filter(Boolean).join(' ') || '-'}</td>
                  <td style={{ padding: '8px 10px' }}>{emp.email || '-'}</td>
                  <td style={{ padding: '8px 10px' }}>{emp.fonction || '-'}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <button onClick={() => ouvrirCreerCompte(emp)}
                      style={{ background: '#374151', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 13px', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Plus size={13}/> Créer
                    </button>
                  </td>
                </tr>
              ))}
              {employesSansCompte.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '14px', textAlign: 'center', color: '#64748b' }}>{"Tous les employés ont déjà un compte"}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="card" style={{ marginBottom: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)' }}>
        <Search size={15} color="#64748b"/>
        <input
          value={utilisateursSearch}
          onChange={(e) => setUtilisateursSearch(e.target.value)}
          placeholder="Rechercher par matricule, nom, email ou rôle"
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '0.84rem', color: 'var(--text)' }}
        />
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto', border: '1px solid #dbe2ea' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
          <thead>
            <tr style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)', color: '#021630' }}>
              <th style={{ textAlign: 'left', padding: '9px 10px', color: '#021630', fontWeight: 800 }}>{"Matricule"}</th>
              <th style={{ textAlign: 'left', padding: '9px 10px', color: '#021630', fontWeight: 800 }}>{"Nom"}</th>
              <th style={{ textAlign: 'left', padding: '9px 10px', color: '#021630', fontWeight: 800 }}>{"Email"}</th>
              <th style={{ textAlign: 'left', padding: '9px 10px', color: '#021630', fontWeight: 800 }}>{"Rôle"}</th>
              <th style={{ textAlign: 'left', padding: '9px 10px', color: '#021630', fontWeight: 800 }}>{"État"}</th>
              <th style={{ textAlign: 'left', padding: '9px 10px', color: '#021630', fontWeight: 800 }}>{"MFA"}</th>
              <th style={{ textAlign: 'left', padding: '9px 10px', color: '#021630', fontWeight: 800 }}>{"Mdp temp."}</th>
              <th style={{ textAlign: 'left', padding: '9px 10px', color: '#021630', fontWeight: 800 }}>{"Actions"}</th>
            </tr>
          </thead>
          <tbody>
            {filteredUtilisateurs.map((u, idx) => (
              <tr key={u.matricule} style={{ borderTop: '1px solid #e5e7eb' }}>
                <td style={{ padding: '8px 10px', fontWeight: 700, background: idx % 2 === 0 ? '#ffffff' : '#fbfdff' }}>{u.matricule}</td>
                <td style={{ padding: '8px 10px' }}>{[u.prenom, u.nom].filter(Boolean).join(' ') || '-'}</td>
                <td style={{ padding: '8px 10px' }}>{u.email || '-'}</td>
                <td style={{ padding: '8px 10px' }}>
                  <select
                    value={u.role || ''}
                    onChange={(e) => updateUtilisateur(u.matricule, { role: e.target.value })}
                    style={{ padding: '5px 7px', borderRadius: 6, border: '1px solid #d1d5db', minWidth: 125 }}
                  >
                    <option value="">Non assigné</option>
                    {adminRoleOptions.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: '8px 10px' }}>
                  <span style={{ color: '#1f2937', fontWeight: 700, background: u.active ? '#e5e7eb' : '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 999, padding: '2px 9px', fontSize: '0.74rem' }}>{u.active ? "Actif" : "Bloqué"}</span>
                </td>
                <td style={{ padding: '8px 10px' }}><span style={{ color: '#021630', fontWeight: 700 }}>{u.mfa_enabled ? "Activé" : "Inactif"}</span></td>
                <td style={{ padding: '8px 10px' }}>{u.mot_de_passe_temporaire ? "Oui" : "Non"}</td>
                <td style={{ padding: '8px 10px' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => updateUtilisateur(u.matricule, { active: !u.active })}
                      style={{ background: '#b91c1c', color: '#ffffff', border: '1px solid #b91c1c', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 700 }}
                    >
                      {u.active ? "Désactiver" : "Activer"}
                    </button>
                    <button
                      onClick={() => updateUtilisateur(u.matricule, { mfa_enabled: !u.mfa_enabled })}
                      style={{ background: '#021630', color: '#ffffff', border: '1px solid #021630', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 700 }}
                    >
                      {u.mfa_enabled ? "Désactiver MFA" : "Activer MFA"}
                    </button>
                    <button
                      onClick={() => resetPasswordTemporaire(u.matricule)}
                      style={{ background: '#6b7280', color: '#ffffff', border: '1px solid #6b7280', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 700 }}
                    >
                      {"Réinitialiser le mot de passe"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredUtilisateurs.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: '14px', color: '#64748b', textAlign: 'center' }}>{"Aucun utilisateur trouvé"}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
