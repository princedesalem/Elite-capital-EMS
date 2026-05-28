import React, { useEffect, useState, useCallback } from 'react'
import api from '../../services/api'
import { BRAND_NAVY, BRAND_RED } from '../../theme'
import {
  BarChart2, Users, Briefcase, Phone,
  RefreshCw, AlertTriangle, CheckCircle, Info, Zap,
  Award, Target, Activity, Star
} from 'lucide-react'

const BRAND_GREEN  = '#1f7a3d'
const BRAND_GOLD   = '#c8860a'
const BRAND_PURPLE = '#6366f1'
const BRAND_TEAL   = '#0891b2'
const BRAND_PINK   = '#db2777'
const PALETTE = [BRAND_NAVY, BRAND_RED, BRAND_GREEN, BRAND_GOLD, BRAND_PURPLE, BRAND_TEAL, BRAND_PINK, '#7c3aed', '#059669', '#d97706', '#64748b', '#f59e0b']

export default function CommercialAnalytics() {
  const [data, setData]     = useState(null)
  const [loading, setLoad]  = useState(true)
  const [error, setError]   = useState('')
  const [activeTab, setTab] = useState('clients')

  const load = useCallback(async () => {
    setLoad(true); setError('')
    try {
      const r = await api.get('/api/commercial/analytics')
      setData(r.data)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Erreur de chargement')
    } finally { setLoad(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div style={{ padding: 60, textAlign: 'center', color: '#667085' }}>
      <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', color: BRAND_NAVY }} />
      <p style={{ marginTop: 16, fontSize: '1rem' }}>Analyse en cours...</p>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
  if (error) return <div style={{ padding: 32, color: BRAND_RED, fontWeight: 600 }}>{error}</div>
  if (!data)  return null

  const { clients, deals, memos, performance_equipe, recommandations_ia, resume_executif, genere_le, scope_level, scope_label } = data
  const isPersonal = scope_level === 'personnel'

  const fmt  = (n) => n == null ? '--' : Number(n).toLocaleString('fr-FR')
  const fmtK = (n) => {
    if (!n) return '0'
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'Mrd'
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M'
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K'
    return n.toLocaleString('fr-FR')
  }

  const TABS = [
    { id: 'clients',     label: 'Portefeuille',       icon: <Users size={14} /> },
    { id: 'pipeline',    label: 'Pipeline',            icon: <Briefcase size={14} /> },
    { id: 'activite',    label: 'Activité',            icon: <Phone size={14} /> },
    ...(!isPersonal ? [{ id: 'performance', label: 'Performance équipe', icon: <Award size={14} /> }] : []),
    { id: 'ia',          label: 'Recommandations IA',  icon: <Zap size={14} /> },
  ]

  const nbDanger = recommandations_ia.filter(r => r.niveau === 'danger').length

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ background: BRAND_NAVY, padding: '20px 28px', color: '#fff' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: BRAND_RED, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChart2 size={22} color="#fff" />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>Analytics & BI Commercial</h1>
                <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
                  Tableau de bord complet · IA · {new Date(genere_le).toLocaleString('fr-FR')}
                </p>
              <div style={{ marginTop:4 }}>
                <ScopeBadge level={scope_level} label={scope_label} />
              </div>
              </div>
            </div>
            <button onClick={load} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', background:'rgba(255,255,255,0.12)', color:'#fff', border:'1px solid rgba(255,255,255,0.25)', borderRadius:6, cursor:'pointer', fontWeight:600, fontSize:'0.85rem' }}>
              <RefreshCw size={14} /> Actualiser
            </button>
          </div>

          {/* KPI strip */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px,1fr))', gap:12, marginTop:20 }}>
            <MiniKpi label="Portefeuille"   value={fmt(clients.total)}              sub={`${clients.nb_clients} clients · ${clients.nb_prospects} prospects`} />
            <MiniKpi label="Conversion"     value={clients.taux_conversion + '%'}   sub="prospect -> client" />
            <MiniKpi label="Pipeline brut"  value={fmtK(deals.pipeline_brut)}       sub={'Pondéré : ' + fmtK(deals.pipeline_pondere)} />
            <MiniKpi label="Win rate"       value={deals.win_rate + '%'}            sub={`${deals.deals_gagnes} gagnés / ${deals.deals_fermes} clôturés`} />
            <MiniKpi label="FCP"            value={clients.taux_fcp + '%'}          sub={`${clients.nb_avec_fcp} clients FCP`} />
            <MiniKpi label="Call memos"     value={fmt(memos.total)}                sub={`Moy. ${memos.moy_3m}/mois`} />
          </div>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div style={{ background:'#fff', borderBottom:'1px solid #e5e7eb', position:'sticky', top:0, zIndex:10 }}>
        <div style={{ maxWidth:1400, margin:'0 auto', display:'flex', gap:0, overflowX:'auto' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'14px 22px', background:'none', border:'none', cursor:'pointer',
                fontWeight: activeTab === t.id ? 700 : 500,
                color: activeTab === t.id ? BRAND_NAVY : '#667085',
                borderBottom: activeTab === t.id ? `3px solid ${BRAND_NAVY}` : '3px solid transparent',
                fontSize:'0.88rem', whiteSpace:'nowrap', transition:'all 0.15s' }}>
              {t.icon}{t.label}
              {t.id === 'ia' && nbDanger > 0 && (
                <span style={{ background:BRAND_RED, color:'#fff', borderRadius:9, padding:'1px 6px', fontSize:'0.7rem', fontWeight:700 }}>
                  {nbDanger}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth:1400, margin:'0 auto', padding:'28px 24px' }}>

        {/* ── PORTEFEUILLE CLIENTS ──────────────────────────────────────── */}
        {activeTab === 'clients' && (
          <div>
            <SectionHeader icon={<Users size={16}/>} title="Portefeuille Clients" />

            <div style={{ background:'#fff', borderRadius:10, padding:'18px 22px', marginBottom:24, boxShadow:SHADOW, borderLeft:`4px solid ${BRAND_NAVY}` }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:12 }}>
                {Object.values(resume_executif).map((v, i) => (
                  <p key={i} style={{ margin:0, fontSize:'0.88rem', color:'#344054', lineHeight:1.6 }}>• {v}</p>
                ))}
              </div>
            </div>

            <div style={KPIGRID}>
              <KpiCard label="Total"           value={fmt(clients.total)}            color={BRAND_NAVY}   sub="portefeuille global" />
              <KpiCard label="Clients"         value={fmt(clients.nb_clients)}       color={BRAND_GREEN}  sub="confirmés" />
              <KpiCard label="Prospects"       value={fmt(clients.nb_prospects)}     color={BRAND_RED}    sub="en cours" />
              <KpiCard label="Taux conversion" value={clients.taux_conversion + '%'} color={BRAND_GOLD}   sub="prospect -> client" />
              <KpiCard label="Pénétration FCP" value={clients.taux_fcp + '%'}        color={BRAND_TEAL}   sub={`${clients.nb_avec_fcp} avec FCP`} />
              <KpiCard label="Inactifs +90j"   value={fmt(clients.nb_prospects_vieux_90j)} color={BRAND_PINK} sub="prospects à réactiver" />
            </div>

            <QualiteWidget qualite={clients.qualite} total={clients.total} />

            <div style={CHARTGRID2}>
              <BarChart title="Par pole"             data={clients.par_pole}          color={BRAND_NAVY} />
              <BarChart title="Par type de personne" data={clients.par_type_personne} color={BRAND_PURPLE} />
            </div>
            <div style={CHARTGRID2}>
              <BarChart title="Par secteur d'activité (top 12)" data={clients.par_secteur.slice(0,12)} color={BRAND_TEAL} />
              <BarChart title="Par pays (top 10)"                data={clients.par_pays}  color={BRAND_GREEN} />
            </div>
            <div style={CHARTGRID3}>
              <PieChart title="Type FCP"          data={clients.par_fcp} />
              <PieChart title="Forme juridique"   data={clients.par_forme_juridique.slice(0,6)} />
              <PieChart title="Capacite financiere" data={clients.par_capacite_financiere.slice(0,6)} />
            </div>
            <div style={CHARTGRID2}>
              {!isPersonal && <BarChart title="Par charge d'affaires (top 10)" data={clients.par_charge} color={BRAND_GOLD} />}
              <LineChart title="Evolution mensuelle - Nouveaux clients (12 mois)" data={clients.evolution_mensuelle} color={BRAND_NAVY} />
            </div>
            <div style={{ marginTop:20 }}>
              <LineChart title="Evolution FCP - Nouvelles entrees par mois (date_entree_fcp)" data={clients.fcp_evolution} color={BRAND_TEAL} />
            </div>
          </div>
        )}

        {/* ── PIPELINE COMMERCIAL ──────────────────────────────────────── */}
        {activeTab === 'pipeline' && (
          <div>
            <SectionHeader icon={<Briefcase size={16}/>} title="Pipeline Commercial" />

            <div style={KPIGRID}>
              <KpiCard label="Deals total"      value={fmt(deals.total)}            color={BRAND_NAVY} />
              <KpiCard label="Pipeline brut"    value={fmtK(deals.pipeline_brut)}  color={BRAND_PURPLE} sub="actif" />
              <KpiCard label="Pipeline pondéré" value={fmtK(deals.pipeline_pondere)} color={BRAND_TEAL} sub="par probabilité" />
              <KpiCard label="Confiance"        value={deals.confidence_rate + '%'} color={deals.confidence_rate >= 50 ? BRAND_GREEN : BRAND_GOLD} sub="pondéré / brut" />
              <KpiCard label="Montant gagne"    value={fmtK(deals.montant_gagne)}  color={BRAND_GREEN} />
              <KpiCard label="Montant perdu"    value={fmtK(deals.montant_perdu)}  color={BRAND_RED} />
              <KpiCard label="Win rate"         value={deals.win_rate + '%'}       color={deals.win_rate >= 40 ? BRAND_GREEN : BRAND_GOLD} sub={`${deals.deals_gagnes}/${deals.deals_fermes} clôturés`} />
              <KpiCard label="Cycle moyen"      value={deals.duree_moy_cycle ? deals.duree_moy_cycle + 'j' : '--'} color={BRAND_GOLD} sub="création -> clôture" />
            </div>

            {deals.deals_fort_potentiel && deals.deals_fort_potentiel.length > 0 && (
              <div style={{ background:'#fff', borderRadius:10, padding:'16px 20px', marginBottom:24, boxShadow:SHADOW, border:`1px solid ${BRAND_GREEN}30` }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                  <Target size={16} color={BRAND_GREEN} />
                  <span style={{ fontWeight:700, color:BRAND_GREEN, fontSize:'0.85rem', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                    Deals à fort potentiel (prob. &gt;= 70%) -- {deals.deals_fort_potentiel.length} opportunités
                  </span>
                </div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.88rem' }}>
                    <thead>
                      <tr style={{ background:'#f9fafb', borderBottom:'2px solid #e5e7eb' }}>
                        {['Opportunité','Client','Produit','Montant','Prob.'].map(h=><th key={h} style={TH}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {deals.deals_fort_potentiel.map((d,i)=>(
                        <tr key={i} style={{ borderBottom:'1px solid #f0f1f3' }}>
                          <td style={TD}><strong>{d.titre}</strong></td>
                          <td style={TD}>{d.client}</td>
                          <td style={TD}><Tag color={BRAND_TEAL}>{d.produit}</Tag></td>
                          <td style={TD}><strong style={{ color:BRAND_GREEN }}>{fmtK(d.montant)}</strong></td>
                          <td style={TD}><ProbaBadge v={d.probabilite} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={CHARTGRID2}>
              <PieChart title="Par statut"  data={deals.par_statut} />
              <PieChart title="Par source"  data={deals.par_source.slice(0,8)} />
            </div>
            <div style={CHARTGRID2}>
              <BarChart title="Par étape - montant pipeline" data={deals.par_stage.map(s=>({label:s.label,value:s.montant}))} color={BRAND_TEAL} valueFormatter={fmtK} />
              <BarChart title="Par étape - nb deals"         data={deals.par_stage} color={BRAND_PURPLE} />
            </div>
            <div style={CHARTGRID2}>
              <BarChart title="Par produit - montant"  data={deals.par_produit.map(p=>({label:p.label,value:p.montant}))} color={BRAND_GREEN} valueFormatter={fmtK} />
              <BarChart title="Par produit - nb deals" data={deals.par_produit} color={BRAND_NAVY} />
            </div>
            <div style={CHARTGRID2}>
              {!isPersonal && <BarChart title="Par charge d'affaires - deals" data={deals.par_charge} color={BRAND_GOLD} />}
              <BarChart title="Par devise - volume total" data={deals.par_devise} color={BRAND_PINK} valueFormatter={fmtK} />
            </div>
            <div style={CHARTGRID2}>
              <LineChart title="Evolution mensuelle - Nouveaux deals (12 mois)" data={deals.evolution_mensuelle} color={BRAND_PURPLE} />
              <LineChart title="Evolution mensuelle - Volume deals (12 mois)"   data={deals.evolution_mensuelle.map(x=>({...x,value:x.montant}))} color={BRAND_GREEN} valueFormatter={fmtK} />
            </div>

            {deals.top_deals.length > 0 && (
              <div style={{ background:'#fff', borderRadius:10, boxShadow:SHADOW, overflow:'auto', marginTop:24 }}>
                <div style={{ padding:'14px 20px', borderBottom:'1px solid #e5e7eb' }}>
                  <span style={SECTION_LABEL}>Top 10 opportunités par montant</span>
                </div>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.88rem' }}>
                  <thead>
                    <tr style={{ background:'#f9fafb', borderBottom:'2px solid #e5e7eb' }}>
                      {['#','Opportunité','Client','Produit','Montant','Devise','Prob.','Statut'].map(h=><th key={h} style={TH}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {deals.top_deals.map((d,i)=>(
                      <tr key={i} style={{ borderBottom:'1px solid #f0f1f3' }}>
                        <td style={TD}><strong style={{ color:BRAND_NAVY }}>{i+1}</strong></td>
                        <td style={TD}>{d.titre}</td>
                        <td style={TD}>{d.client}</td>
                        <td style={TD}><Tag color={BRAND_TEAL}>{d.produit}</Tag></td>
                        <td style={TD}><strong>{fmtK(d.montant)}</strong></td>
                        <td style={TD}>{d.devise}</td>
                        <td style={TD}><ProbaBadge v={d.probabilite} /></td>
                        <td style={TD}><StatusBadge statut={d.statut} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── ACTIVITÉ COMMERCIALE ─────────────────────────────────────── */}
        {activeTab === 'activite' && (
          <div>
            <SectionHeader icon={<Phone size={16}/>} title="Activité commerciale - Call Memos" />

            <div style={KPIGRID}>
              <KpiCard label="Total call memos" value={fmt(memos.total)}          color={BRAND_NAVY} />
              <KpiCard label="Physiques"        value={fmt(memos.nb_physique)}    color={BRAND_GREEN} sub="visites terrain" />
              <KpiCard label="Téléphoniques"    value={fmt(memos.nb_telephonique)} color={BRAND_TEAL} sub="appels" />
              <KpiCard label="Moy. 3 mois"     value={memos.moy_3m + '/mois'}    color={BRAND_GOLD} sub="derniers 3 mois" />
            </div>

            <div style={{ marginBottom:24 }}>
              <LineChart title="Evolution call memos - 12 mois" data={memos.par_mois} color={BRAND_PINK} />
            </div>
            <div style={CHARTGRID2}>
              <PieChart title="Type d'entretien"     data={memos.par_type_entretien} />
              <BarChart title="Par objet de visite"  data={memos.par_objet} color={BRAND_NAVY} />
            </div>
            <div style={CHARTGRID2}>
              <BarChart title="Par produit financier" data={memos.par_produit_financier} color={BRAND_PURPLE} />
              <BarChart title="Par issue / résultat"  data={memos.par_issue} color={BRAND_GREEN} />
            </div>
            {!isPersonal && (
              <div style={{ marginTop:20 }}>
                <BarChart title="Par gestionnaire (top 10)" data={memos.par_gestionnaire} color={BRAND_GOLD} />
              </div>
            )}
          </div>
        )}

        {/* ── PERFORMANCE ÉQUIPE ───────────────────────────────────────── */}
        {activeTab === 'performance' && (
          <div>
            <SectionHeader icon={<Award size={16}/>} title="Performance équipe" />

            {performance_equipe && performance_equipe.length > 0 ? (
              <div style={{ background:'#fff', borderRadius:10, boxShadow:SHADOW, overflow:'auto', marginBottom:28 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.88rem' }}>
                  <thead>
                    <tr style={{ background:BRAND_NAVY, color:'#fff' }}>
                      {['Rang','Charge d\'affaires','Clients/Prospects','Deals','Volume deals','Call Memos','Score'].map(h=>(
                        <th key={h} style={{ ...TH, color:'#fff', fontWeight:700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {performance_equipe.map((p,i)=>{
                      const top = performance_equipe[0]
                      const topScore = top ? top.nb_clients + top.nb_deals*2 + top.nb_memos : 1
                      const score = p.nb_clients + p.nb_deals*2 + p.nb_memos
                      return (
                        <tr key={i} style={{ borderBottom:'1px solid #f0f1f3', background: i===0 ? `${BRAND_GOLD}08` : 'transparent' }}>
                          <td style={{ ...TD, textAlign:'center' }}>
                            {i===0 ? <Star size={16} color={BRAND_GOLD} fill={BRAND_GOLD}/> : <span style={{ color:'#94a3b8', fontWeight:600 }}>#{i+1}</span>}
                          </td>
                          <td style={{ ...TD, fontWeight: i<3 ? 700 : 400, color: i<3 ? BRAND_NAVY : '#344054' }}>{p.label}</td>
                          <td style={TD}>{p.nb_clients}</td>
                          <td style={TD}>{p.nb_deals}</td>
                          <td style={TD}><strong style={{ color:BRAND_GREEN }}>{fmtK(p.montant_deals)}</strong></td>
                          <td style={TD}>{p.nb_memos}</td>
                          <td style={TD}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <div style={{ flex:1, height:6, background:'#e5e7eb', borderRadius:3 }}>
                                <div style={{ width:`${Math.min(100,(score/topScore)*100)}%`, height:'100%', background: i===0 ? BRAND_GOLD : BRAND_NAVY, borderRadius:3 }} />
                              </div>
                              <span style={{ fontSize:'0.78rem', color:'#667085', minWidth:24, textAlign:'right' }}>{score}</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState label="Aucune donnee de performance" />
            )}

            <div style={CHARTGRID2}>
              <BarChart title="Clients par charge"  data={clients.par_charge} color={BRAND_NAVY} />
              <BarChart title="Deals par charge"    data={deals.par_charge}   color={BRAND_PURPLE} />
            </div>
            <div style={CHARTGRID2}>
              <BarChart title="Volume deals par charge (montant)" data={deals.par_charge.map(x=>({label:x.label,value:x.montant}))} color={BRAND_GREEN} valueFormatter={fmtK} />
              <BarChart title="Call memos par gestionnaire"        data={memos.par_gestionnaire} color={BRAND_PINK} />
            </div>
          </div>
        )}

        {/* ── RECOMMANDATIONS IA ───────────────────────────────────────── */}
        {activeTab === 'ia' && (
          <div>
            <SectionHeader icon={<Zap size={16}/>} title="Recommandations IA - Analyse intelligente" />

            <div style={{ background:'#fff', borderRadius:10, padding:'16px 22px', marginBottom:28, boxShadow:SHADOW, borderLeft:`4px solid ${BRAND_PURPLE}` }}>
              <p style={{ margin:0, fontSize:'0.88rem', color:'#344054', lineHeight:1.7 }}>
                <strong style={{ color:BRAND_PURPLE }}>Analyse automatique</strong> -- Ces recommandations sont generees en temps reel a partir de vos donnees CRM.
                Elles identifient les risques, opportunites et axes d'amelioration pour optimiser votre performance commerciale.
              </p>
            </div>

            <ScoreCard recommandations={recommandations_ia} />

            {['danger','warning','info','success'].map(niveau=>{
              const recs = recommandations_ia.filter(r=>r.niveau===niveau)
              if (!recs.length) return null
              return (
                <div key={niveau} style={{ marginBottom:24 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                    <NiveauIcon niveau={niveau} size={18} />
                    <span style={{ fontWeight:700, fontSize:'0.9rem', color:niveauColor(niveau), textTransform:'uppercase', letterSpacing:'0.05em' }}>
                      {niveauLabel(niveau)} ({recs.length})
                    </span>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(340px,1fr))', gap:14 }}>
                    {recs.map((r,i)=><RecoCard key={i} reco={r} />)}
                  </div>
                </div>
              )
            })}

            {recommandations_ia.length === 0 && (
              <div style={{ background:'#fff', borderRadius:10, padding:40, textAlign:'center', color:'#667085', boxShadow:SHADOW }}>
                <CheckCircle size={40} color={BRAND_GREEN} style={{ marginBottom:12 }} />
                <p style={{ margin:0, fontWeight:600, color:BRAND_GREEN }}>Aucune alerte -- tout est en ordre !</p>
                <p style={{ margin:'8px 0 0', fontSize:'0.85rem' }}>Votre portefeuille commercial est bien gere. Continuez sur cette lancee.</p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

// ── Scope Badge ───────────────────────────────────────────────────────────────
const SCOPE_COLORS = {
  personnel:   { bg: '#fef3c7', color: '#b45309', border: '#fcd34d' },
  departement: { bg: '#eff6ff', color: '#1d4ed8', border: '#93c5fd' },
  direction:   { bg: '#f5f3ff', color: '#6d28d9', border: '#c4b5fd' },
  entite:      { bg: '#ecfdf5', color: '#065f46', border: '#6ee7b7' },
  global:      { bg: '#f0f9ff', color: '#0369a1', border: '#7dd3fc' },
}
function ScopeBadge({ level, label }) {
  const s = SCOPE_COLORS[level] || SCOPE_COLORS.global
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px',
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      borderRadius:5, fontSize:'0.74rem', fontWeight:700 }}>
      <Activity size={11} /> {label}
    </span>
  )
}

// ── Score Card ────────────────────────────────────────────────────────────────
function ScoreCard({ recommandations }) {
  const nbD = recommandations.filter(r=>r.niveau==='danger').length
  const nbW = recommandations.filter(r=>r.niveau==='warning').length
  const nbI = recommandations.filter(r=>r.niveau==='info').length
  const nbS = recommandations.filter(r=>r.niveau==='success').length
  const score = Math.max(0, 100 - nbD*20 - nbW*8 + nbS*5)
  const scoreColor = score >= 75 ? BRAND_GREEN : score >= 50 ? BRAND_GOLD : BRAND_RED
  return (
    <div style={{ background:'#fff', borderRadius:10, padding:'20px 24px', marginBottom:28, boxShadow:SHADOW }}>
      <div style={{ display:'flex', alignItems:'center', gap:32, flexWrap:'wrap' }}>
        <div style={{ textAlign:'center', minWidth:100 }}>
          <div style={{ fontSize:'3rem', fontWeight:900, color:scoreColor, lineHeight:1 }}>{score}</div>
          <div style={{ fontSize:'0.78rem', color:'#667085', marginTop:4 }}>Score sante /100</div>
        </div>
        <div style={{ flex:1, minWidth:200 }}>
          <div style={{ height:12, background:'#e5e7eb', borderRadius:6, overflow:'hidden', marginBottom:8 }}>
            <div style={{ width:`${score}%`, height:'100%', background:scoreColor, borderRadius:6, transition:'width 0.8s ease' }} />
          </div>
          <div style={{ display:'flex', gap:16, flexWrap:'wrap', fontSize:'0.82rem' }}>
            {nbD>0 && <span style={{ color:BRAND_RED,   fontWeight:600 }}>&#128683; {nbD} critique(s)</span>}
            {nbW>0 && <span style={{ color:BRAND_GOLD,  fontWeight:600 }}>&#9888; {nbW} avertissement(s)</span>}
            {nbI>0 && <span style={{ color:BRAND_TEAL,  fontWeight:600 }}>&#8505; {nbI} information(s)</span>}
            {nbS>0 && <span style={{ color:BRAND_GREEN, fontWeight:600 }}>&#10003; {nbS} point(s) fort(s)</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Reco Card ─────────────────────────────────────────────────────────────────
function RecoCard({ reco }) {
  const color = niveauColor(reco.niveau)
  return (
    <div style={{ background:'#fff', borderRadius:10, padding:'16px 18px', boxShadow:SHADOW, borderLeft:`4px solid ${color}`, display:'flex', flexDirection:'column', gap:8 }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
        <NiveauIcon niveau={reco.niveau} size={16} />
        <div>
          <div style={{ fontSize:'0.75rem', color:'#94a3b8', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{reco.categorie}</div>
          <div style={{ fontWeight:700, color:'#1d2939', fontSize:'0.92rem', lineHeight:1.4, marginTop:2 }}>{reco.titre}</div>
        </div>
      </div>
      <p style={{ margin:0, fontSize:'0.85rem', color:'#475467', lineHeight:1.6 }}>{reco.detail}</p>
    </div>
  )
}

// ── Qualite donnees Widget ────────────────────────────────────────────────────
function QualiteWidget({ qualite, total }) {
  if (!qualite || !total) return null
  const items = [
    { label:'Sans email',     value:qualite.sans_email,     icon:'Email' },
    { label:'Sans telephone', value:qualite.sans_telephone, icon:'Tel' },
    { label:'Sans contact',   value:qualite.sans_contact,   icon:'Contact' },
    { label:'Sans secteur',   value:qualite.sans_secteur,   icon:'Secteur' },
    { label:'Sans pole',      value:qualite.sans_pole,      icon:'Pole' },
    { label:'Sans charge',    value:qualite.sans_charge,    icon:'Charge' },
  ]
  return (
    <div style={{ background:'#fff', borderRadius:10, padding:'18px 22px', marginBottom:24, boxShadow:SHADOW }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
        <Activity size={16} color={BRAND_NAVY} />
        <span style={SECTION_LABEL}>Qualite des donnees</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12 }}>
        {items.map(it=>{
          const pct  = total>0 ? Math.round(it.value/total*100) : 0
          const col  = pct>40 ? BRAND_RED : pct>15 ? BRAND_GOLD : BRAND_GREEN
          return (
            <div key={it.label} style={{ padding:'12px 14px', background:'#f9fafb', borderRadius:8, borderLeft:`3px solid ${col}` }}>
              <div style={{ fontSize:'0.75rem', color:'#667085', marginBottom:4 }}>{it.icon} {it.label}</div>
              <div style={{ fontWeight:700, fontSize:'1.3rem', color:col }}>{it.value}</div>
              <div style={{ fontSize:'0.72rem', color:'#94a3b8' }}>{pct}% du portefeuille</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, color, sub }) {
  return (
    <div style={{ background:'#fff', borderRadius:8, padding:'16px 20px', boxShadow:SHADOW, borderLeft:`4px solid ${color}` }}>
      <div style={{ fontSize:'0.72rem', color:'#667085', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:700 }}>{label}</div>
      <div style={{ fontSize:'1.8rem', fontWeight:800, color, marginTop:4, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:'0.73rem', color:'#94a3b8', marginTop:4 }}>{sub}</div>}
    </div>
  )
}

// ── Mini KPI (header strip) ───────────────────────────────────────────────────
function MiniKpi({ label, value, sub }) {
  return (
    <div style={{ padding:'10px 16px', background:'rgba(255,255,255,0.1)', borderRadius:8 }}>
      <div style={{ fontSize:'0.7rem', color:'#94a3b8', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
      <div style={{ fontSize:'1.4rem', fontWeight:800, color:'#fff', lineHeight:1.1 }}>{value}</div>
      {sub && <div style={{ fontSize:'0.7rem', color:'#64748b', marginTop:2 }}>{sub}</div>}
    </div>
  )
}

// ── Bar Chart (horizontal, SVG) ───────────────────────────────────────────────
function BarChart({ title, data, color=BRAND_NAVY, valueFormatter=(v)=>v.toLocaleString('fr-FR'), suffix='' }) {
  if (!data || !data.length) return <ChartEmpty title={title} />
  const valid = data.filter(d=>(d.value||0)>0)
  if (!valid.length) return <ChartEmpty title={title} />
  const maxVal = Math.max(...valid.map(d=>d.value||0), 1)
  const barH=22, gap=5, padL=155
  const svgH = valid.length*(barH+gap)
  return (
    <div style={CHART_CARD}>
      <ChartTitle>{title}</ChartTitle>
      <div style={{ overflowX:'auto' }}>
        <svg width="100%" viewBox={`0 0 500 ${Math.max(svgH,40)}`} style={{ display:'block' }}>
          {valid.map((d,i)=>{
            const w = Math.max(3, ((d.value||0)/maxVal)*(500-padL-70))
            const y = i*(barH+gap)
            return (
              <g key={i}>
                <text x={padL-6} y={y+barH/2+4} textAnchor="end" style={{ fontSize:11, fill:'#475467' }}>
                  {(d.label||'--').length>23 ? (d.label||'--').slice(0,22)+'...' : (d.label||'--')}
                </text>
                <rect x={padL} y={y} width={w} height={barH} rx={3} fill={color} fillOpacity={0.85} />
                <text x={padL+w+5} y={y+barH/2+4} style={{ fontSize:11, fill:'#344054', fontWeight:600 }}>
                  {valueFormatter(d.value||0)}{suffix}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

// ── Pie / Donut Chart (SVG) ───────────────────────────────────────────────────
function PieChart({ title, data }) {
  if (!data || !data.length) return <ChartEmpty title={title} />
  const valid = data.filter(d=>(d.value||0)>0)
  if (!valid.length) return <ChartEmpty title={title} />
  const total = valid.reduce((s,d)=>s+(d.value||0), 0)
  const cx=90, cy=90, r=70, ri=42
  let angle = -Math.PI/2
  const slices = valid.map((d,i)=>{
    const sweep = ((d.value||0)/total)*2*Math.PI
    const x1=cx+r*Math.cos(angle), y1=cy+r*Math.sin(angle)
    angle += sweep
    const x2=cx+r*Math.cos(angle), y2=cy+r*Math.sin(angle)
    const xi1=cx+ri*Math.cos(angle-sweep), yi1=cy+ri*Math.sin(angle-sweep)
    const xi2=cx+ri*Math.cos(angle), yi2=cy+ri*Math.sin(angle)
    const large = sweep>Math.PI ? 1 : 0
    return {
      d:`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${ri} ${ri} 0 ${large} 0 ${xi1} ${yi1} Z`,
      color:PALETTE[i%PALETTE.length], label:d.label, value:d.value,
      pct: Math.round((d.value/total)*100)
    }
  })
  return (
    <div style={CHART_CARD}>
      <ChartTitle>{title}</ChartTitle>
      <div style={{ display:'flex', gap:12, alignItems:'flex-start', flexWrap:'wrap' }}>
        <svg width={180} height={180} viewBox="0 0 180 180" style={{ flexShrink:0 }}>
          {slices.map((s,i)=><path key={i} d={s.d} fill={s.color} />)}
          <text x={cx} y={cy-5} textAnchor="middle" style={{ fontSize:11, fill:'#344054', fontWeight:700 }}>
            {total.toLocaleString('fr-FR')}
          </text>
          <text x={cx} y={cy+12} textAnchor="middle" style={{ fontSize:9, fill:'#94a3b8' }}>total</text>
        </svg>
        <div style={{ flex:1, minWidth:120 }}>
          {slices.map((s,i)=>(
            <div key={i} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
              <div style={{ width:10, height:10, borderRadius:2, background:s.color, flexShrink:0 }} />
              <span style={{ fontSize:11, color:'#475467', flex:1 }}>
                {s.label.length>20 ? s.label.slice(0,19)+'...' : s.label}
              </span>
              <span style={{ fontSize:11, fontWeight:700, color:'#1d2939' }}>{s.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Line Chart (SVG) ──────────────────────────────────────────────────────────
function LineChart({ title, data, color=BRAND_NAVY, valueFormatter=(v)=>v.toLocaleString('fr-FR') }) {
  if (!data || !data.length) return <ChartEmpty title={title} />
  const W=500, H=140, padL=50, padR=20, padT=16, padB=30
  const maxVal = Math.max(...data.map(d=>d.value||0), 1)
  const pts = data.map((d,i)=>({
    x: padL + (i/(data.length-1||1))*(W-padL-padR),
    y: padT + (1-(d.value||0)/maxVal)*(H-padT-padB),
    val: d.value||0, label: d.label
  }))
  const polyline = pts.map(p=>`${p.x},${p.y}`).join(' ')
  const area = `M ${pts[0].x},${H-padB} ` + pts.map(p=>`L ${p.x},${p.y}`).join(' ') + ` L ${pts[pts.length-1].x},${H-padB} Z`
  return (
    <div style={CHART_CARD}>
      <ChartTitle>{title}</ChartTitle>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display:'block' }}>
        <path d={area} fill={color} fillOpacity={0.08} />
        <polyline points={polyline} fill="none" stroke={color} strokeWidth={2} />
        {pts.map((p,i)=>(
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3} fill={color} />
            <text x={p.x} y={H-padB+14} textAnchor="middle" style={{ fontSize:9, fill:'#94a3b8' }}>{p.label}</text>
            {p.val>0 && <text x={p.x} y={p.y-6} textAnchor="middle" style={{ fontSize:9, fill:color, fontWeight:700 }}>{valueFormatter(p.val)}</text>}
          </g>
        ))}
        <text x={padL-4} y={padT+4} textAnchor="end" style={{ fontSize:9, fill:'#94a3b8' }}>{valueFormatter(maxVal)}</text>
        <text x={padL-4} y={H-padB} textAnchor="end" style={{ fontSize:9, fill:'#94a3b8' }}>0</text>
      </svg>
    </div>
  )
}

// ── Helpers UI ────────────────────────────────────────────────────────────────
function SectionHeader({ icon, title }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20, paddingBottom:10, borderBottom:`2px solid ${BRAND_NAVY}25` }}>
      <span style={{ color:BRAND_NAVY }}>{icon}</span>
      <h2 style={{ margin:0, fontSize:'1rem', fontWeight:800, color:BRAND_NAVY, textTransform:'uppercase', letterSpacing:'0.06em' }}>{title}</h2>
    </div>
  )
}
function ChartTitle({ children }) {
  return <div style={{ fontSize:'0.79rem', fontWeight:700, color:BRAND_NAVY, marginBottom:12, textTransform:'uppercase', letterSpacing:'0.05em' }}>{children}</div>
}
function ChartEmpty({ title }) {
  return (
    <div style={CHART_CARD}>
      <ChartTitle>{title}</ChartTitle>
      <div style={{ color:'#d1d5db', fontSize:'0.82rem', padding:'24px 0', textAlign:'center' }}>Aucune donnee</div>
    </div>
  )
}
function EmptyState({ label }) {
  return (
    <div style={{ background:'#fff', borderRadius:10, padding:48, textAlign:'center', color:'#94a3b8', boxShadow:SHADOW }}>
      <BarChart2 size={36} style={{ marginBottom:12, opacity:0.3 }} />
      <p style={{ margin:0 }}>{label}</p>
    </div>
  )
}
function StatusBadge({ statut }) {
  const map = { GAGNE:BRAND_GREEN, PERDU:BRAND_RED, EN_COURS:BRAND_PURPLE, QUALIF:BRAND_GOLD }
  const c = map[statut] || '#667085'
  return <span style={{ padding:'2px 9px', background:`${c}15`, color:c, borderRadius:4, fontSize:'0.72rem', fontWeight:700, whiteSpace:'nowrap' }}>{statut}</span>
}
function ProbaBadge({ v }) {
  const c = v>=70 ? BRAND_GREEN : v>=40 ? BRAND_GOLD : BRAND_RED
  return <span style={{ padding:'2px 9px', background:`${c}15`, color:c, borderRadius:4, fontSize:'0.78rem', fontWeight:700 }}>{v}%</span>
}
function Tag({ color, children }) {
  return <span style={{ padding:'2px 8px', background:`${color}12`, color, borderRadius:4, fontSize:'0.75rem', fontWeight:600, whiteSpace:'nowrap' }}>{children}</span>
}
function NiveauIcon({ niveau, size=16 }) {
  if (niveau==='danger')  return <AlertTriangle size={size} color={BRAND_RED} />
  if (niveau==='warning') return <AlertTriangle size={size} color={BRAND_GOLD} />
  if (niveau==='success') return <CheckCircle   size={size} color={BRAND_GREEN} />
  return <Info size={size} color={BRAND_TEAL} />
}
function niveauColor(n) {
  return n==='danger' ? BRAND_RED : n==='warning' ? BRAND_GOLD : n==='success' ? BRAND_GREEN : BRAND_TEAL
}
function niveauLabel(n) {
  return n==='danger' ? 'Points critiques' : n==='warning' ? 'Avertissements' : n==='success' ? 'Points forts' : 'Informations & Opportunites'
}

// ── Styles ────────────────────────────────────────────────────────────────────
const SHADOW       = '0 1px 4px rgba(0,0,0,0.08)'
const CHART_CARD   = { background:'#fff', borderRadius:10, padding:'16px 20px', boxShadow:SHADOW }
const SECTION_LABEL = { fontSize:'0.82rem', fontWeight:700, color:BRAND_NAVY, textTransform:'uppercase', letterSpacing:'0.05em' }
const KPIGRID      = { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:14, marginBottom:24 }
const CHARTGRID2   = { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(340px,1fr))', gap:18, marginBottom:20 }
const CHARTGRID3   = { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:18, marginBottom:20 }
const TH = { padding:'10px 14px', textAlign:'left', fontSize:'0.73rem', fontWeight:600, color:'#475467', textTransform:'uppercase', letterSpacing:'0.04em' }
const TD = { padding:'10px 14px', color:'#1d2939', fontSize:'0.87rem' }
