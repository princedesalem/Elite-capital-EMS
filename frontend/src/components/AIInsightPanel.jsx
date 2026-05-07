import { useEffect, useState } from 'react'
import {
  ChevronDown, ChevronUp, Sparkles, RefreshCw, AlertTriangle,
  Target, TrendingUp, AlertCircle, FileText,
} from 'lucide-react'
import api from '../services/api'

const I18N = {
  fr: {
    title_default: 'Insights & Recommandations IA',
    synthese: 'Synthèse exécutive',
    kpis: 'Indicateurs clés',
    alerts: "Points d'attention",
    reco: 'Recommandations',
    narratif: 'Rapport narratif',
    loading: 'Analyse en cours…',
    error_default: "Impossible de charger les insights IA. Vérifiez que le service est disponible.",
    regenerate: 'Régénérer',
    generated: 'Généré',
    source_ollama: 'Mistral / Ollama',
    source_det: 'Moteur déterministe',
    no_alert: 'Aucune alerte majeure détectée.',
    priorite: { haute: 'PRIORITÉ HAUTE', moyenne: 'PRIORITÉ MOYENNE', basse: 'PRIORITÉ BASSE' },
    show_narratif: 'Voir le rapport narratif complet',
    hide_narratif: 'Masquer le rapport narratif',
  },
  en: {
    title_default: 'AI Insights & Recommendations',
    synthese: 'Executive summary',
    kpis: 'Key indicators',
    alerts: 'Points of attention',
    reco: 'Recommendations',
    narratif: 'Full narrative report',
    loading: 'Analysis in progress…',
    error_default: 'Unable to load AI insights. Please check that the service is available.',
    regenerate: 'Regenerate',
    generated: 'Generated',
    source_ollama: 'Mistral / Ollama',
    source_det: 'Deterministic engine',
    no_alert: 'No major alert detected.',
    priorite: { haute: 'HIGH PRIORITY', moyenne: 'MEDIUM PRIORITY', basse: 'LOW PRIORITY' },
    show_narratif: 'Show full narrative',
    hide_narratif: 'Hide full narrative',
  },
}

const PRIORITY_COLORS = {
  haute: { bg: '#fff7ed', border: '#f59e0b', text: '#78350f', accent: '#f59e0b' },
  moyenne: { bg: '#f8fafc', border: '#cbd5e1', text: '#334155', accent: '#64748b' },
  basse: { bg: '#f8fafc', border: '#cbd5e1', text: '#334155', accent: '#64748b' },
}

/**
 * AIInsightPanel — panneau IA pro, dépliable, contextuel.
 *
 * Props :
 *   page      'dashboard' | 'analytics' | 'score_comportemental'
 *   tab       onglet actif
 *   filters   { annee, mois, date_debut, date_fin, direction, entite, matricule }
 *   label     libellé du header
 *   lang      'fr' | 'en' (défaut fr)
 *   depth     'court' | 'moyen' | 'détaillé' (défaut détaillé)
 *   defaultOpen   ouvert par défaut
 *
 * Rétro-compat : si `endpoint` est passé sans `page`, utilise GET endpoint
 * et affiche la réponse texte legacy.
 */
export default function AIInsightPanel({
  page,
  tab,
  filters = {},
  label,
  lang = 'fr',
  depth = 'détaillé',
  defaultOpen = false,
  endpoint,
  params = {},
}) {
  const t = I18N[lang] || I18N.fr
  const [open, setOpen] = useState(defaultOpen)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [legacyText, setLegacyText] = useState('')
  const [error, setError] = useState(null)
  const [showNarr, setShowNarr] = useState(true)

  const filtersKey = JSON.stringify({ page, tab, filters, lang, depth })

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      if (endpoint && !page) {
        const query = new URLSearchParams(params).toString()
        const url = query ? `${endpoint}?${query}` : endpoint
        const res = await api.get(url)
        setLegacyText(res.data.text || res.data.summary || res.data.recommandations || '')
        setData({ generated_at: res.data.generated_at, source: 'deterministic', _legacy: true })
      } else {
        const res = await api.post('/api/ai/insights', { page, tab, filters, lang, depth })
        setData(res.data)
      }
    } catch (err) {
      setError(err?.response?.data?.detail || t.error_default)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey])

  const toggle = () => {
    if (!open && !data && !error) load()
    setOpen(v => !v)
  }

  const regenerate = (e) => {
    e.stopPropagation()
    setData(null); setLegacyText(''); setError(null)
    load()
  }

  const renderMd = (raw) => {
    if (!raw) return null
    return raw.split('\n').map((line, i) => {
      const html = line
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/^- (.*)$/g, '• $1')
      const empty = line.trim() === ''
      return empty
        ? <div key={i} style={{ height: 6 }} />
        : <p key={i} style={{ margin: '2px 0', lineHeight: 1.65 }} dangerouslySetInnerHTML={{ __html: html }} />
    })
  }

  return (
    <div style={{
      border: '1px solid #dbe2ea',
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 16,
      background: '#ffffff',
      boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
    }}>
      <div
        onClick={toggle}
        data-testid="ai-insight-header"
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 18px', cursor: 'pointer', userSelect: 'none',
          background: open ? '#f8fafc' : '#ffffff',
          transition: 'background 0.2s',
        }}
      >
        <Sparkles size={17} color="#0f172a" />
        <span style={{ fontWeight: 700, fontSize: 14, color: '#021630', flex: 1, letterSpacing: 0.2 }}>
          {label || t.title_default}
        </span>
        {data?.source && open && (
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 10,
            background: '#f1f5f9',
            border: '1px solid #dbe2ea',
            color: '#334155', fontWeight: 600,
          }}>
            {data.source === 'ollama' ? t.source_ollama : t.source_det}
          </span>
        )}
        {open && !loading && data && (
          <button
            onClick={regenerate}
            title={t.regenerate}
            data-testid="ai-insight-regenerate"
            style={{
              background: 'none', border: '1px solid rgba(2,22,48,0.2)',
              cursor: 'pointer', padding: '3px 9px', borderRadius: 7,
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 12, color: '#021630',
            }}
          >
            <RefreshCw size={12} />
            {t.regenerate}
          </button>
        )}
        {open ? <ChevronUp size={18} color="#021630" /> : <ChevronDown size={18} color="#021630" />}
      </div>

      {open && (
        <div style={{ padding: '14px 20px 18px', borderTop: '1px solid rgba(2,22,48,0.12)', background: 'white' }}>
          {loading && (
            <div data-testid="ai-insight-loading" style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#021630', fontSize: 13 }}>
              <div style={{
                width: 18, height: 18,
                border: '2px solid #021630', borderTopColor: 'transparent',
                borderRadius: '50%', animation: 'aispin 0.8s linear infinite',
              }} />
              {t.loading}
              <style>{`@keyframes aispin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {error && !loading && (
            <div data-testid="ai-insight-error" style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              color: '#a01a1a', fontSize: 13,
              background: '#fff0f0', border: '1px solid #ce2b2b',
              borderRadius: 8, padding: '10px 14px',
            }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          {legacyText && data?._legacy && !loading && (
            <div style={{ fontSize: 13, color: '#021630', lineHeight: 1.7 }}>
              {renderMd(legacyText)}
            </div>
          )}

          {data && !data._legacy && !loading && (
            <div data-testid="ai-insight-content">
              {data.narratif && (
                <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px dashed #cbd5e1' }}>
                  <button
                    onClick={() => setShowNarr(v => !v)}
                    data-testid="ai-insight-toggle-narratif"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#0f172a', fontSize: 12, fontWeight: 700,
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: 0,
                    }}
                  >
                    <FileText size={13} />
                    {showNarr ? t.hide_narratif : t.show_narratif}
                    {showNarr ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                  {showNarr && (
                    <div style={{
                      marginTop: 10, padding: 14,
                      background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
                      fontSize: 13, color: '#0f172a', lineHeight: 1.7,
                    }}>
                      {renderMd(data.narratif)}
                    </div>
                  )}
                </div>
              )}

              {data.synthese && (
                <Section icon={<FileText size={14} />} title={t.synthese}>
                  <p style={{ margin: 0, fontSize: 13, color: '#0f172a', lineHeight: 1.7, fontStyle: 'italic' }}>
                    {data.synthese}
                  </p>
                </Section>
              )}

              {data.kpis && data.kpis.length > 0 && (
                <Section icon={<TrendingUp size={14} />} title={t.kpis}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: 8,
                  }}>
                    {data.kpis.map((kpi, i) => (
                      <div
                        key={i}
                        data-testid="ai-insight-kpi"
                        style={{
                          padding: '8px 12px',
                          background: kpi.alert ? '#fff7ed' : '#f8fafc',
                          border: `1px solid ${kpi.alert ? '#f59e0b' : '#e2e8f0'}`,
                          borderLeft: `3px solid ${kpi.alert ? '#f59e0b' : '#94a3b8'}`,
                          borderRadius: 7,
                          fontSize: 12,
                        }}
                      >
                        <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                          {kpi.label}
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                          {kpi.value}
                          {kpi.trend && (
                            <span style={{ fontSize: 11, marginLeft: 6, color: '#64748b', fontWeight: 600 }}>
                              ({lang === 'en' ? 'Trend' : 'Tendance'}: {kpi.trend})
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {data.points_attention && data.points_attention.length > 0 && (
                <Section icon={<AlertCircle size={14} color="#f59e0b" />} title={t.alerts}>
                  <ul style={{ margin: 0, padding: '0 0 0 4px', listStyle: 'none' }}>
                    {data.points_attention.map((p, i) => (
                      <li
                        key={i}
                        data-testid="ai-insight-alert"
                        style={{
                          padding: '7px 12px', marginBottom: 5,
                          background: '#fff7ed', border: '1px solid #fed7aa',
                          borderLeft: '3px solid #f59e0b',
                          borderRadius: 6, fontSize: 13, color: '#78350f',
                          lineHeight: 1.5,
                        }}
                      >
                        {p}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {data.recommandations && data.recommandations.length > 0 && (
                <Section icon={<Target size={14} />} title={t.reco}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {data.recommandations.map((r, i) => {
                      const colors = PRIORITY_COLORS[r.priorite] || PRIORITY_COLORS.basse
                      return (
                        <div
                          key={i}
                          data-testid="ai-insight-reco"
                          style={{
                            padding: '9px 13px',
                            background: colors.bg,
                            border: `1px solid ${colors.border}`,
                            borderLeft: `4px solid ${colors.accent}`,
                            borderRadius: 7,
                          }}
                        >
                          <div style={{
                            fontSize: 10, fontWeight: 700,
                            color: colors.accent, letterSpacing: 0.6,
                            marginBottom: 3,
                          }}>
                            {(t.priorite[r.priorite] || t.priorite.basse)}
                          </div>
                          <div style={{ fontSize: 13, color: colors.text, lineHeight: 1.5, fontWeight: 500 }}>
                            {r.action}
                          </div>
                          {r.cible && (
                            <div style={{ fontSize: 11, color: colors.text, opacity: 0.75, marginTop: 3 }}>
                              → {r.cible}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </Section>
              )}

              {data.generated_at && (
                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 12, marginBottom: 0, textAlign: 'right' }}>
                  {t.generated} {new Date(data.generated_at).toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR')}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Section({ icon, title, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h4 style={{
        margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 12, fontWeight: 800, color: '#021630',
        textTransform: 'uppercase', letterSpacing: 0.6,
      }}>
        {icon}
        {title}
      </h4>
      {children}
    </div>
  )
}
