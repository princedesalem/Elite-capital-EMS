import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { toast } from '../components/ui/bridge'

/* ── Styles ────────────────────────────────────────────────────────────────── */
const page = {
  minHeight: '100vh',
  background: '#f1f5f9',
  color: '#0f172a',
  fontFamily: "'Segoe UI', system-ui, sans-serif",
  padding: '24px 20px',
}

const card = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
}

const btn = (variant = 'default') => ({
  padding: '8px 18px', borderRadius: 8,
  fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
  background: variant === 'primary' ? '#2563eb' : variant === 'danger' ? '#fee2e2' : '#f8fafc',
  color: variant === 'primary' ? '#fff' : variant === 'danger' ? '#b91c1c' : '#334155',
  border: variant === 'danger' ? '1px solid #fecaca' : '1px solid #e2e8f0',
})

const inputStyle = {
  width: '100%', padding: '8px 12px', boxSizing: 'border-box',
  background: '#fff', border: '1px solid #cbd5e1',
  borderRadius: 8, color: '#0f172a', fontSize: '0.85rem',
}

const TYPE_ICONS = { video: 'Vidéo', pdf: 'PDF', texte: 'Texte', quiz: 'Quiz', presentation: 'Slides' }
const NIVEAUX = ['Débutant', 'Intermédiaire', 'Avancé']
const TYPE_LECONS = ['video', 'pdf', 'texte', 'quiz', 'presentation']

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      {children}
    </div>
  )
}

/* ── Formation Edit Form ─────────────────────────────────────────────────── */
function FormationForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || {
    titre: '', description: '', categorie: '', niveau: 'Débutant',
    duree_estimee_h: 0, image_url: '', est_publie: false, est_onboarding: false,
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div style={{ ...card, padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Titre">
          <input style={inputStyle} value={form.titre} onChange={e => set('titre', e.target.value)} placeholder="Titre de la formation" />
        </Field>
        <Field label="Catégorie">
          <input style={inputStyle} value={form.categorie || ''} onChange={e => set('categorie', e.target.value)} placeholder="RH, Technique, etc." />
        </Field>
      </div>
      <Field label="Description">
        <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={form.description || ''} onChange={e => set('description', e.target.value)} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field label="Niveau">
          <select style={inputStyle} value={form.niveau} onChange={e => set('niveau', e.target.value)}>
            {NIVEAUX.map(n => <option key={n}>{n}</option>)}
          </select>
        </Field>
        <Field label="Durée estimée (h)">
          <input type="number" style={inputStyle} value={form.duree_estimee_h} onChange={e => set('duree_estimee_h', +e.target.value)} min={0} />
        </Field>
        <Field label="Image URL (optionnel)">
          <input style={inputStyle} value={form.image_url || ''} onChange={e => set('image_url', e.target.value)} placeholder="https://..." />
        </Field>
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', fontSize: '0.85rem' }}>
          <input type="checkbox" checked={!!form.est_publie} onChange={e => set('est_publie', e.target.checked)} />
          <span style={{ color: '#334155' }}>Publié</span>
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', fontSize: '0.85rem' }}>
          <input type="checkbox" checked={!!form.est_onboarding} onChange={e => set('est_onboarding', e.target.checked)} />
          <span style={{ color: '#334155' }}>Formation onboarding</span>
        </label>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button style={btn('primary')} onClick={() => onSave(form)}>Enregistrer</button>
        {onCancel && <button style={btn()} onClick={onCancel}>Annuler</button>}
      </div>
    </div>
  )
}

/* ── Question Builder ────────────────────────────────────────────────────── */
function QuestionBuilder({ leconId, onClose }) {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [newQ, setNewQ] = useState({ question: '', options: ['', '', '', ''], bonne_reponse: 0, explication: '' })

  const fetchQ = async () => {
    try {
      const res = await api.get(`/api/academy/lecons/${leconId}/questions`)
      setQuestions(Array.isArray(res.data) ? res.data : [])
    } catch { setQuestions([]) }
    setLoading(false)
  }

  useEffect(() => { fetchQ() }, [leconId])

  const addQuestion = async () => {
    if (!newQ.question.trim()) return
    try {
      await api.post(`/api/academy/lecons/${leconId}/questions`, newQ)
      setNewQ({ question: '', options: ['', '', '', ''], bonne_reponse: 0, explication: '' })
      fetchQ()
      toast.success('Question ajoutée')
    } catch { toast.error('Erreur ajout question') }
  }

  const deleteQ = async (qid) => {
    try { await api.delete(`/api/academy/questions/${qid}`); fetchQ() }
    catch { toast.error('Erreur suppression') }
  }

  return (
    <div style={{ ...card, padding: 16, marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Questions du quiz</div>
        <button style={btn()} onClick={onClose}>Fermer</button>
      </div>
      {loading ? <div style={{ color: 'rgba(200,215,240,0.4)', fontSize: '0.8rem' }}>Chargement…</div> : null}
      {questions.map((q, i) => (
        <div key={q.id} style={{ marginBottom: 10, padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ flex: 1, fontSize: '0.83rem', color: 'rgba(200,215,240,0.8)' }}>
              <strong style={{ color: '#e8edf5' }}>Q{i + 1}.</strong> {q.question}
            </div>
            <button onClick={() => deleteQ(q.id)} style={{ ...btn('danger'), padding: '3px 8px', fontSize: '0.75rem' }}>Supprimer</button>
          </div>
          {q.options?.map((opt, oi) => (
            <div key={oi} style={{ fontSize: '0.78rem', color: oi === q.bonne_reponse ? '#34d399' : 'rgba(200,215,240,0.4)', paddingLeft: 12, marginTop: 2 }}>
              {oi === q.bonne_reponse ? 'OK ' : '   '}{String.fromCharCode(65 + oi)}. {opt}
            </div>
          ))}
        </div>
      ))}
      {/* Nouvelle question */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 12, marginTop: 4 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(200,215,240,0.4)', marginBottom: 8, textTransform: 'uppercase' }}>Nouvelle question</div>
        <Field label="Question">
          <input style={inputStyle} value={newQ.question} onChange={e => setNewQ(q => ({ ...q, question: e.target.value }))} />
        </Field>
        {newQ.options.map((opt, oi) => (
          <div key={oi} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
            <input
              type="radio"
              name={`correct_${leconId}`}
              checked={newQ.bonne_reponse === oi}
              onChange={() => setNewQ(q => ({ ...q, bonne_reponse: oi }))}
              title="Bonne réponse"
            />
            <input
              style={{ ...inputStyle, flex: 1 }}
              placeholder={`Option ${String.fromCharCode(65 + oi)}`}
              value={opt}
              onChange={e => setNewQ(q => { const o = [...q.options]; o[oi] = e.target.value; return { ...q, options: o } })}
            />
          </div>
        ))}
        <Field label="Explication (optionnel)">
          <input style={inputStyle} value={newQ.explication || ''} onChange={e => setNewQ(q => ({ ...q, explication: e.target.value }))} />
        </Field>
        <button style={btn('primary')} onClick={addQuestion}>+ Ajouter la question</button>
      </div>
    </div>
  )
}

/* ── Leçon Row ───────────────────────────────────────────────────────────── */
function LeconRow({ lecon, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(lecon)
  const [showQ, setShowQ] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  const saveEdit = async () => {
    try {
      await api.put(`/api/academy/lecons/${lecon.id}`, form)
      onUpdate && onUpdate()
      setEditing(false)
      toast.success('Leçon mise à jour')
    } catch { toast.error('Erreur mise à jour') }
  }

  const handleUpload = async (file) => {
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await api.post('/api/academy/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setForm(f => ({ ...f, contenu: res.data.url }))
      toast.success('Fichier uploadé')
    } catch { toast.error("Erreur d'upload") }
    finally { setUploading(false) }
  }

  return (
    <div style={{ marginLeft: 16, marginBottom: 6, padding: '8px 12px', background: 'rgba(255,255,255,0.025)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
      {!editing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.8rem' }}>{TYPE_ICONS[lecon.type]}</span>
          <span style={{ flex: 1, fontSize: '0.83rem', color: 'rgba(200,215,240,0.75)' }}>{lecon.titre}</span>
          <span style={{ fontSize: '0.72rem', color: 'rgba(200,215,240,0.3)' }}>{lecon.type}</span>
          {lecon.type === 'quiz' && (
            <button style={{ ...btn(), fontSize: '0.72rem', padding: '3px 8px' }} onClick={() => setShowQ(s => !s)}>Questions</button>
          )}
          <button style={{ ...btn(), fontSize: '0.72rem', padding: '3px 8px' }} onClick={() => setEditing(true)}>Éditer</button>
          <button style={{ ...btn('danger'), fontSize: '0.72rem', padding: '3px 8px' }} onClick={() => onDelete(lecon.id)}>Supprimer</button>
        </div>
      ) : (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 8 }}>
            <input style={inputStyle} value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} placeholder="Titre" />
            <select style={{ ...inputStyle, width: 'auto' }} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {TYPE_LECONS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          {form.type !== 'quiz' && (
            <div style={{ marginBottom: 8 }}>
              <input style={{ ...inputStyle, marginBottom: 4 }} value={form.contenu || ''} onChange={e => setForm(f => ({ ...f, contenu: e.target.value }))} placeholder={form.type === 'video' ? 'URL YouTube/Vimeo ou lien direct' : form.type === 'pdf' ? 'URL du PDF' : 'Contenu texte ou JSON slides'} />
              {(form.type === 'pdf') && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="file" ref={fileRef} style={{ display: 'none' }} accept=".pdf,image/*" onChange={e => handleUpload(e.target.files[0])} />
                  <button style={{ ...btn(), fontSize: '0.75rem', padding: '4px 10px' }} onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? 'Upload…' : 'Importer un fichier'}
                  </button>
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btn('primary')} onClick={saveEdit}>Enregistrer</button>
            <button style={btn()} onClick={() => setEditing(false)}>Annuler</button>
          </div>
        </div>
      )}
      {showQ && <QuestionBuilder leconId={lecon.id} onClose={() => setShowQ(false)} />}
    </div>
  )
}

/* ── Module Section ──────────────────────────────────────────────────────── */
function ModuleSection({ module, onRefresh }) {
  const [collapsed, setCollapsed] = useState(false)
  const [addingLecon, setAddingLecon] = useState(false)
  const [newLecon, setNewLecon] = useState({ titre: '', type: 'texte', contenu: '', ordre: 0 })
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(module.titre)

  const saveTitle = async () => {
    try {
      await api.put(`/api/academy/modules/${module.id}`, { titre: title, ordre: module.ordre })
      setEditingTitle(false)
      onRefresh()
    } catch { toast.error('Erreur') }
  }

  const deleteModule = async () => {
    if (!window.confirm(`Supprimer le module "${module.titre}" et toutes ses leçons ?`)) return
    try { await api.delete(`/api/academy/modules/${module.id}`); onRefresh() }
    catch { toast.error('Erreur suppression module') }
  }

  const addLecon = async () => {
    if (!newLecon.titre.trim()) return
    try {
      await api.post(`/api/academy/modules/${module.id}/lecons`, newLecon)
      setNewLecon({ titre: '', type: 'texte', contenu: '', ordre: 0 })
      setAddingLecon(false)
      onRefresh()
      toast.success('Leçon ajoutée')
    } catch { toast.error("Erreur ajout leçon") }
  }

  const deleteLecon = async (lid) => {
    try { await api.delete(`/api/academy/lecons/${lid}`); onRefresh() }
    catch { toast.error('Erreur suppression leçon') }
  }

  return (
    <div style={{ ...card, padding: 14, marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button style={{ background: 'none', border: 'none', color: 'rgba(200,215,240,0.5)', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }} onClick={() => setCollapsed(c => !c)}>
          {collapsed ? '▶' : '▼'}
        </button>
        {editingTitle ? (
          <>
            <input style={{ ...inputStyle, flex: 1 }} value={title} onChange={e => setTitle(e.target.value)} />
            <button style={btn('primary')} onClick={saveTitle}>OK</button>
            <button style={btn()} onClick={() => setEditingTitle(false)}>Annuler</button>
          </>
        ) : (
          <>
            <div style={{ flex: 1, fontWeight: 700, fontSize: '0.88rem', color: '#e8edf5' }}>{module.titre}</div>
            <span style={{ fontSize: '0.72rem', color: 'rgba(200,215,240,0.3)' }}>{(module.lecons || []).length} leçon(s)</span>
            <button style={{ ...btn(), fontSize: '0.72rem', padding: '3px 8px' }} onClick={() => setEditingTitle(true)}>Renommer</button>
            <button style={{ ...btn('danger'), fontSize: '0.72rem', padding: '3px 8px' }} onClick={deleteModule}>Supprimer</button>
          </>
        )}
      </div>

      {!collapsed && (
        <div style={{ marginTop: 10 }}>
          {(module.lecons || []).map(l => (
            <LeconRow key={l.id} lecon={l} onDelete={deleteLecon} onUpdate={onRefresh} />
          ))}
          {addingLecon ? (
            <div style={{ marginLeft: 16, marginTop: 8, padding: 12, background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 8 }}>
                <input style={inputStyle} value={newLecon.titre} onChange={e => setNewLecon(l => ({ ...l, titre: e.target.value }))} placeholder="Titre de la leçon" />
                <select style={{ ...inputStyle, width: 'auto' }} value={newLecon.type} onChange={e => setNewLecon(l => ({ ...l, type: e.target.value }))}>
                  {TYPE_LECONS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={btn('primary')} onClick={addLecon}>+ Ajouter</button>
                <button style={btn()} onClick={() => setAddingLecon(false)}>Annuler</button>
              </div>
            </div>
          ) : (
            <button style={{ ...btn(), marginLeft: 16, marginTop: 6, fontSize: '0.78rem' }} onClick={() => setAddingLecon(true)}>
              + Ajouter une leçon
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Formation Admin Card ─────────────────────────────────────────────────── */
function FormationAdminCard({ formation, onRefresh }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [addingModule, setAddingModule] = useState(false)
  const [newModuleTitre, setNewModuleTitre] = useState('')

  const addModule = async () => {
    if (!newModuleTitre.trim()) return
    try {
      await api.post(`/api/academy/formations/${formation.id}/modules`, { titre: newModuleTitre, ordre: 0 })
      setNewModuleTitre('')
      setAddingModule(false)
      onRefresh()
      toast.success('Module ajouté')
    } catch { toast.error('Erreur') }
  }

  const saveFormation = async (form) => {
    try {
      await api.put(`/api/academy/formations/${formation.id}`, form)
      setEditing(false)
      onRefresh()
      toast.success('Formation mise à jour')
    } catch { toast.error('Erreur mise à jour') }
  }

  const deleteFormation = async () => {
    if (!window.confirm(`Supprimer la formation "${formation.titre}" ?`)) return
    try { await api.delete(`/api/academy/formations/${formation.id}`); onRefresh() }
    catch { toast.error('Erreur suppression') }
  }

  return (
    <div style={{ ...card, padding: 16, marginBottom: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button style={{ background: 'none', border: 'none', color: 'rgba(200,215,240,0.5)', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }} onClick={() => setExpanded(e => !e)}>
          {expanded ? '▼' : '▶'}
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>{formation.titre}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
            {formation.niveau} · {formation.nb_modules || (formation.modules || []).length} module(s) · {formation.nb_lecons} leçon(s)
          </div>
        </div>
        <span style={{
          padding: '2px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
          background: formation.est_publie ? '#dcfce7' : '#fee2e2',
          color: formation.est_publie ? '#15803d' : '#b91c1c',
        }}>
          {formation.est_publie ? 'Publié' : 'Brouillon'}
        </span>
        {formation.est_onboarding && (
          <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: '0.72rem', background: '#dbeafe', color: '#1d4ed8' }}>
            Onboarding
          </span>
        )}
        <button style={{ ...btn(), fontSize: '0.75rem', padding: '4px 10px' }} onClick={() => setEditing(e => !e)}>
          Modifier
        </button>
        <button style={{ ...btn('danger'), fontSize: '0.75rem', padding: '4px 10px' }} onClick={deleteFormation}>
          Supprimer
        </button>
      </div>

      {/* Stats */}
      {formation.stats && (
        <div style={{ display: 'flex', gap: 20, marginTop: 8, fontSize: '0.78rem', color: 'rgba(200,215,240,0.4)' }}>
          <span>{formation.stats.inscrits} inscrit(s)</span>
          <span>{formation.stats.taux_completion}% complétion</span>
          {formation.stats.score_moyen != null && <span>⭐ Score moyen : {formation.stats.score_moyen}%</span>}
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div style={{ marginTop: 12 }}>
          <FormationForm initial={formation} onSave={saveFormation} onCancel={() => setEditing(false)} />
        </div>
      )}

      {/* Expanded modules */}
      {expanded && (
        <div style={{ marginTop: 14 }}>
          {(formation.modules || []).map(m => (
            <ModuleSection key={m.id} module={m} onRefresh={onRefresh} />
          ))}
          {addingModule ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input style={{ ...inputStyle, flex: 1 }} value={newModuleTitre} onChange={e => setNewModuleTitre(e.target.value)} placeholder="Titre du module" />
              <button style={btn('primary')} onClick={addModule}>+ Ajouter</button>
              <button style={btn()} onClick={() => setAddingModule(false)}>Annuler</button>
            </div>
          ) : (
            <button style={{ ...btn('primary'), marginTop: 8, fontSize: '0.82rem' }} onClick={() => setAddingModule(true)}>
              + Ajouter un module
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ── AcademyAdmin ─────────────────────────────────────────────────────────── */
export default function AcademyAdmin() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [formations, setFormations] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [globalStats, setGlobalStats] = useState(null)
  const [employeeStats, setEmployeeStats] = useState([])
  const [topApprenants, setTopApprenants] = useState([])

  const fetchFormations = useCallback(async () => {
    try {
      const [formationsRes, employesRes] = await Promise.all([
        api.get('/api/academy/admin/formations'),
        api.get('/api/academy/admin/employes-stats'),
      ])
      const list = Array.isArray(formationsRes.data) ? formationsRes.data : []
      setFormations(list)
      const totals = employesRes.data?.totaux || {}
      const total = list.length
      const published = list.filter(f => f.est_publie).length
      setGlobalStats({
        total,
        published,
        drafts: total - published,
        nb_employes: totals.nb_employes || 0,
        nb_formations_en_cours: totals.nb_formations_en_cours || 0,
        nb_formations_termines: totals.nb_formations_termines || 0,
      })
      setEmployeeStats(Array.isArray(employesRes.data?.employes) ? employesRes.data.employes : [])
      setTopApprenants(Array.isArray(employesRes.data?.top_apprenants) ? employesRes.data.top_apprenants : [])
    } catch {
      toast.error('Erreur chargement formations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchFormations() }, [fetchFormations])

  const handleCreate = async (form) => {
    try {
      await api.post('/api/academy/formations', {
        ...form,
        cree_par: String(user?.matricule || user?.sub || 'ADMIN'),
      })
      setCreating(false)
      fetchFormations()
      toast.success('Formation créée')
    } catch { toast.error('Erreur création') }
  }

  const filtered = formations.filter(f => !search || f.titre.toLowerCase().includes(search.toLowerCase()) || (f.categorie || '').toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={page}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/rh/academy')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}>
            ← Retour Academy
          </button>
          <h1 style={{ flex: 1, fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Administration Academy
          </h1>
          <button style={btn('primary')} onClick={() => setCreating(c => !c)}>
            + Nouvelle formation
          </button>
        </div>

        {/* Stats globales */}
        {globalStats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(120px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Formations totales', value: globalStats.total, color: '#818cf8' },
              { label: 'Publiées', value: globalStats.published, color: '#34d399' },
              { label: 'Brouillons', value: globalStats.drafts, color: '#f59e0b' },
              { label: 'Employés suivis', value: globalStats.nb_employes, color: '#2563eb' },
              { label: 'Inscriptions en cours', value: globalStats.nb_formations_en_cours, color: '#0ea5e9' },
              { label: 'Formations terminées', value: globalStats.nb_formations_termines, color: '#16a34a' },
            ].map(s => (
              <div key={s.label} style={{ ...card, padding: '14px 18px' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {topApprenants.length > 0 && (
          <div style={{ ...card, padding: 16, marginBottom: 18 }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>Classement Top 3 apprenants</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: 10 }}>
              {topApprenants.map((t, idx) => (
                <div key={t.employe_id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, background: '#f8fafc' }}>
                  <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
                    #{idx + 1} {t.nom}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{t.nb_formations} formation(s) terminée(s)</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Score moyen quiz: {t.score_moyen ?? '—'}%</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {employeeStats.length > 0 && (
          <div style={{ ...card, padding: 16, marginBottom: 20, overflowX: 'auto' }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>Tableau global par employé</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #e2e8f0', fontSize: '0.78rem', color: '#64748b' }}>Employé</th>
                  <th style={{ textAlign: 'center', padding: '8px 10px', borderBottom: '1px solid #e2e8f0', fontSize: '0.78rem', color: '#64748b' }}>En cours</th>
                  <th style={{ textAlign: 'center', padding: '8px 10px', borderBottom: '1px solid #e2e8f0', fontSize: '0.78rem', color: '#64748b' }}>Terminées</th>
                  <th style={{ textAlign: 'center', padding: '8px 10px', borderBottom: '1px solid #e2e8f0', fontSize: '0.78rem', color: '#64748b' }}>Progression moyenne</th>
                  <th style={{ textAlign: 'center', padding: '8px 10px', borderBottom: '1px solid #e2e8f0', fontSize: '0.78rem', color: '#64748b' }}>Score quiz moyen</th>
                  <th style={{ textAlign: 'center', padding: '8px 10px', borderBottom: '1px solid #e2e8f0', fontSize: '0.78rem', color: '#64748b' }}>Badges</th>
                </tr>
              </thead>
              <tbody>
                {employeeStats.map((row) => (
                  <tr key={row.employe_id}>
                    <td style={{ padding: '9px 10px', borderBottom: '1px solid #f1f5f9', color: '#0f172a', fontSize: '0.84rem', fontWeight: 600 }}>{row.nom}</td>
                    <td style={{ textAlign: 'center', padding: '9px 10px', borderBottom: '1px solid #f1f5f9', color: '#334155', fontSize: '0.82rem' }}>{row.nb_formations_en_cours}</td>
                    <td style={{ textAlign: 'center', padding: '9px 10px', borderBottom: '1px solid #f1f5f9', color: '#334155', fontSize: '0.82rem' }}>{row.nb_formations_termines}</td>
                    <td style={{ textAlign: 'center', padding: '9px 10px', borderBottom: '1px solid #f1f5f9', color: '#334155', fontSize: '0.82rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                        <div style={{ width: 90, height: 6, borderRadius: 99, background: '#e2e8f0', overflow: 'hidden' }}>
                          <div style={{ width: `${row.progression_moyenne}%`, height: '100%', background: '#2563eb' }} />
                        </div>
                        <span>{row.progression_moyenne}%</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', padding: '9px 10px', borderBottom: '1px solid #f1f5f9', color: '#334155', fontSize: '0.82rem' }}>{row.score_quiz_moyen ?? '—'}%</td>
                    <td style={{ textAlign: 'center', padding: '9px 10px', borderBottom: '1px solid #f1f5f9', color: '#334155', fontSize: '0.82rem' }}>{row.badges_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Nouvelle formation */}
        {creating && (
          <FormationForm onSave={handleCreate} onCancel={() => setCreating(false)} />
        )}

        {/* Recherche */}
        <div style={{ marginBottom: 16 }}>
          <input
            style={inputStyle}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une formation…"
          />
        </div>

        {/* Liste */}
        {loading ? (
          <div style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>Chargement…</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: '#94a3b8', textAlign: 'center', padding: 40, fontSize: '0.9rem' }}>
            {search ? 'Aucune formation trouvée' : 'Aucune formation. Créez-en une !'}
          </div>
        ) : (
          filtered.map(f => (
            <FormationAdminCard key={f.id} formation={f} onRefresh={fetchFormations} />
          ))
        )}
      </div>
    </div>
  )
}
