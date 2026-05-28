import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { toast } from '../components/ui/bridge'
import QuizPlayer from '../components/QuizPlayer'

/* =============================================================================
   AcademyCourse — Page de lecture d'une formation (theme CLAIR professionnel).
   Charte : navy #021630 / rouge accent #ce2b2b / blanc / gris #f7f8fb
============================================================================= */

const C = {
  navy: '#021630',
  navyDeep: '#0b2456',
  accent: '#ce2b2b',
  white: '#ffffff',
  bg: '#f7f8fb',
  card: '#ffffff',
  line: '#e2e8f0',
  ink: '#0f172a',
  inkSoft: '#475569',
  soft: '#f1f5f9',
}

/* ── Icones SVG (style Lucide, monochrome, sans emojis) ──────────────────── */
const Icon = {
  back: (p) => (
    <svg viewBox="0 0 24 24" width={p.s||18} height={p.s||18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
  ),
  play: (p) => (
    <svg viewBox="0 0 24 24" width={p.s||18} height={p.s||18} fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
  ),
  doc: (p) => (
    <svg viewBox="0 0 24 24" width={p.s||18} height={p.s||18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6"/><path d="M9 17h6"/></svg>
  ),
  text: (p) => (
    <svg viewBox="0 0 24 24" width={p.s||18} height={p.s||18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16"/><path d="M4 12h10"/><path d="M4 17h16"/></svg>
  ),
  quiz: (p) => (
    <svg viewBox="0 0 24 24" width={p.s||18} height={p.s||18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  ),
  slides: (p) => (
    <svg viewBox="0 0 24 24" width={p.s||18} height={p.s||18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="18" x2="12" y2="21"/></svg>
  ),
  check: (p) => (
    <svg viewBox="0 0 24 24" width={p.s||18} height={p.s||18} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
  ),
  certificate: (p) => (
    <svg viewBox="0 0 24 24" width={p.s||18} height={p.s||18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
  ),
  chevron: (p) => (
    <svg viewBox="0 0 24 24" width={p.s||14} height={p.s||14} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
  ),
  menu: (p) => (
    <svg viewBox="0 0 24 24" width={p.s||18} height={p.s||18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
  ),
  download: (p) => (
    <svg viewBox="0 0 24 24" width={p.s||18} height={p.s||18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
  ),
}

const TYPE_ICON = {
  video: Icon.play,
  pdf: Icon.doc,
  texte: Icon.text,
  quiz: Icon.quiz,
  presentation: Icon.slides,
}

/* ── Sous-composants viewers ─────────────────────────────────────────────── */
function VideoPlayer({ url }) {
  if (!url) return <Empty text="Aucune vidéo disponible" />
  const isYouTube = /youtube\.com|youtu\.be/.test(url)
  if (isYouTube) {
    const id = url.match(/(?:v=|youtu\.be\/)([\w-]+)/)?.[1]
    if (id) return (
      <iframe title="video" width="100%" height="480" style={{ border: 0, borderRadius: 12, background: '#000' }}
        src={`https://www.youtube.com/embed/${id}`} allowFullScreen />
    )
  }
  return (
    <video controls style={{ width: '100%', maxHeight: 540, borderRadius: 12, background: '#000' }}>
      <source src={url} />
    </video>
  )
}

function PdfViewer({ url }) {
  if (!url) return <Empty text="Aucun document disponible" />
  return (
    <iframe title="pdf" src={url} style={{ width: '100%', height: 640, border: `1px solid ${C.line}`, borderRadius: 12, background: C.white }} />
  )
}

function RichText({ html }) {
  if (!html) return <Empty text="Contenu non renseigné" />
  return (
    <div
      style={{ fontSize: '1rem', lineHeight: 1.75, color: C.ink }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function Empty({ text }) {
  return (
    <div style={{
      padding: '48px 24px', background: C.soft, borderRadius: 12,
      textAlign: 'center', color: C.inkSoft, fontStyle: 'italic',
    }}>{text}</div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
export default function AcademyCourse() {
  const { formationId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const matricule = user?.matricule

  const [formation, setFormation] = useState(null)
  const [inscription, setInscription] = useState(null)
  const [activeLeconId, setActiveLeconId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState([])
  const [showCertModal, setShowCertModal] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  /* Chargement formation */
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const url = matricule
        ? `/api/academy/formations/${formationId}?employe_id=${matricule}`
        : `/api/academy/formations/${formationId}`
      const r = await api.get(url)
      setFormation(r.data)
      setInscription(r.data.inscription || null)
      // 1ere lecon : seulement si pas encore selectionnee
      setActiveLeconId(prev => {
        if (prev) return prev
        const flat = []
        ;(r.data.modules || []).forEach(m => (m.lecons || []).forEach(l => flat.push(l)))
        return flat[0]?.id || null
      })
    } catch (e) {
      toast.error("Impossible de charger la formation")
    } finally {
      setLoading(false)
    }
  }, [formationId, matricule])

  useEffect(() => { load() }, [load])

  /* S'inscrire manuellement */
  const [enrolling, setEnrolling] = useState(false)
  const handleEnroll = useCallback(async () => {
    if (!matricule || enrolling) return
    setEnrolling(true)
    try {
      await api.post(`/api/academy/inscriptions/${formationId}?employe_id=${matricule}`)
      await load()
      toast.success('Inscription confirmée — bonne formation !')
    } catch {
      toast.error("Impossible de s'inscrire")
    } finally {
      setEnrolling(false)
    }
  }, [matricule, formationId, enrolling, load])

  /* Charger les questions au switch sur leçon quiz */
  useEffect(() => {
    if (!activeLeconId || !formation) return
    const lecon = findLecon(formation, activeLeconId)
    if (lecon?.type === 'quiz' && matricule) {
      api.get(`/api/academy/lecons/${activeLeconId}/questions?employe_id=${matricule}&nb=5`)
        .then(r => setQuestions(r.data || []))
        .catch(() => setQuestions([]))
    } else {
      setQuestions([])
    }
  }, [activeLeconId, formation, matricule])

  const flatLecons = useMemo(() => {
    if (!formation) return []
    const out = []
    ;(formation.modules || []).forEach(m => (m.lecons || []).forEach(l => out.push({ ...l, module: m })))
    return out
  }, [formation])

  const lecon = useMemo(() => flatLecons.find(l => l.id === activeLeconId), [flatLecons, activeLeconId])

  const progress = useMemo(() => {
    if (!flatLecons.length) return 0
    const done = (inscription?.lecons_terminees || []).length
    return Math.round(done / flatLecons.length * 100)
  }, [flatLecons, inscription])

  const isLastLecon = useMemo(() => {
    if (!lecon || !flatLecons.length) return false
    return flatLecons[flatLecons.length - 1]?.id === lecon.id
  }, [lecon, flatLecons])

  /* Marquer leçon terminée */
  const handleComplete = useCallback(async (score = null) => {
    if (!inscription) return
    try {
      await api.post('/api/academy/progression', {
        inscription_id: inscription.id,
        lecon_id: activeLeconId,
        termine: true,
        score: score,
      })
      await load()
      // Auto avance
      const idx = flatLecons.findIndex(l => l.id === activeLeconId)
      if (idx < flatLecons.length - 1) {
        setActiveLeconId(flatLecons[idx + 1].id)
      } else {
        // Formation terminée → propose certificat
        setShowCertModal(true)
      }
    } catch {
      toast.error('Erreur lors de la mise à jour')
    }
  }, [inscription, activeLeconId, flatLecons, load])

  /* Téléchargement certificat */
  const downloadCert = async () => {
    if (!inscription) return
    try {
      const res = await api.post(
        `/api/academy/certificat/${inscription.id}`,
        {},
        { responseType: 'blob' },
      )
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `certificat-${formation.titre.replace(/\s+/g, '_')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Certificat téléchargé')
    } catch (e) {
      toast.error("Échec du téléchargement (terminez d'abord la formation)")
    }
  }

  if (loading) {
    return <div style={{ padding: 40, color: C.inkSoft, fontFamily: "'Century Gothic',sans-serif" }}>Chargement…</div>
  }
  if (!formation) return null

  const isQuiz = lecon?.type === 'quiz'
  const leconDone = (inscription?.lecons_terminees || []).includes(activeLeconId)
  const formationDone = inscription?.statut === 'termine' || progress === 100

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, color: C.ink,
      fontFamily: "'Century Gothic',CenturyGothic,'Apple Gothic',sans-serif",
    }}>
      {/* ── Bande top navy ─────────────────────────────── */}
      <div style={{
        background: C.navy, color: C.white, padding: '18px 28px',
        display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 50,
        boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
      }}>
        <button
          onClick={() => setSidebarOpen(s => !s)}
          style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: 8, borderRadius: 8, cursor: 'pointer', display: 'inline-flex' }}
          title="Plan de la formation"
        ><Icon.menu /></button>
        <button
          onClick={() => navigate('/rh/academy')}
          style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}
        ><Icon.back s={14} /> Académie</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.1em', opacity: 0.7 }}>
            {formation.categorie}
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {formation.titre}
          </div>
        </div>
        <div style={{ minWidth: 200 }}>
          <div style={{ fontSize: '.7rem', opacity: 0.7, marginBottom: 4 }}>
            Progression {progress}%
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.18)', borderRadius: 99 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: C.accent, borderRadius: 99, transition: 'width .3s' }} />
          </div>
        </div>
        {!inscription && (
          <button
            onClick={handleEnroll}
            disabled={enrolling}
            style={{
              background: '#16a34a', color: '#fff', border: 'none', padding: '10px 18px',
              borderRadius: 8, fontWeight: 700, cursor: enrolling ? 'wait' : 'pointer',
              fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8,
              opacity: enrolling ? 0.7 : 1,
            }}
          >{enrolling ? 'Inscription…' : "S'inscrire"}</button>
        )}
        {formationDone && (
          <button
            onClick={downloadCert}
            style={{
              background: C.accent, color: '#fff', border: 'none', padding: '10px 18px',
              borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}
          ><Icon.certificate /> Mon certificat</button>
        )}
      </div>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 70px)' }}>
        {/* ── Sidebar plan ─────────────────────────────── */}
        {sidebarOpen && (
          <aside style={{
            width: 320, flexShrink: 0, background: C.white, borderRight: `1px solid ${C.line}`,
            padding: '20px 0', overflowY: 'auto', maxHeight: 'calc(100vh - 70px)',
          }}>
            <div style={{ padding: '0 20px 16px', borderBottom: `1px solid ${C.line}` }}>
              <div style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.1em', color: C.inkSoft, fontWeight: 700 }}>
                Plan de la formation
              </div>
              <div style={{ marginTop: 6, fontSize: '.85rem', color: C.inkSoft }}>
                {flatLecons.length} leçons · {formation.duree_estimee_h || '—'}h
              </div>
            </div>
            <div style={{ padding: '8px 0' }}>
              {(formation.modules || []).map(m => (
                <div key={m.id} style={{ marginBottom: 4 }}>
                  <div style={{
                    padding: '12px 20px 6px', fontSize: '.72rem', textTransform: 'uppercase',
                    letterSpacing: '.08em', color: C.navy, fontWeight: 700,
                  }}>
                    {m.titre}
                  </div>
                  {(m.lecons || []).map(l => {
                    const isActive = l.id === activeLeconId
                    const isDone = (inscription?.lecons_terminees || []).includes(l.id)
                    const IconComp = TYPE_ICON[l.type] || Icon.text
                    return (
                      <button
                        key={l.id}
                        onClick={() => setActiveLeconId(l.id)}
                        style={{
                          width: '100%', textAlign: 'left', padding: '10px 20px',
                          background: isActive ? `${C.navy}0d` : 'transparent',
                          borderTop: 'none', borderRight: 'none', borderBottom: 'none',
                          borderLeft: `3px solid ${isActive ? C.accent : 'transparent'}`,
                          cursor: 'pointer', display: 'flex',
                          alignItems: 'center', gap: 10, color: isActive ? C.navy : C.ink,
                          fontWeight: isActive ? 700 : 500, fontFamily: 'inherit',
                          fontSize: '.88rem',
                        }}
                      >
                        <span style={{
                          width: 26, height: 26, borderRadius: 6,
                          background: isDone ? '#dcfce7' : C.soft,
                          color: isDone ? '#15803d' : C.inkSoft,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          {isDone ? <Icon.check s={14} /> : <IconComp s={14} />}
                        </span>
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {l.titre}
                        </span>
                        {l.duree_min ? (
                          <span style={{ fontSize: '.7rem', color: C.inkSoft }}>{l.duree_min}min</span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* ── Contenu principal ────────────────────────── */}
        <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', maxHeight: 'calc(100vh - 70px)' }}>
          {lecon ? (
            <>
              {/* Breadcrumb */}
              <div style={{ fontSize: '.78rem', color: C.inkSoft, marginBottom: 14 }}>
                {lecon.module?.titre} <Icon.chevron s={10} /> <span style={{ color: C.ink, fontWeight: 600 }}>{lecon.titre}</span>
              </div>

              {/* Titre + métadonnées */}
              <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: C.navy, margin: '0 0 14px' }}>
                {lecon.titre}
              </h1>
              <div style={{ display: 'flex', gap: 16, fontSize: '.82rem', color: C.inkSoft, marginBottom: 28 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {(TYPE_ICON[lecon.type] || Icon.text)({ s: 15 })}
                  {lecon.type}
                </span>
                {lecon.duree_min ? <span>· {lecon.duree_min} min</span> : null}
                {leconDone && <span style={{ color: '#15803d', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon.check s={14} /> Terminée</span>}
              </div>

              {/* Lecteur */}
              <div style={{
                background: C.white, border: `1px solid ${C.line}`, borderRadius: 14,
                padding: 24, boxShadow: '0 1px 4px rgba(2,22,48,0.04)',
              }}>
                {lecon.type === 'video' && <VideoPlayer url={lecon.contenu} />}
                {lecon.type === 'pdf' && <PdfViewer url={lecon.contenu} />}
                {lecon.type === 'texte' && <RichText html={lecon.contenu} />}
                {lecon.type === 'presentation' && <RichText html={lecon.contenu} />}
                {lecon.type === 'quiz' && (
                  <QuizPlayer
                    key={activeLeconId}
                    questions={questions}
                    inscriptionId={inscription?.id}
                    leconId={activeLeconId}
                    onComplete={(s) => handleComplete(s)}
                  />
                )}
              </div>

              {/* Banner S'inscrire (non-enrôlé) */}
              {!inscription && (
                <div style={{
                  marginTop: 20, padding: '14px 20px',
                  background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                }}>
                  <div style={{ fontSize: '.9rem', color: '#92400e' }}>
                    <strong>Vous consultez cette formation en mode aperçu.</strong><br />
                    <span>Inscrivez-vous pour suivre votre progression et obtenir votre certificat.</span>
                  </div>
                  <button
                    onClick={handleEnroll}
                    disabled={enrolling}
                    style={{
                      background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8,
                      padding: '10px 18px', fontWeight: 700, cursor: enrolling ? 'wait' : 'pointer',
                      fontFamily: 'inherit', whiteSpace: 'nowrap', opacity: enrolling ? 0.7 : 1,
                    }}
                  >{enrolling ? 'Inscription…' : "S'inscrire"}</button>
                </div>
              )}

              {/* Boutons */}
              {lecon.type !== 'quiz' && inscription && (
                <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <button
                    onClick={() => handleComplete()}
                    disabled={leconDone}
                    style={{
                      padding: '11px 22px',
                      background: leconDone ? C.soft : C.accent,
                      color: leconDone ? C.inkSoft : '#fff',
                      border: 'none', borderRadius: 8, fontWeight: 700,
                      cursor: leconDone ? 'default' : 'pointer',
                      fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    {leconDone ? <><Icon.check s={15} /> Leçon validée</> : (isLastLecon ? 'Terminer la formation' : 'Marquer comme terminée')}
                  </button>
                </div>
              )}
            </>
          ) : (
            <Empty text="Sélectionnez une leçon pour commencer" />
          )}
        </main>
      </div>

      {/* ── Modal certificat ─────────────────────────────── */}
      {showCertModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(2,22,48,0.55)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{
            background: C.white, borderRadius: 16, padding: 36, maxWidth: 520, width: '100%',
            textAlign: 'center', fontFamily: 'inherit',
          }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%', background: '#fef3c7',
              color: '#b45309', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 18,
            }}>
              <Icon.certificate s={42} />
            </div>
            <h2 style={{ color: C.navy, margin: '0 0 10px', fontSize: '1.5rem' }}>Formation terminée !</h2>
            <p style={{ color: C.inkSoft, lineHeight: 1.6, margin: '0 0 24px' }}>
              Bravo, vous avez complété <strong>{formation.titre}</strong>.<br />
              Téléchargez votre certificat officiel Elite Capital Group.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => setShowCertModal(false)}
                style={{ padding: '11px 18px', background: C.soft, color: C.ink, border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >Plus tard</button>
              <button
                onClick={() => { downloadCert(); setShowCertModal(false) }}
                style={{ padding: '11px 22px', background: C.accent, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              ><Icon.download s={16} /> Télécharger</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function findLecon(formation, leconId) {
  for (const m of (formation.modules || [])) {
    for (const l of (m.lecons || [])) if (l.id === leconId) return l
  }
  return null
}
