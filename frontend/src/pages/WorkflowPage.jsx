import React, { useState, useEffect, useMemo } from 'react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import ProgressionValidation from '../components/ProgressionValidation'
import CommentairesMission from '../components/CommentairesMission'
import { CheckCircle, XCircle, UserCheck, RefreshCw } from 'lucide-react'
import '../styles/Operations.css'
import { toast } from '../components/ui/bridge'

export default function WorkflowPage() {
  const { user } = useAuth()
  const matricule = useMemo(() => Number(user?.matricule || user?.sub || 0), [user])
  const roleUtilisateur = useMemo(() => String(user?.role || '').toUpperCase(), [user])
  const estValidateur = useMemo(
    () => ['RESPONSABLE', 'DIRECTEUR', 'RH', 'DG', 'DFC', 'PCA', 'AG', 'ADMIN'].includes(roleUtilisateur),
    [roleUtilisateur]
  )

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mesDemandes, setMesDemandes] = useState([])
  const [aValider, setAValider] = useState([])
  const [mesValidations, setMesValidations] = useState([])
  const [mesRefus, setMesRefus] = useState([])
  const [estDeptRh, setEstDeptRh] = useState(false)
  const [recuRhLecture, setRecuRhLecture] = useState([])

  const [selectedOperation, setSelectedOperation] = useState(null)
  const [selectedOperationDetails, setSelectedOperationDetails] = useState(null)
  const [showWorkflowInDetail, setShowWorkflowInDetail] = useState(false)
  const [workflowDecisionComment, setWorkflowDecisionComment] = useState('')
  const [validationRefreshKey, setValidationRefreshKey] = useState(0)
  // Liste des utilisateurs ayant déjà ouvert l'opération sélectionnée.
  // Chaque entrée : { matricule_observateur, nom_observateur, role_observateur, date_vue }
  const [vues, setVues] = useState([])
  // Opérations déjà consultées — double persistance :
  //   1. localStorage  → synchrone, instantané au refresh, couvre demandeur ET validateur
  //   2. OPERATION_VUE → persistance cross-device, source de vérité pour l'audit
  // Les deux sources sont fusionnées (merge) pour ne jamais perdre un état « vu ».
  const seenOpsStorageKey = matricule ? `seenOps_${matricule}` : null
  const [seenOps, setSeenOps] = useState(() => new Set())

  function handleSelectOp(idOperation, clearComment = false) {
    setSelectedOperation(idOperation)
    if (clearComment) setWorkflowDecisionComment('')
    setSeenOps(prev => {
      const key = String(idOperation)
      if (prev.has(key)) return prev
      const next = new Set(prev)
      next.add(key)
      return next
    })
  }

  // ── Étape 1 : initialisation instantanée depuis localStorage (synchrone, pas de flash) ──
  // Couvre aussi le demandeur dont les vues ne sont pas sauvées en DB (skip côté backend).
  useEffect(() => {
    if (!seenOpsStorageKey) return
    try {
      const saved = localStorage.getItem(seenOpsStorageKey)
      if (saved) {
        const ids = JSON.parse(saved)
        if (Array.isArray(ids)) {
          setSeenOps(prev => {
            const merged = new Set(prev)
            ids.forEach(id => merged.add(String(id)))
            return merged
          })
        }
      }
    } catch {}
  }, [seenOpsStorageKey])

  // ── Étape 2 : fusion avec la base (cross-device, source de vérité pour l'audit) ──
  // IMPORTANT : merge (pas overwrite) pour éviter la race condition entre
  // handleSelectOp et le retour du GET.
  useEffect(() => {
    if (!matricule) return
    api.get(`/api/workflow/mes-vues/${matricule}`)
      .then(res => {
        if (Array.isArray(res.data)) {
          setSeenOps(prev => {
            const merged = new Set(prev)
            res.data.forEach(id => merged.add(String(id)))
            return merged
          })
        }
      })
      .catch(() => {})
  }, [matricule])

  // ── Étape 3 : persistance dans localStorage à chaque changement de seenOps ──
  useEffect(() => {
    if (!seenOpsStorageKey) return
    try {
      localStorage.setItem(seenOpsStorageKey, JSON.stringify([...seenOps]))
    } catch {}
  }, [seenOps, seenOpsStorageKey])

  useEffect(() => {
    if (!matricule) return
    loadWorkflow()
  }, [matricule])

  useEffect(() => {
    setShowWorkflowInDetail(false)
  }, [selectedOperation])

  useEffect(() => {
    if (!selectedOperation) { setSelectedOperationDetails(null); setVues([]); return }
    api.get(`/api/operations/${selectedOperation}`)
      .then(res => setSelectedOperationDetails(res.data || null))
      .catch(() => setSelectedOperationDetails(null))
    // Suivi des consultations (B1=tout le monde, B2=première vue uniquement).
    // Le POST est idempotent côté serveur : on l'envoie sans vérifier le rôle.
    // Le .then() garantit que seenOps est à jour même en cas de re-render
    // intercalé entre handleSelectOp et la résolution de ce POST.
    if (matricule) {
      const opId = String(selectedOperation)
      api.post(`/api/workflow/marquer-vu/${selectedOperation}`, null, {
        params: { matricule_observateur: matricule }
      })
        .then(res => {
          setSeenOps(prev => {
            if (prev.has(opId)) return prev
            const next = new Set(prev)
            next.add(opId)
            return next
          })
          // Re-fetch silencieux pour afficher la date_vue dans le tooltip
          if (!res?.data?.already) setValidationRefreshKey(k => k + 1)
        })
        .catch(() => {})
    }
    api.get(`/api/workflow/vues/${selectedOperation}`)
      .then(res => setVues(Array.isArray(res.data) ? res.data : []))
      .catch(() => setVues([]))
  }, [selectedOperation, matricule])

  async function loadWorkflow() {
    setLoading(true)
    setError('')
    try {
      const boite = await api.get(`/api/workflow/boite/${matricule}`).catch(() => null)
      if (boite?.data && typeof boite.data === 'object') {
        const dedup = arr => [...new Map((Array.isArray(arr) ? arr : []).map(o => [o.id_operation, o])).values()]
        setMesDemandes(dedup(boite.data.envoye))
        setAValider(dedup(boite.data.recu))
        setMesValidations(dedup(boite.data.valide))
        setMesRefus(dedup(boite.data.refuse))
        setEstDeptRh(!!boite.data.est_dept_rh)
        setRecuRhLecture(dedup(boite.data.recu_rh_lecture))
      } else {
        const [mes, valider, validations, refus] = await Promise.all([
          api.get(`/api/workflow/mes-demandes/${matricule}`).catch(() => ({ data: [] })),
          api.get(`/api/workflow/a-valider/${matricule}`).catch(() => ({ data: [] })),
          api.get(`/api/workflow/mes-validations/${matricule}`).catch(() => ({ data: [] })),
          api.get(`/api/workflow/mes-refus/${matricule}`).catch(() => ({ data: [] }))
        ])
        const dedup = arr => [...new Map((Array.isArray(arr) ? arr : []).map(o => [o.id_operation, o])).values()]
        setMesDemandes(dedup(mes.data))
        setAValider(dedup(valider.data))
        setMesValidations(dedup(validations.data))
        setMesRefus(dedup(refus.data))
      }
    } catch (e) {
      setError(e.response?.data?.detail || 'Erreur de chargement du workflow')
    } finally {
      setLoading(false)
    }
  }

  async function validerOperation(idOperation, statut, commentaire = null) {
    try {
      await api.post(`/api/workflow/valider/${idOperation}`, null, {
        params: { matricule_validateur: matricule, statut, commentaire }
      })
      await loadWorkflow()
      setValidationRefreshKey(k => k + 1)
      return true
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de la validation')
      return false
    }
  }

  async function soumettreDecision(statut) {
    if (!selectedOperation) return
    const commentaire = statut === 'refusé' ? workflowDecisionComment.trim() : (workflowDecisionComment.trim() || null)
    if (statut === 'refusé' && !commentaire) { toast.warning('Le motif de refus est obligatoire'); return }
    const ok = await validerOperation(selectedOperation, statut, commentaire)
    if (ok) { setWorkflowDecisionComment(''); setSelectedOperation(null) }
  }

  const workflowCols = useMemo(() => ({
    enAttente: mesDemandes.filter(d => String(d.statut || '').toLowerCase().includes('attente')),
    valides:   mesDemandes.filter(d => String(d.statut || '').toLowerCase().includes('valid')),
    refuses:   mesDemandes.filter(d => String(d.statut || '').toLowerCase().includes('refus')),
  }), [mesDemandes])

  const canValidate = useMemo(
    () => estValidateur && aValider.some(item => String(item.id_operation) === String(selectedOperation)),
    [estValidateur, aValider, selectedOperation]
  )

  const selectedWorkflowData = useMemo(() => {
    if (!selectedOperation) return null
    const workflowItem = [...aValider, ...mesDemandes, ...mesValidations, ...mesRefus]
      .find(item => String(item.id_operation) === String(selectedOperation))
    const rawType = String(workflowItem?.type_demande || '').toLowerCase()
    const normalizedType = rawType.includes('mission') ? 'mission' : rawType.includes('permission') ? 'permission' : 'conge'
    return { workflowItem, normalizedType }
  }, [selectedOperation, aValider, mesDemandes, mesValidations, mesRefus])

  const readonlyFormData = useMemo(() => {
    if (!selectedWorkflowData) return null
    const fmtDate = v => { if (!v) return ''; const d = new Date(v); return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0] }
    const { workflowItem, normalizedType } = selectedWorkflowData
    const op = selectedOperationDetails
    const details = op?.details || {}
    const common = {
      typeDemande: workflowItem?.type_demande || op?.type || 'Demande opération',
      demandeur: workflowItem?.demandeur?.nom_complet || '',
      dateDemande: fmtDate(workflowItem?.date_demande),
      dateDebut: fmtDate(workflowItem?.date_debut || op?.date_depart),
      dateFin: fmtDate(workflowItem?.date_fin || op?.date_retour),
      duree: workflowItem?.duree_jours || op?.duree || '',
      motif: workflowItem?.motif || op?.commentaire || '',
    }
    if (normalizedType === 'mission') {
      return { ...common, type: 'mission', objet: workflowItem?.motif || '', pays: details?.pays || '', ville: details?.ville || '', transport: details?.transport || '', emailContact: details?.email_mission || '', heureDepart: details?.heure_depart || '', heureRetour: details?.heure_retour || '' }
    }
    if (normalizedType === 'permission') {
      return { ...common, type: 'permission', typePermission: workflowItem?.type_demande || 'Permission', sousType: details?.sous_type || '' }
    }
    return { ...common, type: 'conge' }
  }, [selectedWorkflowData, selectedOperationDetails])

  return (
    <div className="operations-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', background: 'linear-gradient(90deg, #021630 0%, #112033 100%)', borderRadius: 10, marginBottom: 20, color: 'white' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'white' }}>{"Workflow de validation"}</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', opacity: 0.8, color: 'white' }}>{"Suivi des demandes et validations"}</p>
        </div>
        <button
          onClick={loadWorkflow}
          disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: '0.82rem', color: 'white', fontWeight: 600 }}
        >
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> {"Rafraîchir"}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading && <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>{"Chargement..."}</div>}

      {!loading && (
        <div className="tab-pane">

          {/* Stats */}
          <div className="form-card" style={{ marginBottom: '12px', padding: '10px 12px' }}>
            <div style={{ display: 'grid', gap: '6px', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px' }}>
                <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>{"Envoyé"}</div>
                <div style={{ fontWeight: 700, color: 'var(--text)' }}>{mesDemandes.length}</div>
              </div>
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '8px' }}>
                <div style={{ fontSize: '0.72rem', color: '#9a3412', textTransform: 'uppercase' }}>{"Reçu — À valider"}</div>
                <div style={{ fontWeight: 700, color: '#7c2d12' }}>{aValider.length}</div>
              </div>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '8px' }}>
                <div style={{ fontSize: '0.72rem', color: '#166534', textTransform: 'uppercase' }}>{"Validé par moi"}</div>
                <div style={{ fontWeight: 700, color: '#14532d' }}>{mesValidations.length}</div>
              </div>
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '8px' }}>
                <div style={{ fontSize: '0.72rem', color: '#991b1b', textTransform: 'uppercase' }}>{"Refusé par moi"}</div>
                <div style={{ fontWeight: 700, color: '#7f1d1d' }}>{mesRefus.length}</div>
              </div>
              {estDeptRh && (
                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '8px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#0369a1', textTransform: 'uppercase' }}>{"Reçu RH — Lecture"}</div>
                  <div style={{ fontWeight: 700, color: '#075985' }}>{recuRhLecture.length}</div>
                </div>
              )}
            </div>
          </div>

          {/* Detail view when an operation is selected */}
          {selectedOperation && (
            <div style={{ marginBottom: '14px', maxWidth: '760px', marginInline: 'auto' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => { setSelectedOperation(null); setWorkflowDecisionComment(''); setShowWorkflowInDetail(false) }}
                >
                  {"Fermer le détail"}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowWorkflowInDetail(v => !v)}
                  style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                >
                  {showWorkflowInDetail ? "Masquer le workflow" : "Voir le workflow"}
                </button>
              </div>

              {/* Liste des consultations — qui a déjà ouvert l'opération et quand
                  (B2 : seule la PREMIÈRE consultation par utilisateur est conservée). */}
              {vues.length > 0 && (
                <div className="card" style={{ marginBottom: '10px', padding: '8px 10px', borderTop: '3px solid #112033' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#021630', textTransform: 'uppercase', marginBottom: '6px' }}>
                    {"Consulté par"} <span style={{ color: '#64748b', fontWeight: 500 }}>({vues.length})</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {vues.map(v => {
                      const d = v.date_vue ? new Date(v.date_vue) : null
                      const dateStr = d ? d.toLocaleString('fr-FR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      }) : ''
                      const label = v.nom_observateur || v.matricule_observateur
                      return (
                        <span key={`${v.matricule_observateur}-${v.date_vue}`} title={`${v.matricule_observateur}${v.role_observateur ? ' — ' + v.role_observateur : ''} • ${dateStr}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 8px', borderRadius: '999px', background: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: '0.72rem', color: '#0f172a' }}>
                          <strong style={{ fontWeight: 600 }}>{label}</strong>
                          <span style={{ color: '#64748b' }}>·</span>
                          <span style={{ color: '#475569' }}>{dateStr}</span>
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              {showWorkflowInDetail && (
                <div className="card" style={{ marginBottom: '12px', padding: '8px 10px', border: '2px solid rgba(206,43,43,0.35)', boxShadow: '0 0 0 3px rgba(206,43,43,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
                    <button type="button" onClick={() => setShowWorkflowInDetail(false)}
                      style={{ width: '24px', height: '24px', borderRadius: '999px', border: 'none', background: '#ce2b2b', color: '#fff', fontWeight: 700, cursor: 'pointer', lineHeight: 1, fontSize: '0.85rem', padding: 0 }}>×</button>
                  </div>
                  <ProgressionValidation idOperation={selectedOperation} typeDefault="Demande opération" refreshTrigger={validationRefreshKey} />
                </div>
              )}

              {!showWorkflowInDetail && (
                <>
                  {canValidate && (
                    <div className="card" style={{ marginBottom: '8px', padding: '8px 10px', borderTop: '4px solid #112033', textAlign: 'center' }}>
                      <h3 style={{ marginTop: 0, marginBottom: '6px', color: '#021630', fontSize: '0.9rem' }}>{"Action du validateur"}</h3>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                        {"Commentaire de validation"}
                      </label>
                      <textarea
                        value={workflowDecisionComment}
                        onChange={e => setWorkflowDecisionComment(e.target.value)}
                        placeholder="Ajoutez un commentaire. Le motif est obligatoire en cas de refus."
                        rows={1}
                        style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '6px 8px', resize: 'vertical', marginBottom: '6px', fontFamily: 'inherit', fontSize: '0.78rem', maxHeight: '64px' }}
                      />
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button className="btn btn-success" onClick={() => soumettreDecision('validé')} style={{ padding: '5px 10px', fontSize: '0.76rem', width: 'auto' }}>{"Valider"}</button>
                        <button className="btn btn-danger" onClick={() => soumettreDecision('refusé')} disabled={!workflowDecisionComment.trim()} style={{ opacity: workflowDecisionComment.trim() ? 1 : 0.6, padding: '5px 10px', fontSize: '0.76rem' }}>{"Refuser"}</button>
                      </div>
                    </div>
                  )}

                  {readonlyFormData && (
                    <div className="form-card readonly-compact-form" style={{ marginBottom: '8px', padding: '12px 14px', borderLeft: '4px solid #112033' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
                        <h3 style={{ margin: 0, color: '#021630', fontSize: '1.06rem' }}>{"Formulaire en lecture seule"}</h3>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#112033', background: '#e8edf4', padding: '5px 9px', borderRadius: '999px' }}>#{selectedOperation}</span>
                      </div>
                      <div style={{ display: 'grid', gap: '6px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                          <div className="form-group"><label>{"Type de demande"}</label><input className="input" value={readonlyFormData.typeDemande} readOnly /></div>
                          <div className="form-group"><label>{"Demandeur"}</label><input className="input" value={readonlyFormData.demandeur || 'Non renseigné'} readOnly /></div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px' }}>
                          <div className="form-group"><label>{"Date de début"}</label><input className="input" value={readonlyFormData.dateDebut || ''} readOnly /></div>
                          <div className="form-group"><label>{"Date de fin"}</label><input className="input" value={readonlyFormData.dateFin || ''} readOnly /></div>
                          <div className="form-group"><label>Date de demande</label><input className="input" value={readonlyFormData.dateDemande || ''} readOnly /></div>
                          <div className="form-group"><label>{"Durée (jours)"}</label><input className="input" value={readonlyFormData.duree ? String(readonlyFormData.duree) : ''} readOnly /></div>
                        </div>
                        {readonlyFormData.type === 'mission' && (
                          <>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
                              <div className="form-group"><label>Objet / Motif mission</label><input className="input" value={readonlyFormData.objet || ''} readOnly /></div>
                              <div className="form-group"><label>{"Pays"}</label><input className="input" value={readonlyFormData.pays || ''} readOnly /></div>
                              <div className="form-group"><label>Ville</label><input className="input" value={readonlyFormData.ville || ''} readOnly /></div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
                              <div className="form-group"><label>{"Heure de départ"}</label><input className="input" value={readonlyFormData.heureDepart || ''} readOnly /></div>
                              <div className="form-group"><label>{"Heure de retour"}</label><input className="input" value={readonlyFormData.heureRetour || ''} readOnly /></div>
                              <div className="form-group"><label>{"Mode de transport"}</label><input className="input" value={readonlyFormData.transport || ''} readOnly /></div>
                            </div>
                          </>
                        )}
                        {readonlyFormData.type === 'permission' && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                            <div className="form-group"><label>{"Type de permission"}</label><input className="input" value={readonlyFormData.typePermission || ''} readOnly /></div>
                            <div className="form-group"><label>{"Sous-type"}</label><input className="input" value={readonlyFormData.sousType || ''} readOnly /></div>
                          </div>
                        )}
                        <div className="form-group"><label>{"Motif / Commentaire"}</label><textarea className="input" value={readonlyFormData.motif || ''} readOnly rows={1} style={{ resize: 'none', maxHeight: '48px' }} /></div>
                      </div>
                    </div>
                  )}

                  {selectedWorkflowData?.normalizedType === 'mission' && (
                    <div style={{ marginTop: '10px' }}>
                      <CommentairesMission idMission={selectedOperation} matricule={matricule} />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Kanban boards */}
          {!selectedOperation && (
            <>
              <h3 style={{ marginBottom: '10px' }}>{"Boîte d'envoi"}</h3>
              <div className="kanban-grid">
                <div className="kanban-col orange-light">
                  <h3>En attente ({workflowCols.enAttente.length})</h3>
                  {workflowCols.enAttente.length === 0 ? <p className="empty-state">Aucune</p>
                    : workflowCols.enAttente.map(o => (
                      <div key={`ea-${o.id_operation}`} className="kanban-card" onClick={() => handleSelectOp(o.id_operation)} style={{ cursor: 'pointer' }}>
                        <span className={seenOps.has(String(o.id_operation)) ? 'kanban-badge-seen' : 'kanban-badge-new'} aria-label={seenOps.has(String(o.id_operation)) ? 'vu' : 'nouveau'} />
                        <p><strong>#{o.id_operation}</strong> – {o.type_demande}</p>
                        <p style={{ fontSize: '0.8em', color: '#64748b' }}>{o.statut}</p>
                      </div>
                    ))}
                </div>
                <div className="kanban-col green">
                  <h3>Validées ({workflowCols.valides.length})</h3>
                  {workflowCols.valides.length === 0 ? <p className="empty-state">Aucune</p>
                    : workflowCols.valides.map(o => (
                      <div key={`ev-${o.id_operation}`} className="kanban-card" onClick={() => handleSelectOp(o.id_operation)} style={{ cursor: 'pointer' }}>
                        <span className={seenOps.has(String(o.id_operation)) ? 'kanban-badge-seen' : 'kanban-badge-new'} aria-label={seenOps.has(String(o.id_operation)) ? 'vu' : 'nouveau'} />
                        <p><strong>#{o.id_operation}</strong> – {o.type_demande}</p>
                      </div>
                    ))}
                </div>
                <div className="kanban-col red">
                  <h3>Refusées ({workflowCols.refuses.length})</h3>
                  {workflowCols.refuses.length === 0 ? <p className="empty-state">Aucune</p>
                    : workflowCols.refuses.map(o => (
                      <div key={`er-${o.id_operation}`} className="kanban-card" onClick={() => handleSelectOp(o.id_operation)} style={{ cursor: 'pointer' }}>
                        <span className={seenOps.has(String(o.id_operation)) ? 'kanban-badge-seen' : 'kanban-badge-new'} aria-label={seenOps.has(String(o.id_operation)) ? 'vu' : 'nouveau'} />
                        <p><strong>#{o.id_operation}</strong> – {o.type_demande}</p>
                      </div>
                    ))}
                </div>
              </div>

              {estValidateur && (
                <>
                  <div style={{ marginTop: '14px', marginBottom: '8px' }}>
                    <h3 style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <UserCheck size={14} /> Boîte Reçu (validateur)
                    </h3>
                  </div>
                  <div className="kanban-grid">
                    <div className="kanban-col orange">
                      <h3>À valider ({aValider.length})</h3>
                      {aValider.length === 0 ? <p className="empty-state">Aucune validation</p>
                        : aValider.map(o => (
                          <div key={`ra-${o.id_operation}`} className="kanban-card" onClick={() => handleSelectOp(o.id_operation, true)} style={{ cursor: 'pointer' }}>
                            <span className={seenOps.has(String(o.id_operation)) ? 'kanban-badge-seen' : 'kanban-badge-new'} aria-label={seenOps.has(String(o.id_operation)) ? 'vu' : 'nouveau'} />
                            <p><strong>#{o.id_operation}</strong> – {o.type_demande}</p>
                            <p style={{ fontSize: '0.8em', color: '#64748b', marginBottom: 0 }}>Cliquer pour examiner puis décider</p>
                          </div>
                        ))}
                    </div>
                    <div className="kanban-col blue">
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle size={14} /> Validées par moi ({mesValidations.length})</h3>
                      {mesValidations.length === 0 ? <p className="empty-state">Aucune validation</p>
                        : mesValidations.map(o => (
                          <div key={`rv-${o.id_operation}`} className="kanban-card" onClick={() => handleSelectOp(o.id_operation)} style={{ cursor: 'pointer' }}>
                            <span className={seenOps.has(String(o.id_operation)) ? 'kanban-badge-seen' : 'kanban-badge-new'} aria-label={seenOps.has(String(o.id_operation)) ? 'vu' : 'nouveau'} />
                            <p><strong>#{o.id_operation}</strong> – {o.type_demande}</p>
                            <p style={{ fontSize: '0.8em', color: '#666' }}>{o.demandeur?.nom || 'N/A'}</p>
                          </div>
                        ))}
                    </div>
                    <div className="kanban-col purple">
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}><XCircle size={14} /> Refusées par moi ({mesRefus.length})</h3>
                      {mesRefus.length === 0 ? <p className="empty-state">Aucun refus</p>
                        : mesRefus.map(o => (
                          <div key={`rr-${o.id_operation}`} className="kanban-card" onClick={() => handleSelectOp(o.id_operation)} style={{ cursor: 'pointer' }}>
                            <span className={seenOps.has(String(o.id_operation)) ? 'kanban-badge-seen' : 'kanban-badge-new'} aria-label={seenOps.has(String(o.id_operation)) ? 'vu' : 'nouveau'} />
                            <p><strong>#{o.id_operation}</strong> – {o.type_demande}</p>
                            <p style={{ fontSize: '0.8em', color: '#666' }}>{o.demandeur?.nom || 'N/A'}</p>
                            {o.motif_refus && <p style={{ fontSize: '0.72em', color: '#c0392b', fontStyle: 'italic' }}>Motif: {o.motif_refus}</p>}
                          </div>
                        ))}
                    </div>
                  </div>
                </>
              )}

              {/* Reçu RH — Lecture seule (employés du département RH sans rôle validateur RH) */}
              {estDeptRh && recuRhLecture.length > 0 && (
                <>
                  <div style={{ marginTop: '14px', marginBottom: '8px' }}>
                    <h3 style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: 6, color: '#0369a1' }}>
                      👁 Reçu RH — Lecture seule
                      <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#64748b', background: '#f1f5f9', borderRadius: '999px', padding: '2px 8px', marginLeft: 4 }}>Consultation uniquement</span>
                    </h3>
                  </div>
                  <div className="kanban-grid">
                    <div className="kanban-col" style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                      <h3 style={{ color: '#0369a1' }}>En attente validation RH ({recuRhLecture.length})</h3>
                      {recuRhLecture.map(o => (
                        <div key={`rh-${o.id_operation}`} className="kanban-card" onClick={() => handleSelectOp(o.id_operation)} style={{ cursor: 'pointer', borderLeft: '3px solid #0369a1' }}>
                          <span className={seenOps.has(String(o.id_operation)) ? 'kanban-badge-seen' : 'kanban-badge-new'} aria-label={seenOps.has(String(o.id_operation)) ? 'vu' : 'nouveau'} />
                          <p><strong>#{o.id_operation}</strong> – {o.type_demande}</p>
                          <p style={{ fontSize: '0.8em', color: '#64748b', marginBottom: 0 }}>{o.demandeur?.nom_complet || o.demandeur?.nom || 'N/A'}</p>
                          <p style={{ fontSize: '0.72em', color: '#0369a1', marginTop: '2px' }} title="Consultation uniquement">👁 Lecture seule</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
