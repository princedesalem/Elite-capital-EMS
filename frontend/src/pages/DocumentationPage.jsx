import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { BookOpen, FileText, Upload, Trash2, Pencil, Plus, X, ChevronRight, File, Download, Search, FolderOpen } from 'lucide-react'
import { toast, confirmDialog } from '../components/ui/bridge'

const ALLOWED_EXTS = ['.pdf','.doc','.docx','.xlsx','.xls','.ppt','.pptx','.txt','.png','.jpg','.jpeg']
const CATEGORIES = ['Général','RH','Finance','Juridique','Opérations','IT','Formation','Procédures','Autre']

export default function DocumentationPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('articles')       // 'articles' | 'fichiers'
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [editingArticle, setEditingArticle] = useState(null)  // null | article object
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ titre: '', contenu: '', categorie: 'Général' })
  const [filterCat, setFilterCat] = useState('all')
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [fichiers, setFichiers] = useState([])
  const [fichierCat, setFichierCat] = useState('Général')
  const fileInputRef = useRef(null)

  const canEdit = ['RH','ADMIN','PCA','AG','DG','DRH'].includes(String(user?.role||'').toUpperCase())

  const loadArticles = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/documentation/articles')
      setArticles(Array.isArray(res.data) ? res.data : [])
    } catch {
      setArticles([])
    } finally {
      setLoading(false)
    }
  }

  const loadFichiers = async () => {
    try {
      const res = await api.get('/api/documentation/articles', { params: { type_doc: 'fichier' } })
      const all = Array.isArray(res.data) ? res.data : []
      setFichiers(all.filter(a => a.type_doc === 'fichier'))
    } catch { setFichiers([]) }
  }

  useEffect(() => { loadArticles(); loadFichiers() }, [])

  const filteredArticles = articles
    .filter(a => a.type_doc !== 'fichier')
    .filter(a => filterCat === 'all' || a.categorie === filterCat)
    .filter(a => !search.trim() || a.titre.toLowerCase().includes(search.toLowerCase()) || (a.contenu||'').toLowerCase().includes(search.toLowerCase()))

  const filteredFichiers = fichiers
    .filter(f => filterCat === 'all' || f.categorie === filterCat)
    .filter(f => !search.trim() || (f.titre||'').toLowerCase().includes(search.toLowerCase()) || (f.fichier_nom||'').toLowerCase().includes(search.toLowerCase()))

  const startNew = () => {
    setEditingArticle(null)
    setForm({ titre: '', contenu: '', categorie: 'Général' })
    setShowForm(true)
    setSelectedArticle(null)
  }

  const startEdit = (a) => {
    setEditingArticle(a)
    setForm({ titre: a.titre, contenu: a.contenu || '', categorie: a.categorie || 'Général' })
    setShowForm(true)
    setSelectedArticle(null)
  }

  const cancelForm = () => { setShowForm(false); setEditingArticle(null) }

  const submitArticle = async (e) => {
    e.preventDefault()
    if (!form.titre.trim()) return
    try {
      const mat = user?.matricule || user?.sub
      const payload = {
        titre: form.titre.trim(),
        contenu: form.contenu.trim(),
        categorie: form.categorie,
        auteur_matricule: String(mat),
        auteur_nom: user?.nom || String(mat),
        type_doc: 'article'
      }
      if (editingArticle) {
        await api.put(`/api/documentation/articles/${editingArticle.id_doc}`, payload)
        toast.success('Article mis à jour')
      } else {
        await api.post('/api/documentation/articles', payload)
        toast.success('Article publié')
      }
      cancelForm()
      loadArticles()
    } catch { toast.error('Erreur lors de la sauvegarde') }
  }

  const deleteArticle = async (a) => {
    const ok = await confirmDialog({ title: 'Supprimer', message: `Supprimer l'article "${a.titre}" ?`, variant: 'danger', confirmLabel: 'Supprimer' })
    if (!ok) return
    await api.delete(`/api/documentation/articles/${a.id_doc}`)
    if (selectedArticle?.id_doc === a.id_doc) setSelectedArticle(null)
    loadArticles()
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = '.' + file.name.split('.').pop().toLowerCase()
    if (!ALLOWED_EXTS.includes(ext)) {
      setUploadError(`Type de fichier non autorisé. Types acceptés : ${ALLOWED_EXTS.join(', ')}`)
      return
    }
    setUploadError('')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('categorie', fichierCat)
      fd.append('auteur_matricule', String(user?.matricule || user?.sub || ''))
      fd.append('auteur_nom', user?.nom || String(user?.matricule || ''))
      await api.post('/api/documentation/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Fichier téléversé avec succès')
      loadFichiers()
    } catch { toast.error('Erreur lors du téléversement') } finally { setUploading(false) }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const deleteFichier = async (f) => {
    const ok = await confirmDialog({ title: 'Supprimer', message: `Supprimer le fichier "${f.fichier_nom || f.titre}" ?`, variant: 'danger', confirmLabel: 'Supprimer' })
    if (!ok) return
    await api.delete(`/api/documentation/articles/${f.id_doc}`)
    loadFichiers()
  }

  const catCounts = {}
  const allDocs = tab === 'articles' ? filteredArticles : filteredFichiers
  ;(tab === 'articles' ? articles.filter(a=>a.type_doc!=='fichier') : fichiers).forEach(a => {
    catCounts[a.categorie] = (catCounts[a.categorie] || 0) + 1
  })

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: 'linear-gradient(135deg, #02162e, #1e3a5f)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <BookOpen size={20} color="white" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#02162e' }}>Documentation</h1>
          <p style={{ margin: '2px 0 0', fontSize: '0.83rem', color: '#64748b' }}>Base de connaissances · Procédures · Fichiers</p>
        </div>
        {canEdit && (
          <button onClick={startNew} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: '#02162e', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
            <Plus size={16} /> Nouvel article
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e2e8f0', marginBottom: 20 }}>
        {[{ k: 'articles', l: 'Articles', ic: <FileText size={15} /> }, { k: 'fichiers', l: 'Fichiers', ic: <File size={15} /> }].map(t => (
          <button key={t.k} onClick={() => { setTab(t.k); setSelectedArticle(null); setShowForm(false) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.88rem', fontWeight: tab === t.k ? 700 : 500, color: tab === t.k ? '#02162e' : '#64748b', borderBottom: tab === t.k ? '2px solid #02162e' : '2px solid transparent', marginBottom: -2 }}>
            {t.ic}{t.l}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20 }}>
        {/* Sidebar — Categories */}
        <div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid var(--border)', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
              Catégories
            </div>
            <button onClick={() => setFilterCat('all')}
              style={{ width: '100%', padding: '9px 14px', border: 'none', background: filterCat === 'all' ? '#eff6ff' : 'none', cursor: 'pointer', textAlign: 'left', fontSize: '0.83rem', fontWeight: filterCat === 'all' ? 700 : 400, color: filterCat === 'all' ? '#2563eb' : '#334155', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><FolderOpen size={13} />Tout</span>
              <span style={{ fontSize: '0.72rem', background: '#e2e8f0', borderRadius: 20, padding: '1px 7px', color: '#64748b' }}>
                {tab === 'articles' ? articles.filter(a=>a.type_doc!=='fichier').length : fichiers.length}
              </span>
            </button>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setFilterCat(cat)}
                style={{ width: '100%', padding: '9px 14px', border: 'none', background: filterCat === cat ? '#eff6ff' : 'none', cursor: 'pointer', textAlign: 'left', fontSize: '0.83rem', fontWeight: filterCat === cat ? 700 : 400, color: filterCat === cat ? '#2563eb' : '#334155', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><ChevronRight size={11} />{cat}</span>
                {catCounts[cat] ? <span style={{ fontSize: '0.72rem', background: '#e2e8f0', borderRadius: 20, padding: '1px 7px', color: '#64748b' }}>{catCounts[cat]}</span> : null}
              </button>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div>
          {/* Search bar */}
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher dans la documentation..."
              style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1px solid var(--border)', borderRadius: 10, fontSize: '0.85rem', outline: 'none', background: 'var(--card)', boxSizing: 'border-box' }} />
          </div>

          {/* Article form */}
          {showForm && tab === 'articles' && (
            <div style={{ background: 'var(--card)', border: '2px solid #cbd5e1', borderRadius: 12, padding: '20px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#02162e' }}>
                  {editingArticle ? 'Modifier l\'article' : 'Nouvel article'}
                </h3>
                <button onClick={cancelForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={16} /></button>
              </div>
              <form onSubmit={submitArticle} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input placeholder="Titre de l'article *" value={form.titre} onChange={e => setForm({...form, titre: e.target.value})} required
                  style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.88rem', outline: 'none' }} />
                <select value={form.categorie} onChange={e => setForm({...form, categorie: e.target.value})}
                  style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.88rem', background: 'var(--card)' }}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <textarea placeholder="Contenu de l'article (Markdown supporté)..." value={form.contenu} onChange={e => setForm({...form, contenu: e.target.value})} rows={12}
                  style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.85rem', resize: 'vertical', fontFamily: 'monospace', lineHeight: 1.6, outline: 'none' }} />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={cancelForm} style={{ padding: '8px 16px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: '#64748b', fontWeight: 600, fontSize: '0.85rem' }}>Annuler</button>
                  <button type="submit" style={{ padding: '8px 20px', background: '#02162e', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
                    {editingArticle ? 'Mettre à jour' : 'Publier'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Articles tab */}
          {tab === 'articles' && !showForm && (
            <div style={{ display: 'grid', gridTemplateColumns: selectedArticle ? '280px 1fr' : '1fr', gap: 16 }}>
              {/* Article list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {loading && <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Chargement...</div>}
                {!loading && filteredArticles.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12 }}>
                    <BookOpen size={40} style={{ opacity: 0.15, marginBottom: 14 }} />
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: '#334155' }}>En construction</p>
                    <p style={{ margin: '6px 0 0', fontSize: '0.83rem', color: '#94a3b8' }}>
                      {canEdit ? 'Publiez le premier article en cliquant sur "Nouvel article".' : 'La base de connaissances sera disponible prochainement.'}
                    </p>
                  </div>
                )}
                {filteredArticles.map(a => (
                  <div key={a.id_doc}
                    onClick={() => setSelectedArticle(a)}
                    style={{ background: 'var(--card)', border: selectedArticle?.id_doc === a.id_doc ? '2px solid #02162e' : '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', cursor: 'pointer', transition: 'border 0.15s' }}
                    onMouseEnter={e => { if(selectedArticle?.id_doc !== a.id_doc) e.currentTarget.style.background = '#f8fafc' }}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--card)' }>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: '#02162e', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.titre}</div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                          <span style={{ fontSize: '0.7rem', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{a.categorie}</span>
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{a.auteur_nom || a.auteur_matricule}</span>
                        </div>
                      </div>
                      {canEdit && (
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button onClick={ev => { ev.stopPropagation(); startEdit(a) }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, borderRadius: 4 }}
                            onMouseEnter={e => e.currentTarget.style.color = '#475569'}
                            onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>
                            <Pencil size={13} />
                          </button>
                          <button onClick={ev => { ev.stopPropagation(); deleteArticle(a) }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, borderRadius: 4 }}
                            onMouseEnter={e => e.currentTarget.style.color = '#ce2b2b'}
                            onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Article detail */}
              {selectedArticle && (
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px', position: 'relative' }}>
                  <button onClick={() => setSelectedArticle(null)}
                    style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                    <X size={16} />
                  </button>
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: '0.72rem', background: '#f1f5f9', color: '#475569', padding: '3px 10px', borderRadius: 20, fontWeight: 700 }}>{selectedArticle.categorie}</span>
                  </div>
                  <h2 style={{ margin: '12px 0 6px', fontSize: '1.3rem', fontWeight: 800, color: '#02162e' }}>{selectedArticle.titre}</h2>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 20 }}>
                    Par {selectedArticle.auteur_nom || selectedArticle.auteur_matricule}
                    {selectedArticle.created_at && <> · {new Date(selectedArticle.created_at).toLocaleDateString('fr-FR')}</>}
                  </div>
                  <div style={{ fontSize: '0.88rem', lineHeight: 1.8, color: '#334155', whiteSpace: 'pre-wrap' }}>
                    {selectedArticle.contenu || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Aucun contenu.</span>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fichiers tab */}
          {tab === 'fichiers' && (
            <div>
              {/* Upload zone */}
              {canEdit && (
                <div style={{ background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: 12, padding: '20px', marginBottom: 20, textAlign: 'center' }}>
                  <Upload size={28} style={{ color: '#94a3b8', marginBottom: 8 }} />
                  <p style={{ margin: '0 0 10px', fontSize: '0.85rem', color: '#64748b' }}>
                    Glissez-déposez un fichier ou cliquez pour sélectionner
                  </p>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select value={fichierCat} onChange={e => setFichierCat(e.target.value)}
                      style={{ padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.83rem', background: 'white' }}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      style={{ padding: '8px 20px', background: '#02162e', color: 'white', border: 'none', borderRadius: 8, cursor: uploading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.85rem', opacity: uploading ? 0.6 : 1 }}>
                      {uploading ? 'Envoi en cours...' : 'Choisir un fichier'}
                    </button>
                    <input ref={fileInputRef} type="file" accept={ALLOWED_EXTS.join(',')} onChange={handleFileUpload} style={{ display: 'none' }} />
                  </div>
                  {uploadError && <p style={{ margin: '10px 0 0', color: '#ce2b2b', fontSize: '0.8rem' }}>{uploadError}</p>}
                  <p style={{ margin: '8px 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>
                    Types acceptés : PDF, Word, Excel, PowerPoint, images, texte · Max 20 Mo
                  </p>
                </div>
              )}

              {filteredFichiers.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12 }}>
                  <File size={40} style={{ opacity: 0.15, marginBottom: 14 }} />
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: '#334155' }}>Aucun fichier</p>
                  <p style={{ margin: '6px 0 0', fontSize: '0.83rem', color: '#94a3b8' }}>
                    {canEdit ? 'Téléversez des fichiers en utilisant le formulaire ci-dessus.' : 'Aucun fichier disponible pour le moment.'}
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredFichiers.map(f => (
                  <div key={f.id_doc} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <File size={18} color="#475569" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#02162e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.titre || f.fichier_nom}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: 2 }}>
                        {f.categorie} · {f.auteur_nom || f.auteur_matricule}
                        {f.created_at && <> · {new Date(f.created_at).toLocaleDateString('fr-FR')}</>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {f.fichier_url && (
                        <a href={f.fichier_url} download={f.fichier_nom || true} target="_blank" rel="noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#334155', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none' }}>
                          <Download size={13} /> Télécharger
                        </a>
                      )}
                      {canEdit && (
                        <button onClick={() => deleteFichier(f)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 6, borderRadius: 6 }}
                          onMouseEnter={e => e.currentTarget.style.color = '#ce2b2b'}
                          onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
