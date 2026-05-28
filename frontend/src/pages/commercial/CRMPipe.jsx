import React, { useEffect, useState, useCallback } from 'react'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { Plus, X, ArrowRight, TrendingUp } from 'lucide-react'
import { BRAND_GRADIENT, BRAND_NAVY, BRAND_RED } from '../../theme'

const READONLY = ['DG', 'PCA', 'AG', 'ADMIN']
const emptyDeal = {
  titre: '',
  client_id: '',
  stage_id: '',
  montant_estime: '',
  devise: 'XOF',
  probabilite: 50,
  date_cloture_prevue: '',
  source: '',
  produit: '',
  description: '',
  charge_matricule: '',
}

export default function CRMPipe() {
  const { user } = useAuth()
  const role = String(user?.role || '').toUpperCase()
  const isReadOnly = READONLY.includes(role)
  const [stages, setStages] = useState([])
  const [deals, setDeals] = useState([])
  const [clients, setClients] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyDeal)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [s, d, c] = await Promise.all([
        api.get('/api/commercial/stages'),
        api.get('/api/commercial/deals'),
        api.get('/api/commercial/clients'),
      ])
      setStages((s.data || []).sort((a, b) => (a.ordre || 0) - (b.ordre || 0)))
      setDeals(d.data || [])
      setClients(c.data || [])
    } catch (e) { setError(e?.response?.data?.detail || 'Erreur de chargement') }
  }, [])

  useEffect(() => { load() }, [load])

  function open() {
    setForm({ ...emptyDeal, charge_matricule: String(user?.matricule || '') })
    setShowForm(true)
    setError('')
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    try {
      const payload = {
        ...form,
        client_id: form.client_id ? Number(form.client_id) : null,
        stage_id: Number(form.stage_id),
        montant_estime: form.montant_estime ? Number(form.montant_estime) : null,
        probabilite: form.probabilite === '' ? null : Number(form.probabilite),
        date_cloture_prevue: form.date_cloture_prevue || null,
      }
      await api.post('/api/commercial/deals', payload)
      setShowForm(false); setForm(emptyDeal); load()
    } catch (err) { setError(err?.response?.data?.detail || 'Erreur') }
  }

  async function moveTo(dealId, stageId) {
    try { await api.patch(`/api/commercial/deals/${dealId}`, { stage_id: stageId }); load() }
    catch (e) { setError(e?.response?.data?.detail || 'Erreur') }
  }

  const dealsByStage = (sid) => deals.filter((d) => d.stage_id === sid && d.statut === 'OUVERT')

  const totalPipeline = deals.filter((d) => d.statut === 'OUVERT').reduce((s, d) => s + Number(d.montant_estime || 0), 0)
  const nbOpen = deals.filter((d) => d.statut === 'OUVERT').length

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: BRAND_NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <TrendingUp size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: BRAND_NAVY }}>Pipe commercial</h1>
            <p style={{ margin: '2px 0 0', color: '#667085', fontSize: '0.85rem' }}>Vue Kanban des opportunités par étape</p>
          </div>
        </div>
        {!isReadOnly && (
          <button onClick={open} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: BRAND_NAVY, color: '#fff', border: 0, padding: '9px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }}>
            <Plus size={15} /> Nouveau deal
          </button>
        )}
      </div>

      <div style={{ padding: 24, maxWidth: 1500, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
          <KpiCard label="Deals ouverts" value={nbOpen} color={BRAND_NAVY} />
          <KpiCard label="Pipeline (XOF)" value={totalPipeline.toLocaleString('fr-FR')} color="#1f7a3d" />
          <KpiCard label="Étapes" value={stages.length} color={BRAND_RED} />
        </div>

        {error && <div style={{ padding: '10px 14px', background: '#fee', color: '#9a1010', borderRadius: 6, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 16 }}>
          {stages.map((s) => {
            const ds = dealsByStage(s.id)
            const total = ds.reduce((sum, d) => sum + Number(d.montant_estime || 0), 0)
            const stageColor = s.est_gagne ? '#1f7a3d' : s.est_perdu ? BRAND_RED : BRAND_NAVY
            return (
              <div key={s.id} style={{ minWidth: 290, flex: '0 0 290px', background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 14px', borderTop: `4px solid ${stageColor}`, borderBottom: '1px solid #f0f1f3' }}>
                  <div style={{ fontWeight: 700, color: BRAND_NAVY, fontSize: '0.95rem' }}>{s.libelle}</div>
                  <div style={{ fontSize: '0.75rem', color: '#667085', marginTop: 2 }}>
                    {ds.length} deal(s) — {total.toLocaleString('fr-FR')} XOF
                  </div>
                </div>
                <div style={{ padding: 10, minHeight: 100 }}>
                  {ds.map((d) => (
                    <div key={d.id} style={{ background: '#f9fafb', padding: 10, borderRadius: 6, marginBottom: 8, borderLeft: `3px solid ${stageColor}` }}>
                      <div style={{ fontWeight: 600, color: BRAND_NAVY, fontSize: '0.9rem' }}>{d.titre}</div>
                      <div style={{ fontSize: '0.78rem', color: '#475467', marginTop: 2 }}>{d.client_nom || '—'}</div>
                      <div style={{ fontSize: '0.78rem', marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 600 }}>{d.montant_estime ? Number(d.montant_estime).toLocaleString('fr-FR') + ' XOF' : '—'}</span>
                        <span style={{ color: '#667085' }}>{d.probabilite ?? 0}%</span>
                      </div>
                      {!isReadOnly && (
                        <div style={{ marginTop: 8 }}>
                          <select value={d.stage_id} onChange={(e) => moveTo(d.id, Number(e.target.value))} style={{ width: '100%', padding: '4px 6px', fontSize: '0.78rem', border: '1px solid #d0d5dd', borderRadius: 4 }}>
                            {stages.map((s2) => <option key={s2.id} value={s2.id}>{s2.libelle}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  ))}
                  {ds.length === 0 && <div style={{ fontSize: '0.8rem', color: '#999', textAlign: 'center', padding: 14 }}>—</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,22,46,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <form onSubmit={submit} style={{ background: '#fff', borderRadius: 10, width: '100%', maxWidth: 560, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: BRAND_NAVY }}>Nouveau deal</h2>
              <button type="button" onClick={() => setShowForm(false)} style={{ background: 'transparent', border: 0, color: '#667085', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ padding: 20, display: 'grid', gap: 10 }}>
              <Field label="Titre *"><input required value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} style={inp} /></Field>
              <Field label="Client">
                <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} style={inp}>
                  <option value="">—</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.raison_sociale}</option>)}
                </select>
              </Field>
              <Field label="Étape *">
                <select required value={form.stage_id} onChange={(e) => setForm({ ...form, stage_id: e.target.value })} style={inp}>
                  <option value="">—</option>
                  {stages.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}
                </select>
              </Field>
              <div style={{ display: 'flex', gap: 10 }}>
                <Field label="Montant estimé (XOF)" full><input type="number" value={form.montant_estime} onChange={(e) => setForm({ ...form, montant_estime: e.target.value })} style={inp} /></Field>
                <Field label="Probabilité (%)" full><input type="number" min="0" max="100" value={form.probabilite} onChange={(e) => setForm({ ...form, probabilite: e.target.value })} style={inp} /></Field>
              </div>
              <Field label="Date clôture prévue"><input type="date" value={form.date_cloture_prevue} onChange={(e) => setForm({ ...form, date_cloture_prevue: e.target.value })} style={inp} /></Field>
              <Field label="Description"><textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ ...inp, fontFamily: 'inherit' }} /></Field>
              <Field label="Chargé d'affaire (matricule) *"><input required value={form.charge_matricule} onChange={(e) => setForm({ ...form, charge_matricule: e.target.value })} style={inp} /></Field>
              {error && <div style={{ color: '#9a1010', fontSize: '0.85rem' }}>{error}</div>}
            </div>
            <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #f0f1f3' }}>
              <button type="button" onClick={() => setShowForm(false)} style={btnSecondary}>Annuler</button>
              <button type="submit" style={btnPrimary}>Créer</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

const inp = { width: '100%', padding: '8px 10px', border: '1px solid #d0d5dd', borderRadius: 6, fontSize: '0.92rem', boxSizing: 'border-box' }
const btnPrimary = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: BRAND_NAVY, color: '#fff', border: 0, borderRadius: 6, cursor: 'pointer', fontWeight: 600 }
const btnSecondary = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: '#fff', color: BRAND_NAVY, border: `1px solid ${BRAND_NAVY}`, borderRadius: 6, cursor: 'pointer', fontWeight: 600 }

function KpiCard({ label, value, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: '0.78rem', color: '#667085', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color, marginTop: 4 }}>{value}</div>
    </div>
  )
}
function Field({ label, full, children }) {
  return (
    <div style={{ flex: full ? '1 1 0' : 'auto' }}>
      <label style={{ display: 'block', fontSize: '0.78rem', color: '#475467', marginBottom: 4, fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  )
}
