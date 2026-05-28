import React, { useEffect, useState, useCallback } from 'react'
import api from '../../services/api'
import { TrendingUp, Target, Users, FileText, Award, BarChart3 } from 'lucide-react'
import { BRAND_GRADIENT, BRAND_NAVY, BRAND_RED } from '../../theme'

export default function Performance() {
  const now = new Date()
  const [annee, setAnnee] = useState(now.getFullYear())
  const [summary, setSummary] = useState(null)
  const [funnel, setFunnel] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [objectifs, setObjectifs] = useState([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const params = { annee }
      const [s, f, l, o] = await Promise.all([
        api.get('/api/commercial/kpis/summary', { params }),
        api.get('/api/commercial/kpis/funnel', { params }),
        api.get('/api/commercial/kpis/leaderboard', { params }),
        api.get('/api/commercial/kpis/objectifs', { params }),
      ])
      setSummary(s.data); setFunnel(f.data || []); setLeaderboard(l.data || []); setObjectifs(o.data || [])
    } catch (e) { setError(e?.response?.data?.detail || 'Erreur de chargement') }
  }, [annee])
  useEffect(() => { load() }, [load])

  const maxFunnel = Math.max(1, ...funnel.map((s) => s.nb_deals || 0))

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: BRAND_NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BarChart3 size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: BRAND_NAVY }}>Gestion des performances</h1>
            <p style={{ margin: '2px 0 0', color: '#667085', fontSize: '0.85rem' }}>KPIs commerciaux — pipeline, conversion, classement</p>
          </div>
        </div>
        <select value={annee} onChange={(e) => setAnnee(Number(e.target.value))}
          style={{ padding: '7px 12px', border: '1px solid #d0d5dd', borderRadius: 6, fontSize: '0.88rem', cursor: 'pointer' }}>
          {[0, 1, 2].map((d) => <option key={d} value={now.getFullYear() - d}>{now.getFullYear() - d}</option>)}
        </select>
      </div>

      <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
        {error && <div style={{ padding: '10px 14px', background: '#fee', color: '#9a1010', borderRadius: 6, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
          <Kpi icon={<TrendingUp size={20} />} label="Deals ouverts" value={summary?.nb_deals_ouverts ?? 0} color={BRAND_NAVY} />
          <Kpi icon={<Award size={20} />} label="Deals gagnés" value={summary?.nb_deals_gagnes ?? 0} color="#1f7a3d" />
          <Kpi icon={<TrendingUp size={20} />} label="Pipeline (XOF)" value={(summary?.montant_pipeline || 0).toLocaleString('fr-FR')} color={BRAND_NAVY} />
          <Kpi icon={<Award size={20} />} label="Gagné (XOF)" value={(summary?.montant_gagne || 0).toLocaleString('fr-FR')} color="#1f7a3d" />
          <Kpi icon={<Target size={20} />} label="Taux conversion" value={`${(summary?.taux_conversion || 0).toFixed(1)}%`} color={BRAND_RED} />
          <Kpi icon={<FileText size={20} />} label="Call Memos" value={summary?.nb_call_memos ?? 0} color={BRAND_NAVY} />
          <Kpi icon={<Users size={20} />} label="Actions" value={summary?.nb_actions ?? 0} color={BRAND_NAVY} />
          <Kpi icon={<TrendingUp size={20} />} label="Cycle moy. (j)" value={(summary?.temps_moyen_cycle_jours || 0).toFixed(1)} color={BRAND_NAVY} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20, marginBottom: 24 }}>
          <Card title="Funnel de conversion">
            {funnel.length === 0 ? (
              <div style={{ color: '#888', textAlign: 'center', padding: 20 }}>Aucune donnée</div>
            ) : (
              funnel.map((s) => (
                <div key={s.stage_id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: BRAND_NAVY }}>{s.libelle}</span>
                    <span style={{ color: '#475467' }}>{s.nb_deals} · {(s.montant_total || 0).toLocaleString('fr-FR')} XOF</span>
                  </div>
                  <div style={{ background: '#f0f1f3', borderRadius: 4, height: 10, overflow: 'hidden' }}>
                    <div style={{ width: `${(s.nb_deals / maxFunnel) * 100}%`, background: BRAND_GRADIENT, height: '100%' }} />
                  </div>
                </div>
              ))
            )}
          </Card>

          <Card title="Classement chargés">
            <table style={{ width: '100%', fontSize: '0.88rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={tdHead}>#</th>
                  <th style={tdHead}>Chargé</th>
                  <th style={{ ...tdHead, textAlign: 'right' }}>Gagné (XOF)</th>
                  <th style={{ ...tdHead, textAlign: 'right' }}>Deals</th>
                  <th style={{ ...tdHead, textAlign: 'right' }}>Memos</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.length === 0 && <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#888' }}>—</td></tr>}
                {leaderboard.map((e, i) => (
                  <tr key={e.matricule} style={{ borderBottom: '1px solid #f0f1f3' }}>
                    <td style={td}>{i + 1}</td>
                    <td style={td}>{e.nom || e.matricule}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{(e.montant_gagne || 0).toLocaleString('fr-FR')}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{e.nb_deals_gagnes}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{e.nb_call_memos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <Card title="Objectifs vs réalisations">
          <table style={{ width: '100%', fontSize: '0.88rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={tdHead}>Chargé</th>
                <th style={{ ...tdHead, textAlign: 'right' }}>Obj. deals</th>
                <th style={{ ...tdHead, textAlign: 'right' }}>Réal. deals</th>
                <th style={{ ...tdHead, textAlign: 'right' }}>Obj. montant</th>
                <th style={{ ...tdHead, textAlign: 'right' }}>Réal. montant</th>
                <th style={{ ...tdHead, textAlign: 'right' }}>Taux</th>
              </tr>
            </thead>
            <tbody>
              {objectifs.length === 0 && <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#888' }}>Aucun objectif défini</td></tr>}
              {objectifs.map((o) => {
                const tm = o.taux_montant || 0
                const tColor = tm >= 100 ? '#1f7a3d' : tm >= 50 ? '#c47a1d' : BRAND_RED
                return (
                  <tr key={o.charge_matricule + '-' + (o.mois || 'Y')} style={{ borderBottom: '1px solid #f0f1f3' }}>
                    <td style={td}>{o.nom || o.charge_matricule}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{o.nb_deals_objectif}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{o.nb_deals_realises}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{(o.montant_objectif || 0).toLocaleString('fr-FR')}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{(o.montant_realise || 0).toLocaleString('fr-FR')}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: tColor }}>{tm.toFixed(0)}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}

const td = { padding: '10px 12px', color: '#1d2939' }
const tdHead = { padding: '10px 12px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 600, color: '#475467', textTransform: 'uppercase', letterSpacing: '0.04em' }

function Kpi({ icon, label, value, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: 16, borderLeft: `4px solid ${color}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ color, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: '0.78rem', color: '#667085', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color, marginTop: 4 }}>{value}</div>
    </div>
  )
}
function Card({ title, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <h3 style={{ margin: '0 0 14px', fontSize: '1rem', fontWeight: 700, color: BRAND_NAVY }}>{title}</h3>
      {children}
    </div>
  )
}
