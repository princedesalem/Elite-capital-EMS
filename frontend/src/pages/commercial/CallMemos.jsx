import React, { useEffect, useState, useCallback } from 'react'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { Plus, Download, X, Trash2, FileText, Edit3, ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react'
import { BRAND_GRADIENT, BRAND_NAVY, BRAND_RED } from '../../theme'

const READONLY = ['DG', 'PCA', 'AG', 'ADMIN']

const emptyPlan = () => ({
  ordre: 1, libelle: '', montant: '', devise: 'XOF',
  delai_execution: '', responsable: '', responsable_matricule: '',
  statut: 'OUVERT', date_depart: '', date_effective_fin: '',
  justificatif: '', commentaires: '',
})
const emptyMemo = (matricule) => ({
  type: 'SOUSCRIPTION',
  type_client: 'PROSPECT',
  pole: '',
  deal_id: '', client_id: '',
  nom_client: '',
  date_visite: new Date().toISOString().slice(0, 10),
  heure_visite: '',
  type_entretien_physique: true, type_entretien_telephonique: false,
  lieu: '',
  participant1_nom: '', participant1_fonction: '', participant1_tel: '', participant1_email: '',
  participant2_nom: '', participant2_fonction: '', participant2_tel: '', participant2_email: '',
  participants_client: '', participants_elite: '',
  employeur: '', ville: '', pays: '',
  initiateur: '',
  gestionnaire1_matricule: '', gestionnaire2_matricule: '',
  secteur_activite: '', capacite_financiere: '',
  objet_1: '', objet_2: '', objet: '',
  deroulement: '',
  produit_financier: 'AUCUN',
  abonnement: false,
  duree_mois: '',
  valeur_liquidative: '',
  montant_attendu: '', montant_souscrit: '', montant_abonnement: '', montant_rachat: '',
  issue: 'AUCUNE',
  charge_matricule: matricule || '',
  plans: [emptyPlan()],
})

const STEPS = [
  { id: 'identification', label: 'Identification' },
  { id: 'entretien', label: 'Entretien' },
  { id: 'participants', label: 'Participants' },
  { id: 'contenu', label: 'Contenu' },
  { id: 'financier', label: 'Financier' },
  { id: 'plans', label: "Plans d'action" },
]

export default function CallMemos() {
  const { user } = useAuth()
  const role = String(user?.role || '').toUpperCase()
  const isReadOnly = READONLY.includes(role)

  const [memos, setMemos] = useState([])
  const [clients, setClients] = useState([])
  const [deals, setDeals] = useState([])
  const [referentiels, setReferentiels] = useState({ POLE: [], OBJET_VISITE: [], SECTEUR: [] })
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyMemo(user?.matricule))
  const [step, setStep] = useState(0)
  const [filterType, setFilterType] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const params = {}
      if (filterType) params.type = filterType
      const [m, c, d] = await Promise.all([
        api.get('/api/commercial/call-memos', { params }),
        api.get('/api/commercial/clients'),
        api.get('/api/commercial/deals'),
      ])
      setMemos(m.data || []); setClients(c.data || []); setDeals(d.data || [])
    } catch (e) { setError(e?.response?.data?.detail || 'Erreur') }
  }, [filterType])

  const loadReferentiels = useCallback(async () => {
    try {
      const cats = ['POLE', 'OBJET_VISITE', 'SECTEUR']
      const results = await Promise.all(cats.map((c) => api.get('/api/commercial/referentiels', { params: { categorie: c } })))
      const merged = {}
      cats.forEach((c, i) => { merged[c] = Array.isArray(results[i].data) ? results[i].data : [] })
      setReferentiels(merged)
    } catch (_) { /* silencieux */ }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadReferentiels() }, [loadReferentiels])

  function startNew() {
    setEditingId(null)
    setForm(emptyMemo(user?.matricule))
    setStep(0)
    setShowForm(true)
    setError('')
  }
  function startEdit(m) {
    setEditingId(m.id)
    setForm({
      ...emptyMemo(user?.matricule),
      ...m,
      deal_id: m.deal_id || '',
      client_id: m.client_id || '',
      duree_mois: m.duree_mois ?? '',
      valeur_liquidative: m.valeur_liquidative ?? '',
      montant_attendu: m.montant_attendu ?? '',
      montant_souscrit: m.montant_souscrit ?? '',
      montant_abonnement: m.montant_abonnement ?? '',
      montant_rachat: m.montant_rachat ?? '',
      plans: (m.plans && m.plans.length ? m.plans : [emptyPlan()]).map((p) => ({
        ...emptyPlan(), ...p,
        montant: p.montant ?? '',
        date_depart: p.date_depart || '',
        date_effective_fin: p.date_effective_fin || '',
      })),
    })
    setStep(0)
    setShowForm(true)
    setError('')
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    try {
      const num = (v) => (v === '' || v == null ? null : Number(v))
      const payload = {
        ...form,
        deal_id: form.deal_id ? Number(form.deal_id) : null,
        client_id: form.client_id ? Number(form.client_id) : null,
        duree_mois: num(form.duree_mois),
        valeur_liquidative: num(form.valeur_liquidative),
        montant_attendu: num(form.montant_attendu),
        montant_souscrit: num(form.montant_souscrit),
        montant_abonnement: num(form.montant_abonnement),
        montant_rachat: num(form.montant_rachat),
        plans: form.plans.filter((p) => p.libelle).map((p, i) => ({
          ...p,
          ordre: i + 1,
          montant: num(p.montant),
          date_depart: p.date_depart || null,
          date_effective_fin: p.date_effective_fin || null,
        })),
      }
      if (editingId) await api.patch(`/api/commercial/call-memos/${editingId}`, payload)
      else await api.post('/api/commercial/call-memos', payload)
      setShowForm(false); setEditingId(null); load()
    } catch (err) { setError(err?.response?.data?.detail || 'Erreur') }
  }

  async function download(memoId, ext) {
    try {
      const r = await api.get(`/api/commercial/call-memos/${memoId}/export/${ext}`, { responseType: 'blob' })
      const cd = r.headers['content-disposition'] || ''
      const match = cd.match(/filename="?([^"]+)"?/)
      const filename = match ? match[1] : `call_memo.${ext}`
      const url = URL.createObjectURL(r.data)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { setError('Erreur lors du téléchargement') }
  }
  async function del(id) {
    if (!window.confirm('Supprimer ce call memo ?')) return
    try { await api.delete(`/api/commercial/call-memos/${id}`); load() }
    catch (e) { setError(e?.response?.data?.detail || 'Erreur') }
  }

  function setPlan(i, k, v) { const plans = [...form.plans]; plans[i] = { ...plans[i], [k]: v }; setForm({ ...form, plans }) }
  function addPlan() { setForm({ ...form, plans: [...form.plans, { ...emptyPlan(), ordre: form.plans.length + 1 }] }) }
  function rmPlan(i) { setForm({ ...form, plans: form.plans.filter((_, idx) => idx !== i) }) }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: BRAND_NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FileText size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: BRAND_NAVY }}>Call Memos</h1>
            <p style={{ margin: '2px 0 0', color: '#667085', fontSize: '0.85rem' }}>Comptes rendus de visite clientèle &amp; souscription</p>
          </div>
        </div>
        {!isReadOnly && (
          <button onClick={startNew} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: BRAND_NAVY, color: '#fff', border: 0, padding: '9px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }}>
            <Plus size={15} /> Nouveau call memo
          </button>
        )}
      </div>

      <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ background: '#fff', padding: 16, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem' }}>
            Type :
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #d0d5dd', borderRadius: 6 }}>
              <option value="">Tous</option>
              <option value="SOUSCRIPTION">Souscription</option>
              <option value="PROSPECTION">Prospection</option>
            </select>
          </label>
          <div style={{ marginLeft: 'auto', fontSize: '0.88rem', color: '#667085' }}>{memos.length} call memo(s)</div>
        </div>

        {error && <div style={{ padding: '10px 14px', background: '#fee', color: '#9a1010', borderRadius: 6, marginBottom: 12 }}>{error}</div>}

        <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={th}>Date</th>
                <th style={th}>Type</th>
                <th style={th}>Client</th>
                <th style={th}>Pôle</th>
                <th style={th}>Objet</th>
                <th style={th}>Chargé</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {memos.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#888' }}>Aucun call memo</td></tr>
              )}
              {memos.map((m) => (
                <tr key={m.id} style={{ borderBottom: '1px solid #f0f1f3' }}>
                  <td style={td}>{m.date_visite}</td>
                  <td style={td}>
                    <Tag color={m.type === 'SOUSCRIPTION' ? '#1f7a3d' : BRAND_NAVY}>{m.type}</Tag>
                  </td>
                  <td style={td}><strong style={{ color: BRAND_NAVY }}>{m.nom_client}</strong></td>
                  <td style={td}>{m.pole || '-'}</td>
                  <td style={{ ...td, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.objet_1 || m.objet || '-'}</td>
                  <td style={td}>{m.charge_nom || m.charge_matricule}</td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => startEdit(m)} style={iconBtn} title="Modifier"><Edit3 size={14} /></button>
                    <button onClick={() => download(m.id, 'docx')} style={iconBtn} title="Word"><FileSpreadsheet size={14} /></button>
                    <button onClick={() => download(m.id, 'pdf')} style={{ ...iconBtn, color: BRAND_RED }} title="PDF"><Download size={14} /></button>
                    {!isReadOnly && (
                      <button onClick={() => del(m.id)} style={{ ...iconBtn, color: BRAND_RED }} title="Supprimer"><Trash2 size={14} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div style={modalOverlay} onClick={() => setShowForm(false)}>
          <form onSubmit={submit} onClick={(e) => e.stopPropagation()} style={modalDialog}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: BRAND_NAVY }}>{editingId ? 'Modifier le call memo' : 'Nouveau call memo'}</h2>
              <button type="button" onClick={() => setShowForm(false)} style={{ background: 'transparent', border: 0, color: '#667085', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            {/* Stepper */}
            <div style={{ display: 'flex', borderBottom: '1px solid #f0f1f3', background: '#f9fafb' }}>
              {STEPS.map((s, i) => (
                <button type="button" key={s.id} onClick={() => setStep(i)}
                  style={{
                    flex: 1, padding: '10px 8px', background: 'transparent', border: 0, cursor: 'pointer',
                    borderBottom: step === i ? `3px solid ${BRAND_NAVY}` : '3px solid transparent',
                    color: step === i ? BRAND_NAVY : '#667085', fontWeight: step === i ? 700 : 500,
                    fontSize: '0.82rem',
                  }}>
                  {i + 1}. {s.label}
                </button>
              ))}
            </div>

            <div style={{ padding: 20, maxHeight: '60vh', overflowY: 'auto' }}>
              {error && <div style={{ padding: '10px 14px', background: '#fee', color: '#9a1010', borderRadius: 6, marginBottom: 12 }}>{error}</div>}

              {step === 0 && (
                <>
                  <Row>
                    <Field label="Type de memo *">
                      <select required value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={inp}>
                        <option value="SOUSCRIPTION">Souscription</option>
                        <option value="PROSPECTION">Prospection</option>
                      </select>
                    </Field>
                    <Field label="Type client">
                      <select value={form.type_client} onChange={(e) => setForm({ ...form, type_client: e.target.value })} style={inp}>
                        <option value="PROSPECT">Prospect</option>
                        <option value="CLIENT">Client</option>
                      </select>
                    </Field>
                    <Field label="Pôle">
                      <select value={form.pole} onChange={(e) => setForm({ ...form, pole: e.target.value })} style={inp}>
                        <option value="">—</option>
                        {(referentiels.POLE || []).map((r) => <option key={r.id} value={r.libelle}>{r.libelle}</option>)}
                      </select>
                    </Field>
                  </Row>
                  <Row>
                    <Field label="Client (référence)">
                      <select value={form.client_id} onChange={(e) => {
                        const cid = e.target.value
                        const c = clients.find((x) => String(x.id) === String(cid))
                        setForm({
                          ...form, client_id: cid,
                          nom_client: c?.raison_sociale || form.nom_client,
                          secteur_activite: c?.secteur_activite || form.secteur_activite,
                          employeur: c?.employeur || form.employeur,
                          ville: c?.ville || form.ville,
                          pays: c?.pays || form.pays,
                        })
                      }} style={inp}>
                        <option value="">—</option>
                        {clients.map((c) => <option key={c.id} value={c.id}>{c.raison_sociale}</option>)}
                      </select>
                    </Field>
                    <Field label="Nom du client *">
                      <input required value={form.nom_client} onChange={(e) => setForm({ ...form, nom_client: e.target.value })} style={inp} />
                    </Field>
                  </Row>
                  <Row>
                    <Field label="Employeur"><input value={form.employeur} onChange={(e) => setForm({ ...form, employeur: e.target.value })} style={inp} /></Field>
                    <Field label="Ville"><input value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} style={inp} /></Field>
                    <Field label="Pays"><input value={form.pays} onChange={(e) => setForm({ ...form, pays: e.target.value })} style={inp} /></Field>
                  </Row>
                  <Row>
                    <Field label="Secteur d'activité">
                      <select value={form.secteur_activite} onChange={(e) => setForm({ ...form, secteur_activite: e.target.value })} style={inp}>
                        <option value="">—</option>
                        {(referentiels.SECTEUR || []).map((r) => <option key={r.id} value={r.libelle}>{r.libelle}</option>)}
                      </select>
                    </Field>
                    <Field label="Capacité financière"><input value={form.capacite_financiere} onChange={(e) => setForm({ ...form, capacite_financiere: e.target.value })} style={inp} /></Field>
                  </Row>
                </>
              )}

              {step === 1 && (
                <>
                  <Row>
                    <Field label="Date de visite *"><input required type="date" value={form.date_visite} onChange={(e) => setForm({ ...form, date_visite: e.target.value })} style={inp} /></Field>
                    <Field label="Heure"><input value={form.heure_visite} onChange={(e) => setForm({ ...form, heure_visite: e.target.value })} placeholder="ex: 14h30" style={inp} /></Field>
                    <Field label="Lieu"><input value={form.lieu} onChange={(e) => setForm({ ...form, lieu: e.target.value })} style={inp} /></Field>
                  </Row>
                  <Row>
                    <Field full>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="checkbox" checked={form.type_entretien_physique} onChange={(e) => setForm({ ...form, type_entretien_physique: e.target.checked })} />
                        Entretien physique
                      </label>
                    </Field>
                    <Field full>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="checkbox" checked={form.type_entretien_telephonique} onChange={(e) => setForm({ ...form, type_entretien_telephonique: e.target.checked })} />
                        Entretien téléphonique
                      </label>
                    </Field>
                  </Row>
                  <Row>
                    <Field label="Initiateur"><input value={form.initiateur} onChange={(e) => setForm({ ...form, initiateur: e.target.value })} style={inp} /></Field>
                    <Field label="Gestionnaire 1 (matricule)"><input value={form.gestionnaire1_matricule} onChange={(e) => setForm({ ...form, gestionnaire1_matricule: e.target.value })} style={inp} /></Field>
                    <Field label="Gestionnaire 2 (matricule)"><input value={form.gestionnaire2_matricule} onChange={(e) => setForm({ ...form, gestionnaire2_matricule: e.target.value })} style={inp} /></Field>
                  </Row>
                  <Row>
                    <Field label="Chargé d'affaire (matricule) *"><input required value={form.charge_matricule} onChange={(e) => setForm({ ...form, charge_matricule: e.target.value })} style={inp} /></Field>
                    <Field label="Deal lié">
                      <select value={form.deal_id} onChange={(e) => setForm({ ...form, deal_id: e.target.value })} style={inp}>
                        <option value="">—</option>
                        {deals.map((d) => <option key={d.id} value={d.id}>{d.titre} ({d.client_nom})</option>)}
                      </select>
                    </Field>
                  </Row>
                </>
              )}

              {step === 2 && (
                <>
                  <Section title="Participant 1">
                    <Row>
                      <Field label="Nom"><input value={form.participant1_nom} onChange={(e) => setForm({ ...form, participant1_nom: e.target.value })} style={inp} /></Field>
                      <Field label="Fonction"><input value={form.participant1_fonction} onChange={(e) => setForm({ ...form, participant1_fonction: e.target.value })} style={inp} /></Field>
                    </Row>
                    <Row>
                      <Field label="Téléphone"><input value={form.participant1_tel} onChange={(e) => setForm({ ...form, participant1_tel: e.target.value })} style={inp} /></Field>
                      <Field label="Email"><input type="email" value={form.participant1_email} onChange={(e) => setForm({ ...form, participant1_email: e.target.value })} style={inp} /></Field>
                    </Row>
                  </Section>
                  <Section title="Participant 2">
                    <Row>
                      <Field label="Nom"><input value={form.participant2_nom} onChange={(e) => setForm({ ...form, participant2_nom: e.target.value })} style={inp} /></Field>
                      <Field label="Fonction"><input value={form.participant2_fonction} onChange={(e) => setForm({ ...form, participant2_fonction: e.target.value })} style={inp} /></Field>
                    </Row>
                    <Row>
                      <Field label="Téléphone"><input value={form.participant2_tel} onChange={(e) => setForm({ ...form, participant2_tel: e.target.value })} style={inp} /></Field>
                      <Field label="Email"><input type="email" value={form.participant2_email} onChange={(e) => setForm({ ...form, participant2_email: e.target.value })} style={inp} /></Field>
                    </Row>
                  </Section>
                  <Section title="Listes complémentaires">
                    <Row>
                      <Field label="Participants — côté CLIENT (texte libre)" full>
                        <textarea rows={2} value={form.participants_client} onChange={(e) => setForm({ ...form, participants_client: e.target.value })} style={{ ...inp, fontFamily: 'inherit' }} />
                      </Field>
                    </Row>
                    <Row>
                      <Field label="Participants — côté ELITE CAPITAL (texte libre)" full>
                        <textarea rows={2} value={form.participants_elite} onChange={(e) => setForm({ ...form, participants_elite: e.target.value })} style={{ ...inp, fontFamily: 'inherit' }} />
                      </Field>
                    </Row>
                  </Section>
                </>
              )}

              {step === 3 && (
                <>
                  <Row>
                    <Field label="Objet 1">
                      <select value={form.objet_1} onChange={(e) => setForm({ ...form, objet_1: e.target.value })} style={inp}>
                        <option value="">—</option>
                        {(referentiels.OBJET_VISITE || []).map((r) => <option key={r.id} value={r.libelle}>{r.libelle}</option>)}
                      </select>
                    </Field>
                    <Field label="Objet 2">
                      <select value={form.objet_2} onChange={(e) => setForm({ ...form, objet_2: e.target.value })} style={inp}>
                        <option value="">—</option>
                        {(referentiels.OBJET_VISITE || []).map((r) => <option key={r.id} value={r.libelle}>{r.libelle}</option>)}
                      </select>
                    </Field>
                  </Row>
                  <Row>
                    <Field label="Objet (texte libre / complément)" full>
                      <textarea rows={3} value={form.objet} onChange={(e) => setForm({ ...form, objet: e.target.value })} style={{ ...inp, fontFamily: 'inherit' }} />
                    </Field>
                  </Row>
                  <Row>
                    <Field label="Déroulement de l'entretien" full>
                      <textarea rows={6} value={form.deroulement} onChange={(e) => setForm({ ...form, deroulement: e.target.value })} style={{ ...inp, fontFamily: 'inherit' }} />
                    </Field>
                  </Row>
                </>
              )}

              {step === 4 && (
                <>
                  <Row>
                    <Field label="Produit financier">
                      <select value={form.produit_financier} onChange={(e) => setForm({ ...form, produit_financier: e.target.value })} style={inp}>
                        <option value="AUCUN">Aucun</option>
                        <option value="FCP_INVEST">FCP Invest</option>
                        <option value="FCP_RECORD">FCP Record</option>
                        <option value="AUTRE">Autre</option>
                      </select>
                    </Field>
                    <Field label="Abonnement">
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8 }}>
                        <input type="checkbox" checked={form.abonnement} onChange={(e) => setForm({ ...form, abonnement: e.target.checked })} />
                        Souscription par abonnement
                      </label>
                    </Field>
                    <Field label="Durée (mois)"><input type="number" value={form.duree_mois} onChange={(e) => setForm({ ...form, duree_mois: e.target.value })} style={inp} /></Field>
                  </Row>
                  <Row>
                    <Field label="Valeur liquidative"><input type="number" step="0.0001" value={form.valeur_liquidative} onChange={(e) => setForm({ ...form, valeur_liquidative: e.target.value })} style={inp} /></Field>
                    <Field label="Issue">
                      <select value={form.issue} onChange={(e) => setForm({ ...form, issue: e.target.value })} style={inp}>
                        <option value="AUCUNE">Aucune</option>
                        <option value="SOUSCRIPTION">Souscription</option>
                        <option value="RACHAT">Rachat</option>
                      </select>
                    </Field>
                  </Row>
                  <Row>
                    <Field label="Montant attendu"><input type="number" value={form.montant_attendu} onChange={(e) => setForm({ ...form, montant_attendu: e.target.value })} style={inp} /></Field>
                    <Field label="Montant souscrit"><input type="number" value={form.montant_souscrit} onChange={(e) => setForm({ ...form, montant_souscrit: e.target.value })} style={inp} /></Field>
                  </Row>
                  <Row>
                    <Field label="Montant abonnement"><input type="number" value={form.montant_abonnement} onChange={(e) => setForm({ ...form, montant_abonnement: e.target.value })} style={inp} /></Field>
                    <Field label="Montant rachat"><input type="number" value={form.montant_rachat} onChange={(e) => setForm({ ...form, montant_rachat: e.target.value })} style={inp} /></Field>
                  </Row>
                </>
              )}

              {step === 5 && (
                <>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        <th style={th}>Libellé *</th>
                        <th style={th}>Montant</th>
                        <th style={th}>Délai</th>
                        <th style={th}>Responsable</th>
                        <th style={th}>Statut</th>
                        <th style={th}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.plans.map((p, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f0f1f3' }}>
                          <td style={td}><input value={p.libelle} onChange={(e) => setPlan(i, 'libelle', e.target.value)} style={cellInp} /></td>
                          <td style={td}><input type="number" value={p.montant} onChange={(e) => setPlan(i, 'montant', e.target.value)} style={cellInp} /></td>
                          <td style={td}><input value={p.delai_execution} onChange={(e) => setPlan(i, 'delai_execution', e.target.value)} style={cellInp} placeholder="JJ/MM/AAAA" /></td>
                          <td style={td}><input value={p.responsable} onChange={(e) => setPlan(i, 'responsable', e.target.value)} style={cellInp} /></td>
                          <td style={td}>
                            <select value={p.statut} onChange={(e) => setPlan(i, 'statut', e.target.value)} style={cellInp}>
                              <option value="OUVERT">Ouvert</option>
                              <option value="FERME">Fermé</option>
                              <option value="EN_RETARD">En retard</option>
                            </select>
                          </td>
                          <td style={td}>
                            {form.plans.length > 1 && (
                              <button type="button" onClick={() => rmPlan(i)} style={{ ...iconBtn, color: BRAND_RED }}><Trash2 size={14} /></button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button type="button" onClick={addPlan} style={{ ...btnSecondary, marginTop: 10 }}><Plus size={14} /> Ajouter une action</button>
                </>
              )}
            </div>

            <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0f1f3', background: '#fafbfc' }}>
              <div>
                {step > 0 && <button type="button" onClick={() => setStep(step - 1)} style={btnSecondary}><ChevronLeft size={14} /> Précédent</button>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setShowForm(false)} style={btnSecondary}>Annuler</button>
                {step < STEPS.length - 1 ? (
                  <button type="button" onClick={() => setStep(step + 1)} style={btnPrimary}>Suivant <ChevronRight size={14} /></button>
                ) : (
                  <button type="submit" style={btnPrimary}>{editingId ? 'Mettre à jour' : 'Créer'}</button>
                )}
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

const inp = { width: '100%', padding: '8px 10px', border: '1px solid #d0d5dd', borderRadius: 6, fontSize: '0.92rem', boxSizing: 'border-box' }
const cellInp = { width: '100%', padding: '6px 8px', border: '1px solid #d0d5dd', borderRadius: 4, fontSize: '0.85rem', boxSizing: 'border-box' }
const btnPrimary = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: BRAND_NAVY, color: '#fff', border: 0, borderRadius: 6, cursor: 'pointer', fontWeight: 600 }
const btnSecondary = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: '#fff', color: BRAND_NAVY, border: `1px solid ${BRAND_NAVY}`, borderRadius: 6, cursor: 'pointer', fontWeight: 600 }
const iconBtn = { background: 'transparent', border: 0, padding: 6, cursor: 'pointer', color: '#555', marginLeft: 4 }
const th = { padding: '12px 14px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 600, color: '#475467', textTransform: 'uppercase', letterSpacing: '0.04em' }
const td = { padding: '10px 14px', color: '#1d2939' }
const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(2,22,46,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }
const modalDialog = { background: '#fff', borderRadius: 10, width: '100%', maxWidth: 1000, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }

function Tag({ children, color }) {
  return <span style={{ display: 'inline-block', padding: '3px 9px', background: `${color}15`, color, borderRadius: 4, fontSize: '0.78rem', fontWeight: 600 }}>{children}</span>
}
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: BRAND_NAVY, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, paddingBottom: 6, borderBottom: `2px solid ${BRAND_NAVY}15` }}>{title}</div>
      {children}
    </div>
  )
}
function Row({ children }) { return <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>{children}</div> }
function Field({ label, full, children }) {
  return (
    <div style={{ flex: full ? '1 1 100%' : '1 1 200px', minWidth: 160 }}>
      {label && <label style={{ display: 'block', fontSize: '0.78rem', color: '#475467', marginBottom: 4, fontWeight: 600 }}>{label}</label>}
      {children}
    </div>
  )
}
