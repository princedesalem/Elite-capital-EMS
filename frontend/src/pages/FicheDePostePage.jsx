import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import DOMPurify from 'dompurify'
import { Upload, FileText, Trash2, Download, Eye, X, Check, UserPlus, ChevronDown, ChevronRight } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'

const API = import.meta.env.VITE_API_URL || ''

// Rôles avec accès complet (toutes les fiches, peuvent gérer/importer)
const FULL_ACCESS_ROLES = ['RH', 'ADMIN', 'PCA', 'AG']
// Rôles avec accès par scope organisationnel (lecture seule élargie)
const SCOPED_ROLES = ['DG', 'DIRECTEUR', 'RESPONSABLE']

// Couleurs thème
const DARK_BLUE = '#021630'
const LIGHT_BG  = '#f4f6fb'
const CARD_BG   = '#ffffff'
const BORDER    = '#dde3ef'

// ---------------------------------------------------------------------------
// Helpers de rendu de contenu
// ---------------------------------------------------------------------------

/** Détecte si une ligne est une ligne de tableau (contient ' | ') */
const isTableRow = (line) => line.includes(' | ')

/**
 * Regroupe les lignes d'une section en blocs typés :
 * - { type:'table', rows:[[col1,col2,...]] }
 * - { type:'bullet', text }
 * - { type:'text', text }
 */
function buildBlocks(contenu) {
  const blocks = []
  let tableRows = []

  const flushTable = () => {
    if (tableRows.length > 0) {
      blocks.push({ type: 'table', rows: tableRows })
      tableRows = []
    }
  }

  for (const line of contenu) {
    if (isTableRow(line)) {
      tableRows.push(line.split(' | ').map(c => c.trim()))
    } else {
      flushTable()
      const clean = line.replace(/^\s*[•·]\s*/, '')
      if (line.trimStart().startsWith('•') || line.trimStart().startsWith('·')) {
        blocks.push({ type: 'bullet', text: clean })
      } else {
        blocks.push({ type: 'text', text: line })
      }
    }
  }
  flushTable()
  return blocks
}

/** Rendu d'un texte avec marqueurs **gras** et [r]rouge[/r] */
function renderRichText(text) {
  if (!text) return null
  const parts = text.split(/(\*\*(?:[^*]|\*(?!\*))+\*\*|\[r\][\s\S]*?\[\/r\])/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('[r]') && part.endsWith('[/r]'))
      return <span key={i} style={{ color: '#ce2b2b', fontWeight: 600 }}>{part.slice(3, -4)}</span>
    return part || null
  })
}

/** Rendu d'un bloc de contenu */
function ContentBlock({ blocks }) {
  let bulletBuffer = []
  let numberedBuffer = []
  const rendered = []

  const flushBullets = (key) => {
    if (bulletBuffer.length > 0) {
      rendered.push(
        <ul key={`b-${key}`} style={{ margin: '6px 0 6px 0', paddingLeft: 20 }}>
          {bulletBuffer.map((b, i) => (
            <li key={i} style={{ fontSize: '0.83rem', color: '#334155', marginBottom: 3, lineHeight: 1.5 }}>{renderRichText(b)}</li>
          ))}
        </ul>
      )
      bulletBuffer = []
    }
  }

  const flushNumbered = (key) => {
    if (numberedBuffer.length > 0) {
      const startNum = numberedBuffer[0].num || 1
      rendered.push(
        <ol key={`n-${key}`} start={startNum} style={{ margin: '6px 0 6px 0', paddingLeft: 22 }}>
          {numberedBuffer.map((b, i) => (
            <li key={i} style={{ fontSize: '0.83rem', color: '#334155', marginBottom: 3, lineHeight: 1.5 }}>{renderRichText(b.text)}</li>
          ))}
        </ol>
      )
      numberedBuffer = []
    }
  }

  blocks.forEach((block, idx) => {
    if (block.type === 'bullet') {
      flushNumbered(idx)
      bulletBuffer.push(block.text)
    } else if (block.type === 'numbered') {
      flushBullets(idx)
      numberedBuffer.push(block)
    } else {
      flushBullets(idx)
      flushNumbered(idx)
      if (block.type === 'table') {
        const isHeader = (row) => {
          // Première ligne = en-tête si tout en majuscules ou contient des mots-clés
          const joined = row.join(' ')
          return joined === joined.toUpperCase() && joined.length > 3
        }
        rendered.push(
          <div key={idx} style={{ overflowX: 'auto', marginBottom: 10 }}>
            <table style={{
              width: '100%', borderCollapse: 'collapse',
              fontSize: '0.81rem', border: `1px solid ${BORDER}`,
            }}>
              <tbody>
                {block.rows.map((row, ri) => {
                  const header = ri === 0 && isHeader(row)
                  return (
                    <tr key={ri} style={{ background: header ? '#eef1f8' : ri % 2 === 0 ? '#fff' : '#f8f9fc' }}>
                      {row.map((cell, ci) => (
                        <td key={ci} style={{
                          border: `1px solid ${BORDER}`,
                          padding: '6px 10px',
                          verticalAlign: 'top',
                          fontWeight: header ? 700 : 400,
                          color: header ? DARK_BLUE : '#334155',
                          whiteSpace: 'pre-wrap',
                          lineHeight: 1.45,
                          width: row.length === 2 ? (ci === 0 ? '55%' : '45%') : undefined,
                        }}>
                          {renderRichText(cell)}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      } else {
        // text
        rendered.push(
          <p key={idx} style={{
            margin: '0 0 6px 0', fontSize: '0.83rem',
            color: '#334155', lineHeight: 1.55,
          }}>
            {renderRichText(block.text)}
          </p>
        )
      }
    }
  })
  flushBullets('end')
  flushNumbered('end')
  return <>{rendered}</>
}

/** Info card pour la section d'en-tête (clé | valeur) */
function InfoCard({ rows, titulairesLabel }) {
  return (
    <div style={{
      border: `1px solid ${BORDER}`, borderRadius: 8,
      overflow: 'hidden', marginBottom: 16,
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
        <tbody>
          {rows.map((row, i) => {
            const rawKey = (row[0] || '').replace(/\*\*/g, '').trim().toLowerCase()
            const isTitulaireRow = rawKey.includes('titulaire')
            return (
              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8f9fc' }}>
                <td style={{
                  padding: '7px 14px', fontWeight: 700, color: DARK_BLUE,
                  border: `1px solid ${BORDER}`, width: '38%',
                  whiteSpace: 'nowrap',
                }}>
                  {renderRichText(row[0] || '')}
                </td>
                <td style={{
                  padding: '7px 14px',
                  border: `1px solid ${BORDER}`,
                  fontWeight: isTitulaireRow && titulairesLabel ? 600 : 400,
                  color: isTitulaireRow && titulairesLabel ? '#1a3360' : '#334155',
                }}>
                  {isTitulaireRow && titulairesLabel ? titulairesLabel : renderRichText(row[1] || '')}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Affichage d'une section de fiche */
function SectionCard({ section, index, isFirst, titulairesLabel }) {
  const [open, setOpen] = useState(true)
  const blocks = buildBlocks(section.contenu || [])
  const hasTitle = section.titre && section.titre.trim()

  // Première section avec uniquement des tableaux → rendu InfoCard (en-tête fiche)
  const allTable = blocks.length > 0 && blocks.every(b => b.type === 'table')
  const headerRows = allTable ? (blocks[0]?.rows || []) : null

  return (
    <div style={{
      border: `1px solid ${BORDER}`,
      borderRadius: 10,
      marginBottom: 14,
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(2,22,48,0.05)',
    }}>
      {hasTitle && (
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 16px',
            background: isFirst ? DARK_BLUE : '#1a3360',
            color: '#fff', border: 'none', cursor: 'pointer', textAlign: 'left',
            fontSize: '0.82rem', fontWeight: 800, letterSpacing: '0.03em',
            textTransform: 'uppercase',
          }}
        >
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          {section.titre}
        </button>
      )}
      {open && (
        <div style={{ padding: headerRows ? '14px 14px' : '12px 16px', background: CARD_BG }}>
          {(section.contenu || []).length === 0 ? (
            <p style={{ color: '#aaa', fontSize: '0.8rem', margin: 0 }}>Aucun contenu.</p>
          ) : headerRows ? (
            <InfoCard rows={headerRows} titulairesLabel={isFirst ? titulairesLabel : undefined} />
          ) : (
            <ContentBlock blocks={blocks} />
          )}
        </div>
      )}
    </div>
  )
}

/** Carte résumé de fiche dans la liste RH */
function FicheListItem({ fiche, selected, onClick, onDelete, onReimported, onReassign, canImport = true }) {
  const fileRef = useRef()
  const [uploading, setUploading] = useState(false)

  const handleQuickImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('fichier', file)
      form.append('fonction', fiche.fonction)
      const token = localStorage.getItem('ec_token') || localStorage.getItem('access_token')
      const res = await axios.post(`${API}/api/fiches-poste/import`, form, {
        headers: { Authorization: `Bearer ${token}` },
      })
      onReimported?.(res.data)
    } catch (err) {
      alert('Erreur import : ' + (err.response?.data?.detail || err.message))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const hasNoSections = (fiche.sections?.length ?? 0) === 0

  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 14px', borderRadius: 8, marginBottom: 6, cursor: 'pointer',
        background: selected ? '#e8edf7' : CARD_BG,
        border: `1.5px solid ${selected ? '#3b5fc0' : hasNoSections ? '#f0a030' : BORDER}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        transition: 'border-color 0.15s',
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: DARK_BLUE }}>{fiche.fonction}</div>
        {fiche.titulaires?.length > 0 && (
          <div style={{ fontSize: '0.73rem', color: '#3b5fc0', fontWeight: 600, marginTop: 2 }}>
            {fiche.titulaires.map(t => `${t.prenom} ${t.nom}`).join(', ')}
          </div>
        )}
        <div style={{ fontSize: '0.72rem', color: hasNoSections ? '#e07010' : '#aaa', marginTop: 2 }}>
          {fiche.sections?.length ?? 0} section(s)
          {fiche.fichier_nom ? ` · ${fiche.fichier_nom}` : ''}
        </div>
        {/* Bouton réimporter directement sur la carte quand sections = 0 */}
        {hasNoSections && canImport && (
          <button
            onClick={e => { e.stopPropagation(); fileRef.current?.click() }}
            disabled={uploading}
            title="Cliquez pour réimporter le .docx de cette fiche"
            style={{
              marginTop: 5, display: 'inline-flex', alignItems: 'center', gap: 4,
              background: uploading ? '#f5deb0' : '#fff3e0',
              border: '1px solid #f0a030', borderRadius: 5,
              padding: '3px 8px', cursor: uploading ? 'default' : 'pointer',
              fontSize: '0.7rem', fontWeight: 700, color: '#b85c00',
            }}
          >
            <Upload size={10} />
            {uploading ? 'Importé…' : 'Réimporter .docx'}
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".docx,.doc"
        style={{ display: 'none' }}
        onChange={handleQuickImport}
      />
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {onReassign && (
          <button
            onClick={e => { e.stopPropagation(); onReassign(fiche) }}
            title="Assigner les titulaires de cette fiche"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b5fc0', padding: 4 }}
          >
            <UserPlus size={14} />
          </button>
        )}
        {onDelete && (
          <button
            onClick={e => { e.stopPropagation(); onDelete(fiche) }}
            title="Supprimer"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d9534f', padding: 4 }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

/** Modal d'assignation manuelle des titulaires d'une fiche de poste.
 *  Permet aux RH/ADMIN de choisir 1..N employés à rattacher à la fiche.
 */
function AssignTitulairesModal({ fiche, onClose, onUpdated }) {
  const [allEmployees, setAllEmployees] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('ec_token') || localStorage.getItem('access_token')
    setLoading(true)
    axios
      .get(`${API}/employees/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.items || [])
        setAllEmployees(list)
        // pré-sélection : titulaires actuels de la fiche
        const current = new Set((fiche.titulaires || []).map(t => String(t.matricule).toUpperCase()))
        setSelected(current)
      })
      .catch(() => setError('Erreur de chargement des employés'))
      .finally(() => setLoading(false))
  }, [fiche])

  const toggle = (matricule) => {
    const m = String(matricule).toUpperCase()
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(m)) next.delete(m); else next.add(m)
      return next
    })
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allEmployees
    return allEmployees.filter(e => {
      const txt = `${e.matricule || ''} ${e.nom || ''} ${e.prenom || ''} ${e.fonction || ''}`.toLowerCase()
      return txt.includes(q)
    })
  }, [allEmployees, search])

  const submit = async () => {
    setSubmitting(true); setError(null)
    try {
      const token = localStorage.getItem('ec_token') || localStorage.getItem('access_token')
      const res = await axios.patch(
        `${API}/api/fiches-poste/${fiche.id_template}/titulaires`,
        { matricules: Array.from(selected) },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      onUpdated?.(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Erreur lors de l\'assignation')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 22, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: '1rem', color: DARK_BLUE, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserPlus size={18} /> Assigner les titulaires
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ marginBottom: 12, padding: 10, background: LIGHT_BG, borderRadius: 8, fontSize: '0.82rem' }}>
          <div style={{ color: '#666', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700, marginBottom: 4 }}>Fiche</div>
          <div style={{ fontWeight: 700, color: DARK_BLUE }}>{fiche.fonction}</div>
          <div style={{ marginTop: 4, color: '#666', fontSize: '0.78rem' }}>
            {selected.size} employé{selected.size > 1 ? 's' : ''} sélectionné{selected.size > 1 ? 's' : ''}
          </div>
        </div>

        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par matricule, nom, prénom, fonction…"
          style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: '0.85rem', marginBottom: 10, boxSizing: 'border-box' }}
        />

        <div style={{ flex: 1, overflowY: 'auto', border: `1px solid ${BORDER}`, borderRadius: 8 }}>
          {loading ? (
            <div style={{ padding: 16, textAlign: 'center', color: '#888' }}>Chargement…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: '#888' }}>Aucun employé</div>
          ) : (
            filtered.map(e => {
              const m = String(e.matricule).toUpperCase()
              const isSelected = selected.has(m)
              return (
                <label
                  key={e.matricule}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                    borderBottom: `1px solid ${BORDER}`, cursor: 'pointer',
                    background: isSelected ? '#eaf2ff' : '#fff',
                  }}
                >
                  <input type="checkbox" checked={isSelected} onChange={() => toggle(e.matricule)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: DARK_BLUE, fontSize: '0.85rem' }}>
                      {e.prenom} {e.nom} <span style={{ color: '#888', fontWeight: 400 }}>· {e.matricule}</span>
                    </div>
                    {e.fonction && (
                      <div style={{ color: '#666', fontSize: '0.74rem' }}>{e.fonction}</div>
                    )}
                  </div>
                </label>
              )
            })
          )}
        </div>

        {error && (
          <div style={{ marginTop: 10, color: '#a02020', fontSize: '0.8rem', background: '#fff3f3', border: '1px solid #f5c6cb', borderRadius: 6, padding: 8 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button onClick={onClose} disabled={submitting} style={{ padding: '8px 16px', background: '#eef0f6', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.83rem', color: '#444' }}>Annuler</button>
          <button
            onClick={submit}
            disabled={submitting}
            style={{ padding: '8px 18px', background: DARK_BLUE, color: '#fff', border: 'none', borderRadius: 8, cursor: submitting ? 'wait' : 'pointer', fontWeight: 700, fontSize: '0.83rem', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Check size={14} /> {submitting ? 'En cours…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Détecte la fonction depuis le nom du fichier (miroir JS du backend) */
function detectFonction(filename) {
  let name = filename.replace(/\.(docx?|doc)$/i, '')
  const prefixes = ['Fiche_de_poste_', 'Fiche de poste ', 'Fiche_de_Poste_', 'FDP_', 'fdp_']
  for (const p of prefixes) {
    if (name.startsWith(p)) { name = name.slice(p.length); break }
  }
  return name.replace(/_/g, ' ').trim()
}

/** Modal d'import .docx — multi-fichiers */
function ImportModal({ onClose, onImported, currentUser }) {
  const [items, setItems]     = useState([]) // [{id, file, fonction, status, error}]
  const [isDragging, setIsDragging] = useState(false)
  const [importing, setImporting]   = useState(false)
  const [allDone, setAllDone]       = useState(false)
  const [fonctionOptions, setFonctionOptions] = useState([])
  const fileRef = useRef()

  // Charger la liste des fonctions de l'application au montage
  useEffect(() => {
    const token = localStorage.getItem('ec_token') || localStorage.getItem('access_token')
    axios.get(`${API}/employees/autocomplete/fonctions`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => {
      const opts = Array.isArray(r.data) ? r.data.map(f => (typeof f === 'string' ? f : f.libelle || f.label || '')).filter(Boolean) : []
      setFonctionOptions(opts)
    }).catch(() => {})
  }, [])

  const addFiles = (fileList) => {
    const newItems = Array.from(fileList)
      .filter(f => /\.(docx?)$/i.test(f.name))
      .map(f => ({ id: `${f.name}-${f.lastModified}`, file: f, fonction: detectFonction(f.name), status: 'pending', error: null }))
    setItems(prev => {
      const existingIds = new Set(prev.map(i => i.id))
      return [...prev, ...newItems.filter(i => !existingIds.has(i.id))]
    })
  }

  const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id))

  const updateFonction = (id, val) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, fonction: val } : i))

  const handleImportAll = async () => {
    const pending = items.filter(i => i.status === 'pending' || i.status === 'error')
    if (pending.length === 0) return
    setImporting(true)
    const token = localStorage.getItem('ec_token') || localStorage.getItem('access_token')
    for (const item of pending) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'loading' } : i))
      try {
        const form = new FormData()
        form.append('fichier', item.file)
        form.append('fonction', item.fonction.trim())
        if (currentUser?.matricule) form.append('cree_par', currentUser.matricule)
        const res = await axios.post(`${API}/api/fiches-poste/import`, form, {
          headers: { Authorization: `Bearer ${token}` },
        })
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'done' } : i))
        onImported(res.data)
      } catch (e) {
        const msg = e.response?.data?.detail || 'Erreur'
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: msg } : i))
      }
    }
    setImporting(false)
    // Auto-fermeture uniquement si tout est OK (aucune erreur)
    setItems(prev => {
      const hasErrors = prev.some(i => i.status === 'error')
      if (!hasErrors) {
        setAllDone(true)
        setTimeout(() => onClose(), 1400)
      }
      return prev
    })
  }

  const pendingCount = items.filter(i => i.status === 'pending' || i.status === 'error').length

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(2,22,48,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: CARD_BG, borderRadius: 14, padding: 28, width: 560,
        maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
      }}>
        {/* En-tête */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: '1rem', color: DARK_BLUE, fontWeight: 800 }}>
            Importer des fiches de poste
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
            <X size={18} />
          </button>
        </div>

        {/* Zone de dépôt */}
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files) }}
          style={{
            border: `2px dashed ${isDragging ? '#3b5fc0' : BORDER}`,
            borderRadius: 10, padding: '22px 16px',
            textAlign: 'center', cursor: 'pointer',
            background: isDragging ? '#eef2ff' : LIGHT_BG,
            marginBottom: 18, transition: 'all 0.15s',
          }}
        >
          <Upload size={26} style={{ color: isDragging ? '#3b5fc0' : DARK_BLUE, marginBottom: 8 }} />
          <div style={{ fontSize: '0.85rem', color: '#555', fontWeight: 600 }}>
            Cliquez ou déposez vos fichiers .docx ici
          </div>
          <div style={{ fontSize: '0.75rem', color: '#999', marginTop: 4 }}>
            Plusieurs fichiers acceptés simultanément
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".docx,.doc"
            multiple
            style={{ display: 'none' }}
            onChange={e => { addFiles(e.target.files); e.target.value = '' }}
          />
        </div>

        {/* Liste des fichiers */}
        {items.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {items.map(item => (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 8, marginBottom: 8,
                border: `1px solid ${item.status === 'error' ? '#f5c6cb' : item.status === 'done' ? '#c3e6cb' : BORDER}`,
                background: item.status === 'error' ? '#fff8f8' : item.status === 'done' ? '#f4fff6' : '#fff',
              }}>
                <FileText size={14} style={{ color: DARK_BLUE, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {/* Dropdown fonctions */}
                  <select
                    value={fonctionOptions.includes(item.fonction) ? item.fonction : (item.fonction ? '__autre__' : '')}
                    onChange={e => {
                      if (e.target.value === '__autre__') updateFonction(item.id, '')
                      else updateFonction(item.id, e.target.value)
                    }}
                    disabled={item.status === 'loading' || item.status === 'done'}
                    style={{
                      width: '100%', border: `1px solid ${BORDER}`, borderRadius: 6,
                      padding: '4px 8px', fontSize: '0.82rem', fontWeight: 600,
                      color: DARK_BLUE, background: '#fff', cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <option value="" disabled>— Choisir une fonction —</option>
                    {fonctionOptions.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                    <option value="__autre__">✏ Saisir manuellement…</option>
                  </select>
                  {/* Saisie libre si fonction hors liste ou saisie manuelle */}
                  {(!fonctionOptions.includes(item.fonction) || item.fonction === '') && item.status !== 'done' && (
                    <input
                      value={item.fonction}
                      onChange={e => updateFonction(item.id, e.target.value)}
                      disabled={item.status === 'loading'}
                      placeholder="Nom de la fonction"
                      style={{
                        width: '100%', border: `1px solid ${BORDER}`, borderRadius: 6,
                        padding: '4px 8px', fontSize: '0.82rem', fontWeight: 600,
                        color: DARK_BLUE, background: '#fff', outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  )}
                </div>
                <div style={{ flexShrink: 0, fontSize: '0.72rem', color: '#888' }}>
                  {item.file.name.length > 22 ? item.file.name.slice(0, 20) + '…' : item.file.name}
                </div>
                {/* Statut */}
                {item.status === 'loading' && (
                  <div style={{ width: 16, height: 16, border: '2px solid #3b5fc0', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
                )}
                {item.status === 'done' && (
                  <Check size={15} style={{ color: '#28a745', flexShrink: 0 }} />
                )}
                {item.status === 'error' && (
                  <span title={item.error} style={{ color: '#d9534f', fontSize: '0.7rem', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    ⚠ {item.error}
                  </span>
                )}
                {(item.status === 'pending' || item.status === 'error') && !importing && (
                  <button onClick={() => removeItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: 0, flexShrink: 0 }}>
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Bouton import */}
        {items.length > 0 && (
          <button
            onClick={handleImportAll}
            disabled={importing || pendingCount === 0 || allDone}
            style={{
              width: '100%', padding: '11px', borderRadius: 8,
              background: allDone ? '#28a745' : importing ? '#3b5fc0' : pendingCount === 0 ? '#aaa' : DARK_BLUE,
              color: '#fff', border: 'none', cursor: importing || pendingCount === 0 || allDone ? 'default' : 'pointer',
              fontWeight: 700, fontSize: '0.88rem', display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {allDone
              ? <><Check size={15} /> Importé avec succès !</>
              : importing
                ? <><div style={{ width: 14, height: 14, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Import en cours…</>
                : pendingCount > 0
                  ? <><Upload size={14} /> Importer {pendingCount} fiche{pendingCount > 1 ? 's' : ''}</>
                  : <><Check size={14} /> Tous les fichiers traités</>
            }
          </button>
        )}

        {items.length === 0 && (
          <div style={{ textAlign: 'center', color: '#bbb', fontSize: '0.82rem', padding: '8px 0' }}>
            Aucun fichier sélectionné
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function FicheDePostePage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()

  const role = (user?.role || '').toUpperCase()
  const isFullAccess = FULL_ACCESS_ROLES.includes(role)
  const isScoped     = SCOPED_ROLES.includes(role)
  // Mode personnel forc\u00e9 (depuis le bouton Home \"Ma Fiche de Poste\")
  const personalMode = searchParams.get('personal') === '1'
  // Affichage des deux onglets uniquement pour FullAccess hors mode personnel
  const showTabs = isFullAccess && !personalMode
  // Si on a au moins un acc\u00e8s liste (sans mode personnel)
  const canBrowse = (isFullAccess || isScoped) && !personalMode

  // Onglet courant : 'mine' (Ma fiche) ou 'manage' (Gérer les fiches)
  const [tab, setTab] = useState(showTabs ? 'manage' : 'mine')

  // Données
  const [fiches, setFiches]           = useState([])
  const [maFiche, setMaFiche]         = useState(null)
  const [selected, setSelected]       = useState(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const [showImport, setShowImport]   = useState(false)
  const [reassigning, setReassigning] = useState(null)
  const [exporting, setExporting]     = useState(false)
  const ficheRef = useRef()

  // --- Chargement des fiches ---
  const loadFiches = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('ec_token') || localStorage.getItem('access_token')
      const headers = { Authorization: `Bearer ${token}` }
      const matricule = user?.matricule || user?.sub

      // Charger ma fiche (toujours, si on est connecté)
      if (matricule) {
        try {
          const meRes = await axios.get(`${API}/api/fiches-poste/ma-fiche`, {
            params: { matricule }, headers,
          })
          setMaFiche(meRes.data)
        } catch (e) {
          if (e.response?.status === 404) setMaFiche(null)
          else throw e
        }
      }

      // Charger la liste des fiches selon scope (canBrowse uniquement)
      if (canBrowse) {
        const res = await axios.get(`${API}/api/fiches-poste/`, { headers })
        setFiches(res.data)
        setSelected(prev => prev ?? (res.data.length > 0 ? res.data[0] : null))
      }
    } catch (e) {
      setError(e.response?.data?.detail || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [canBrowse, user])

  useEffect(() => {
    if (user) loadFiches()
  }, [user, canBrowse])

  // --- Export PDF (backend WeasyPrint, fallback HTML) ---
  const exportPDF = useCallback(async (fiche) => {
    if (!fiche?.id_template) return
    setExporting(true)
    try {
      const token = localStorage.getItem('ec_token') || localStorage.getItem('access_token')
      const matriculePdf = user?.matricule || user?.sub || ''
      const resp = await fetch(
        `${API}/api/fiches-poste/${fiche.id_template}/pdf${matriculePdf ? `?matricule=${encodeURIComponent(matriculePdf)}` : ''}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const ct = resp.headers.get('content-type') || ''
      if (ct.includes('application/pdf')) {
        // WeasyPrint OK → téléchargement direct
        const blob = await resp.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        const safe = (fiche.fonction || 'fiche').replace(/[^A-Za-z0-9_-]/g, '_')
        a.href = url
        a.download = `Fiche_poste_${safe}.pdf`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      } else {
        // Fallback : WeasyPrint non disponible → impression navigateur
        const el = ficheRef.current
        if (!el) { alert('Aucun contenu à exporter'); return }
        const safe = (fiche.fonction || 'fiche').replace(/[^A-Za-z0-9_-]/g, '_')
        const printWin = window.open('', '_blank', 'width=900,height=700')
        if (!printWin) { alert("Autorisez les popups pour exporter en PDF."); return }
        printWin.document.write(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/>
<title>Fiche_${safe}</title>
<style>
  @page { size: A4 portrait; margin: 18mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Century Gothic', CenturyGothic, 'AppleGothic', sans-serif;
         font-size: 10.5pt; color: #1a1a1a; margin: 0; background: #fff; }
  .fiche-html-content { font-size: 10pt; line-height: 1.5; padding: 10px 4px; }
  .fiche-html-content h1, .fiche-html-content h2, .fiche-html-content h3 {
    color: #021630; font-weight: 800; margin: 14px 0 6px;
    border-bottom: 1.5px solid #c00000; padding-bottom: 3px; }
  .fiche-html-content h1 { font-size: 12pt; }
  .fiche-html-content h2 { font-size: 11pt; }
  .fiche-html-content h3 { font-size: 10.5pt; }
  .fiche-html-content p { margin: 4px 0; }
  .fiche-html-content table { border-collapse: collapse; width: 100%; font-size: 9pt; }
  .fiche-html-content td, .fiche-html-content th { border: 1px solid #b7c0d4; padding: 5px 8px; }
  .fiche-html-content th { background: #021630; color: #fff; font-weight: 700; }
  .fiche-html-content tr:nth-child(even) td { background: #f4f6fb; }
  .fiche-html-content ul, .fiche-html-content ol { margin: 4px 0 6px 20px; }
  .fiche-html-content .fp-red, .fiche-html-content span[style*="c00000"] { color: #c00000 !important; font-weight: 600; }
  .fiche-html-content .fp-red *, .fiche-html-content span[style*="c00000"] * { color: #c00000 !important; }
  .fiche-html-content img { display: none; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head><body>${el.outerHTML}
<script>window.onload=function(){window.print();}<\/script>
</body></html>`)
        printWin.document.close()
      }
    } catch (e) {
      alert(e.message || "Erreur lors de l'export PDF")
    } finally {
      setExporting(false)
    }
  }, [])

  // --- Suppression ---
  const handleDelete = useCallback(async (fiche) => {
    if (!window.confirm(`Supprimer la fiche « ${fiche.fonction} » ?`)) return
    try {
      const token = localStorage.getItem('ec_token') || localStorage.getItem('access_token')
      await axios.delete(`${API}/api/fiches-poste/${fiche.id_template}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setFiches(prev => {
        const next = prev.filter(f => f.id_template !== fiche.id_template)
        setSelected(next.length > 0 ? next[0] : null)
        return next
      })
    } catch (e) {
      alert(e.response?.data?.detail || 'Erreur lors de la suppression')
    }
  }, [])

  // --- Rendu fiche (partagé employé + préview RH) ---
  // ficheAffichee : utilis\u00e9 pour conditionner l\'affichage du bouton Export PDF
  const ficheAffichee = personalMode || !showTabs
    ? (canBrowse && !personalMode ? selected : maFiche)
    : (tab === 'mine' ? maFiche : selected)

  const SectionsDisplay = ({ fiche }) => {
    const me = fiche.titulaires?.find(t => t.matricule === (user?.matricule || user?.sub))
    const isManagerView = canBrowse && (showTabs ? tab === 'manage' : true)
    const titulairesLabel = fiche.titulaires?.length
      ? (isManagerView
          ? fiche.titulaires.map(t => `${t.prenom} ${t.nom}`).join(', ')
          : (me ? `${me.prenom} ${me.nom}` : null))
      : null

    // Sanitize HTML mammoth (depuis le backend) si pr\u00e9sent
    const sanitizedHtml = useMemo(() => {
      if (!fiche?.html_content) return ''
      return DOMPurify.sanitize(fiche.html_content, {
        ADD_ATTR: ['colspan', 'rowspan', 'style', 'align', 'valign', 'class'],
      })
    }, [fiche?.html_content])

    return (
    <div ref={ficheRef} style={{ padding: '0 4px' }}>
      {/* Bandeau titre */}
      <div style={{
        background: DARK_BLUE, color: '#fff', borderRadius: '10px 10px 0 0',
        padding: '18px 22px 14px', marginBottom: 0,
        borderBottom: '3px solid #c00000',
      }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', opacity: 0.7, textTransform: 'uppercase', marginBottom: 4 }}>
          ELITE CAPITAL GROUP S.A.
        </div>
        <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, letterSpacing: '0.01em' }}>
          FICHE DE POSTE
        </h1>
        <div style={{ fontSize: '1rem', fontWeight: 600, marginTop: 4, color: '#c9d8f0' }}>
          {fiche.fonction}
        </div>
        {(fiche.titulaires?.length > 0) && (
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
            <span style={{ fontSize: '0.65rem', letterSpacing: '0.1em', opacity: 0.55, textTransform: 'uppercase', flexShrink: 0 }}>
              {fiche.titulaires.length > 1 ? 'Titulaires' : 'Titulaire'}
            </span>
            {fiche.titulaires.map(t => (
              <div key={t.matricule} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'rgba(192,0,0,0.25)', border: '1.5px solid #c00000',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.72rem', fontWeight: 800, color: '#f5e0a0', flexShrink: 0,
                }}>
                  {(t.prenom?.[0] || '?').toUpperCase()}{(t.nom?.[0] || '').toUpperCase()}
                </div>
                <span style={{ fontSize: '0.83rem', fontWeight: 600, color: '#f0f4ff' }}>
                  {t.prenom} {t.nom}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Corps : si html_content du backend (mammoth), on l\'affiche fid\u00e8lement.
          Sinon fallback sur le rendu structur\u00e9 en sections. */}
      <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '20px 24px' }}>
        {sanitizedHtml ? (
          <div className="fiche-html-content" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
        ) : (fiche.sections || []).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: '#aaa' }}>
            <FileText size={34} style={{ opacity: 0.2, marginBottom: 10 }} />
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#888', marginBottom: 6 }}>Aucune section chargée</div>
            <div style={{ fontSize: '0.78rem', color: '#aaa' }}>Réimportez le fichier .docx via le bouton <strong style={{ color: DARK_BLUE }}>Importer .docx</strong> pour charger le contenu.</div>
          </div>
        ) : (
          (fiche.sections || []).map((s, i) => (
            <SectionCard key={i} section={s} index={i} isFirst={i === 0} titulairesLabel={titulairesLabel} />
          ))
        )}
      </div>
    </div>
  )
  }

  // --- Layout ---
  return (
    <div style={{ minHeight: '100vh', background: LIGHT_BG }}>
      {/* Header */}
      <div style={{
        background: CARD_BG, borderBottom: `1px solid ${BORDER}`,
        padding: '14px 24px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/" style={{ color: DARK_BLUE, textDecoration: 'none', fontSize: '0.8rem', opacity: 0.6 }}>← Accueil</Link>
          <span style={{ color: '#ccc' }}>|</span>
          <FileText size={18} style={{ color: DARK_BLUE }} />
          <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: DARK_BLUE }}>
            Fiches de Poste
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {ficheAffichee && (
            <button
              onClick={() => exportPDF(ficheAffichee)}
              disabled={exporting}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                background: DARK_BLUE, color: '#fff', border: 'none', borderRadius: 8,
                cursor: exporting ? 'wait' : 'pointer', fontSize: '0.8rem', fontWeight: 700,
                opacity: exporting ? 0.7 : 1,
              }}
            >
              <Download size={13} /> {exporting ? 'Export…' : 'Télécharger PDF'}
            </button>
          )}
          {isFullAccess && !personalMode && (
            <button
              onClick={() => setShowImport(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                background: '#3b5fc0', color: '#fff', border: 'none', borderRadius: 8,
                cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700,
              }}
            >
              <Upload size={13} /> Importer .docx
            </button>
          )}
        </div>
      </div>

      {/* Corps */}
      <div style={{ maxWidth: canBrowse ? 1100 : 780, margin: '0 auto', padding: '28px 20px' }}>
        {!user && (
          <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>Connexion requise.</div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>Chargement…</div>
        )}

        {!loading && error && (
          <div style={{ background: '#fff3f3', border: '1px solid #f5c6cb', borderRadius: 10, padding: 20, color: '#721c24' }}>
            {error}
          </div>
        )}

        {/* Onglets (RH/ADMIN/PCA/AG hors mode personnel) */}
        {!loading && !error && showTabs && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `2px solid ${BORDER}` }}>
            {[
              { key: 'mine',   label: 'Ma fiche'         },
              { key: 'manage', label: 'Gérer les fiches' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  padding: '10px 18px', border: 'none', background: 'transparent',
                  fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                  color: tab === t.key ? DARK_BLUE : '#7a8aa3',
                  borderBottom: tab === t.key ? `3px solid ${DARK_BLUE}` : '3px solid transparent',
                  marginBottom: -2,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Vue Ma fiche : EMPLOYE, mode personnel, ou onglet Ma fiche */}
        {!loading && !error && (personalMode || !canBrowse || (showTabs && tab === 'mine')) && (
          <>
            {maFiche ? (
              <SectionsDisplay fiche={maFiche} />
            ) : (
              <div style={{
                background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12,
                padding: 40, textAlign: 'center', color: '#888',
              }}>
                <FileText size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                <div style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 8 }}>
                  Aucune fiche de poste disponible
                </div>
                <div style={{ fontSize: '0.82rem' }}>
                  La fiche correspondant à votre fonction n'a pas encore été renseignée.
                </div>
              </div>
            )}
          </>
        )}

        {/* Vue gestion (FullAccess sans mode perso onglet manage) ou scope (DG/Dir/Resp) */}
        {!loading && !error && !personalMode && canBrowse && (!showTabs || tab === 'manage') && (
          <div style={{ display: 'flex', gap: 20 }}>
            {/* Colonne gauche : liste */}
            <div style={{ width: 280, flexShrink: 0 }}>
              <div style={{
                background: CARD_BG, border: `1px solid ${BORDER}`,
                borderRadius: 12, padding: 14,
              }}>
                <div style={{
                  fontSize: '0.75rem', fontWeight: 700, color: DARK_BLUE,
                  textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
                }}>
                  {fiches.length} fiche(s)
                </div>
                {fiches.length === 0 ? (
                  <div style={{ color: '#aaa', fontSize: '0.82rem', textAlign: 'center', padding: '20px 0' }}>
                    Aucune fiche disponible
                  </div>
                ) : (
                  fiches.map(f => (
                    <FicheListItem
                      key={f.id_template}
                      fiche={f}
                      selected={selected?.id_template === f.id_template}
                      onClick={() => setSelected(f)}
                      onDelete={isFullAccess ? handleDelete : null}
                      onReassign={isFullAccess ? () => setReassigning(f) : null}
                      onReimported={updated => {
                        setFiches(prev => prev.map(x => x.id_template === updated.id_template ? { ...x, ...updated } : x))
                        setSelected(updated)
                      }}
                      canImport={isFullAccess}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Colonne droite : aperçu */}
            <div style={{ flex: 1 }}>
              {selected ? (
                <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
                  <SectionsDisplay fiche={selected} />
                </div>
              ) : (
                <div style={{
                  background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12,
                  padding: 60, textAlign: 'center', color: '#aaa',
                }}>
                  <Eye size={36} style={{ opacity: 0.3, marginBottom: 12 }} />
                  <div style={{ fontSize: '0.88rem' }}>Sélectionnez une fiche pour la visualiser</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CSS pour le rendu HTML mammoth (fid\u00e9lit\u00e9 visuelle .docx) */}
      <style>{`
        .fiche-html-content { font-family: 'Century Gothic',CenturyGothic,'AppleGothic',sans-serif; color:#1a1a1a; line-height:1.55; font-size:0.92rem; }
        .fiche-html-content h1, .fiche-html-content h2, .fiche-html-content h3 {
          color:${DARK_BLUE}; font-weight:800; margin:18px 0 8px;
          padding-bottom:4px; border-bottom:2px solid #c00000;
        }
        .fiche-html-content h1 { font-size:1.05rem; }
        .fiche-html-content h2 { font-size:0.98rem; }
        .fiche-html-content h3 { font-size:0.92rem; }
        .fiche-html-content p { margin:6px 0; }
        .fiche-html-content table {
          border-collapse:collapse; width:100%; margin:10px 0; font-size:0.86rem;
        }
        .fiche-html-content table td, .fiche-html-content table th {
          border:1px solid #b7c0d4; padding:7px 10px; vertical-align:top;
        }
        .fiche-html-content table th, .fiche-html-content table tr:first-child td {
          background:${DARK_BLUE}; color:#fff; font-weight:700;
        }
        .fiche-html-content table tr:nth-child(even) td { background:#f4f6fb; }
        .fiche-html-content table tr:nth-child(even):first-child td { background:${DARK_BLUE}; }
        .fiche-html-content ul, .fiche-html-content ol { margin:6px 0 8px 22px; }
        .fiche-html-content li { margin:3px 0; }
        .fiche-html-content strong { color:${DARK_BLUE}; }
        .fiche-html-content .fp-red, .fiche-html-content span.fp-red { color:#c00000 !important; font-weight:600; }
        .fiche-html-content .fp-red *, .fiche-html-content span.fp-red * { color:#c00000 !important; }
        .fiche-html-content img { display:none; }
      `}</style>

      {/* Modal import */}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          currentUser={user}
          onImported={newFiche => {
            setFiches(prev => {
              const idx = prev.findIndex(f => f.fonction === newFiche.fonction)
              if (idx >= 0) {
                const next = [...prev]; next[idx] = newFiche; return next
              }
              return [...prev, newFiche].sort((a, b) => a.fonction.localeCompare(b.fonction))
            })
            setSelected(newFiche)
          }}
        />
      )}

      {/* Modal assignation des titulaires */}
      {reassigning && (
        <AssignTitulairesModal
          fiche={reassigning}
          onClose={() => setReassigning(null)}
          onUpdated={updated => {
            setFiches(prev => prev.map(f => f.id_template === updated.id_template ? updated : f))
            if (selected?.id_template === updated.id_template) setSelected(updated)
            setReassigning(null)
          }}
        />
      )}
    </div>
  )
}

