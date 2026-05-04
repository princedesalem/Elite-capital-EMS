import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { GitBranch, Search, X, ChevronDown, ChevronUp, Pencil, XCircle, MapPin, Briefcase, AlignLeft, Save, Building2, FileDown, Image as ImageIcon, FileSpreadsheet } from 'lucide-react'
import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'
import * as XLSX from 'xlsx'
import { toast } from '../components/ui/bridge'

const ACCENT = '#ce2b2b'
const DARK   = '#021630'
const LINE   = '#94a3b8'

const CSS = `
.oc-scroll { overflow-x: auto; overflow-y: auto; padding: 20px 16px 32px; min-height: 200px; }
.oc-node   { display: inline-flex; flex-direction: column; align-items: center; }
/* Garantie hiérarchique : un responsable (parent) doit toujours apparaître
   au-dessus de ses subordonnés. flex-direction:column + ordre du DOM
   (parent rendu avant .oc-row) verrouille cette règle visuellement. */
.oc-node > .oc-box { order: 0; }
.oc-node > .oc-stem { order: 1; }
.oc-node > .oc-row { order: 2; }
.oc-stem   { width: 2px; height: 18px; background: #94a3b8; flex-shrink: 0; }
.oc-row    { display: flex; flex-wrap: nowrap; }
.oc-col    { position: relative; display: flex; flex-direction: column; align-items: center; align-self: flex-start; padding: 18px 6px 0; }
.oc-col::before { content:''; position:absolute; top:0; height:2px; background:#94a3b8; }
.oc-col:only-child::before { display:none; }
.oc-col:first-child:not(:only-child)::before { left:50%; right:0; }
.oc-col:last-child:not(:only-child)::before  { left:0; right:50%; }
.oc-col:not(:first-child):not(:last-child)::before { left:0; right:0; }
.oc-col::after { content:''; position:absolute; top:0; left:50%; transform:translateX(-50%); width:2px; height:var(--oc-col-stem,18px); background:#94a3b8; }

.oc-box {
  min-width: 100px; max-width: 160px;
  height: 96px; box-sizing: border-box; overflow: hidden;
  display: flex; flex-direction: column;
  background: #fff;
  border: 1.5px solid #cdd5df;
  border-radius: 4px;
  padding: 7px 9px 6px;
  text-align: center;
  cursor: default;
  box-shadow: 0 1px 3px rgba(0,0,0,0.07);
  transition: box-shadow .15s, border-color .15s;
  flex-shrink: 0;
  user-select: none;
  position: relative;
}
.oc-box.oc-clickable { cursor: pointer; }
.oc-box.oc-clickable:hover { box-shadow: 0 3px 10px rgba(0,0,0,0.15); border-color: #021630; }
.oc-box.oc-d0 { min-width:100px; max-width:160px; border-color:#021630; border-width:2px; background:#f8f9fb; }
.oc-box.oc-d1 { border-top: 3px solid #ce2b2b; }
.oc-box.oc-hit { border-color:#ce2b2b; box-shadow: 0 0 0 2px rgba(206,43,43,.2); }
.oc-box.oc-group { border-color:#021630; background:#f0f4fa; }

.oc-label { font-weight: 700; color: #021630; font-size: 0.72rem; line-height: 1.25; margin-bottom: 2px; word-break: break-word; }
.oc-sub  { font-size: 0.62rem; color: #64748b; word-break: break-word; }
.oc-foot { display:flex; align-items:center; justify-content:space-between; margin-top: auto; padding-top:4px; border-top:1px solid #f1f5f9; font-size:0.6rem; color:#94a3b8; }

.oc-edit-btn {
  position: absolute; top: 3px; right: 3px;
  background: none; border: none; cursor: pointer; padding: 1px; line-height: 1;
  color: #94a3b8; opacity: 0; transition: opacity .15s;
}
.oc-box:hover .oc-edit-btn { opacity: 1; }
.oc-edit-btn:hover { color: #ce2b2b; }

.tab-btn { padding: 6px 11px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.78rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; transition: background .15s; white-space: nowrap; }

.ent-pill { padding: 5px 12px; border-radius: 20px; border: 1.5px solid #e2e8f0; background: white; cursor: pointer; font-size: 0.75rem; font-weight: 600; transition: all .15s; white-space: nowrap; color: #475569; }
.ent-pill:hover { border-color: #021630; color: #021630; }
.ent-pill.active { background: #021630; color: white; border-color: #021630; }

.n1-drop { position:absolute; top:100%; left:0; right:0; background:white; border:1.5px solid #e2e8f0; border-radius:7px; box-shadow:0 4px 16px rgba(0,0,0,0.12); z-index:200; max-height:220px; overflow-y:auto; margin-top:3px; }
.n1-opt { padding:8px 10px; cursor:pointer; font-size:0.82rem; border-bottom:1px solid #f1f5f9; }
.n1-opt:hover { background:#f0f4fa; color:#021630; }
.n1-opt:last-child { border-bottom:none; }
`

// --- Build N1 hierarchy -------------------------------------------------------
// Sort helper : un employé qui a des subordonnés ou un titre de "responsable"
// doit toujours apparaître AVANT les autres dans la liste de ses pairs, pour
// que le visuel reflète clairement la hiérarchie (responsable plus haut /
// plus à gauche que ses employés).
// Niveau hiérarchique par fonction : 0 = Directeur/DG/PCA, 1 = Responsable/Chef,
// 2+ = autres. Utilisé pour le tri ET pour la classe CSS du visuel afin
// qu'un Responsable n'apparaisse JAMAIS au même niveau qu'un Directeur,
// même s'il n'a pas de N1 renseigné (il serait alors une racine de l'arbre).
export function niveauFonctionnel(employe) {
  const f = String(employe?.fonction || '').toLowerCase()
  // Word boundaries pour éviter les faux positifs : "manager" contient "ag",
  // "responsable" contient "pa"... On utilise \b pour matcher les mots entiers.
  if (/\b(directeur|directrice|dg|pca|président|présidente|presidente|ag|administrateur)\b/.test(f)) return 0
  if (/\b(chef|responsable|manager|superviseur|sup|head|lead)\b/.test(f)) return 1
  return 2
}

// Calcule la rangée VISUELLE d'un nœud, en alignant les rôles entre branches :
// tous les Directeurs sur la même ligne, tous les Responsables sur la même
// ligne, tous les employés sur la même ligne — quel que soit la profondeur
// dans l'arbre N+1. La règle : row = max(parentRow + 1, niveauFonctionnel + 1).
// Pour la racine : row = niveauFonctionnel (DG sur la ligne 0).
export function computeOrgRow(node, parentRow) {
  if (parentRow == null || parentRow < 0) {
    return node?._isGroup ? 0 : niveauFonctionnel(node)
  }
  const nf = node?._isGroup ? parentRow + 1 : niveauFonctionnel(node) + 1
  return Math.max(parentRow + 1, nf)
}

function _sortByHierarchy(list) {
  const fonctionWeight = (e) => niveauFonctionnel(e) === 2 ? 5 : niveauFonctionnel(e)
  return [...list].sort((a, b) => {
    const wa = fonctionWeight(a)
    const wb = fonctionWeight(b)
    if (wa !== wb) return wa - wb
    const ca = (a.children || []).length
    const cb = (b.children || []).length
    if (ca !== cb) return cb - ca // plus d'enfants = "plus haut" dans la hiérarchie
    return String(`${a.nom || ''} ${a.prenom || ''}`).localeCompare(
      String(`${b.nom || ''} ${b.prenom || ''}`)
    )
  })
}

function buildN1Tree(emps) {
  const map = {}
  emps.forEach(e => { map[String(e.matricule)] = { ...e, _key: String(e.matricule), children: [] } })
  const roots = []
  emps.forEach(e => {
    const parent = map[String(e.n1)]
    if (e.n1 && parent && String(e.n1) !== String(e.matricule)) parent.children.push(map[String(e.matricule)])
    else roots.push(map[String(e.matricule)])
  })
  // Trier récursivement : responsable au-dessus dans chaque branche.
  const sortRec = (nodes) => {
    nodes.forEach(n => { if (n.children?.length) sortRec(n.children) })
    return _sortByHierarchy(nodes)
  }
  return sortRec(roots)
}

// --- Build group tree (group ? members) --------------------------------------
function buildGroupTree(emps, getGroup) {
  const groups = {}
  emps.forEach(e => {
    const g = getGroup(e) || 'Non renseigné'
    if (!groups[g]) groups[g] = []
    groups[g].push(e)
  })
  return Object.entries(groups)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([g, members]) => {
      // Trier les membres : responsable / chef en haut, puis subordonnés.
      const sorted = _sortByHierarchy(
        members.map(e => ({ ...e, _key: String(e.matricule), children: [] }))
      )
      return {
        _key: `grp_${g}`,
        _isGroup: true,
        nom: g,
        prenom: '',
        fonction: members.length + ' employé' + (members.length !== 1 ? 's' : ''),
        ville: null,
        children: sorted,
      }
    })
}

// --- Search helpers -----------------------------------------------------------
function hits(employees, q) {
  if (!q) return new Set()
  const ql = q.toLowerCase()
  const s = new Set()
  employees.forEach(e => {
    if (
      `${e.prenom} ${e.nom}`.toLowerCase().includes(ql) ||
      String(e.matricule).includes(ql) ||
      (e.fonction || '').toLowerCase().includes(ql) ||
      (e.ville || '').toLowerCase().includes(ql)
    ) s.add(String(e.matricule))
  })
  return s
}

function nodeHasHit(node, hitSet) {
  if (hitSet.has(String(node._key || node.matricule))) return true
  return (node.children || []).some(c => nodeHasHit(c, hitSet))
}

// --- Box ----------------------------------------------------------------------
function Box({ node, depth, collapsed, hasChildren, onToggle, hitSet, onEdit, editMode, viewMode }) {
  const personName = `${node.prenom || ''} ${node.nom || ''}`.trim()
  const label = node._isGroup
    ? node.nom
    : (viewMode === 'fonction' ? (node.fonction || '—') : personName)
  const subtitle = node._isGroup
    ? null
    : (viewMode === 'fonction' ? null : (node.fonction || null))

  const isHit = hitSet ? hitSet.has(String(node._key || node.matricule)) : false
  // Niveau visuel : on utilise la fonction (rôle) plutôt que la profondeur dans
  // l'arbre N1. Sinon un Responsable sans N1 (racine de l'arbre, depth=0)
  // hérite du style "Directeur" (oc-d0). Pour les groupes, on garde la
  // logique par profondeur car ce ne sont pas des employés.
  const niveauVisuel = node._isGroup ? depth : niveauFonctionnel(node)
  const cls = [
    'oc-box',
    hasChildren ? 'oc-clickable' : '',
    niveauVisuel === 0 ? 'oc-d0' : niveauVisuel === 1 ? 'oc-d1' : '',
    node._isGroup ? 'oc-group' : '',
    isHit ? 'oc-hit' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={cls} onClick={hasChildren ? onToggle : undefined} title={label}>
      {editMode && !node._isGroup && (
        <button
          className="oc-edit-btn"
          onClick={e => { e.stopPropagation(); onEdit && onEdit(node) }}
          title="Modifier"
        >
          <Pencil size={10} />
        </button>
      )}
      <div className="oc-label">{label || '—'}</div>
      {node._isGroup
        ? <div className="oc-sub" style={{ color: ACCENT }}>{node.fonction}</div>
        : subtitle && <div className="oc-sub">{subtitle}</div>
      }
      {!node._isGroup && node.ville && (
        <div className="oc-sub" style={{ color: ACCENT, fontSize: '0.58rem' }}>{node.ville}</div>
      )}
      {hasChildren && (
        <div className="oc-foot">
          <span>{node.children.length}?</span>
          <span>{collapsed ? <ChevronDown size={11} /> : <ChevronUp size={11} />}</span>
        </div>
      )}
    </div>
  )
}

// --- TreeNode -----------------------------------------------------------------
function TreeNode({ node, depth = 0, myRow = null, hitSet, expandOverride, onEdit, editMode, viewMode }) {
  const startCollapsed = depth >= 2
  const [collapsed, setCollapsed] = useState(startCollapsed)
  const hasChildren = (node.children || []).length > 0

  useEffect(() => {
    if (expandOverride === 'all')   setCollapsed(false)
    if (expandOverride === 'reset') setCollapsed(startCollapsed)
  }, [expandOverride])

  // LEVEL_PX = BOX_HEIGHT + 2 × stem (18px each) = 96 + 36 = 132.
  // Avec des boîtes de hauteur fixe (96px), cette valeur garantit que
  // les boîtes au même niveau fonctionnel s'alignent parfaitement
  // entre toutes les branches, quel que soit leur profondeur dans l'arbre.
  const LEVEL_PX = 132
  const resolvedRow = myRow == null ? computeOrgRow(node, -1) : myRow

  return (
    <div className="oc-node">
      <Box
        node={node} depth={depth} collapsed={collapsed} hasChildren={hasChildren}
        onToggle={() => setCollapsed(c => !c)} hitSet={hitSet}
        onEdit={onEdit} editMode={editMode} viewMode={viewMode}
      />
      {hasChildren && !collapsed && (
        <>
          <div className="oc-stem" />
          <div className="oc-row">
            {node.children.map((child) => {
              const cRow = computeOrgRow(child, resolvedRow)
              const extra = cRow - (resolvedRow + 1)
              const stemH = 18 + Math.max(0, extra) * LEVEL_PX
              // On force toujours --oc-col-stem (m\u00eame quand extra=0) pour
              // \u00e9viter l'h\u00e9ritage d'une valeur plus grande venant d'un anc\u00eatre :
              // sinon le trait ::after d'un enfant peut d\u00e9border sous sa bo\u00eete.
              const colStyle = extra > 0
                ? { paddingTop: stemH, '--oc-col-stem': `${stemH}px` }
                : { '--oc-col-stem': '18px' }
              return (
                <div key={child._key || child.matricule} className="oc-col" style={colStyle}>
                  <TreeNode
                    node={child} depth={depth + 1} myRow={cRow} hitSet={hitSet}
                    expandOverride={expandOverride} onEdit={onEdit} editMode={editMode} viewMode={viewMode}
                  />
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// --- Edit Modal ---------------------------------------------------------------
function EditModal({ emp, allEmployees, onClose, onSave }) {
  const [form, setForm] = useState({
    fonction: emp.fonction || '',
    ville:    emp.ville || '',
    entite:   emp.nom_entite || emp.entite || '',
  })
  const [n1Search, setN1Search] = useState('')
  const [showDrop, setShowDrop] = useState(false)
  const [selectedN1, setSelectedN1] = useState(() => {
    if (emp.n1 == null || emp.n1 === '') return null
    return allEmployees.find(e => String(e.matricule) === String(emp.n1)) || null
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const dropRef = useRef(null)

  useEffect(() => {
    const handler = e => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setShowDrop(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredN1 = allEmployees
    .filter(e => String(e.matricule) !== String(emp.matricule))
    .filter(e => {
      if (!n1Search) return true
      const q = n1Search.toLowerCase()
      return `${e.prenom} ${e.nom}`.toLowerCase().includes(q) || String(e.matricule).includes(q)
    })
    .slice(0, 40)

  const handleSave = async () => {
    setSaving(true); setErr('')
    try {
      const payload = {}
      // Matricule est alphanumérique côté backend → on garde une string (ou null)
      const newN1 = selectedN1 ? String(selectedN1.matricule) : null
      const oldN1 = emp.n1 != null && emp.n1 !== '' ? String(emp.n1) : null
      if (newN1 !== oldN1) {
        payload.n1 = newN1
        // Synchronise n1_fonction pour que le modal de détail employé
        // affiche immédiatement la nouvelle fonction du supérieur.
        payload.n1_fonction = selectedN1?.fonction ? String(selectedN1.fonction) : null
      }
      if (form.fonction !== (emp.fonction || ''))      payload.fonction = form.fonction
      if (form.ville    !== (emp.ville || ''))         payload.ville    = form.ville
      if (form.entite   !== (emp.nom_entite || emp.entite || '')) {
        payload.nom_entite = form.entite
        payload.entite     = form.entite
      }
      if (Object.keys(payload).length)
        await api.put(`/employees/${emp.matricule}`, payload)
      onSave({
        ...emp,
        ...form,
        nom_entite: form.entite,
        entite: form.entite,
        n1: newN1,
        n1_fonction: selectedN1?.fonction || null,
        n1_nom: selectedN1 ? `${selectedN1.prenom || ''} ${selectedN1.nom || ''}`.trim() : null,
      })
      toast.success('Modifications enregistrées')
    } catch (e) {
      // FastAPI 422 renvoie un tableau d'objets {type,loc,msg,input} → ne pas le rendre directement (React crashe)
      const detail = e?.response?.data?.detail
      let msg = 'Erreur lors de la sauvegarde'
      if (typeof detail === 'string') msg = detail
      else if (Array.isArray(detail)) msg = detail.map(d => d?.msg || JSON.stringify(d)).join(' ; ')
      else if (detail && typeof detail === 'object') msg = detail.msg || JSON.stringify(detail)
      setErr(msg)
      toast.error(msg)
    } finally { setSaving(false) }
  }

  const currentN1Label = selectedN1
    ? `${selectedN1.prenom} ${selectedN1.nom} — #${selectedN1.matricule}`
    : 'Aucun supérieur hiérarchique'

  // find subordinates of this employee (people whose n1 = emp.matricule)
  const subs = allEmployees.filter(e => String(e.n1) === String(emp.matricule))

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--card)', borderRadius:12, padding:'22px 26px', width:420, maxWidth:'95vw', boxShadow:'0 8px 32px rgba(0,0,0,0.22)', maxHeight:'90vh', overflowY:'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
          <div>
            <h3 style={{ margin:0, color:DARK, fontSize:'1rem', fontWeight:800 }}>{emp.prenom} {emp.nom}</h3>
            <div style={{ fontSize:'0.74rem', color:'#94a3b8', marginTop:2 }}>Matricule #{emp.matricule}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:2 }}>
            <XCircle size={18} />
          </button>
        </div>

        {err && (
          <div style={{ background:'#fef2f2', color:'#991b1b', borderRadius:6, padding:'8px 12px', marginBottom:12, fontSize:'0.82rem' }}>
            {err}
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* N+1 searchable dropdown */}
          <div>
            <label style={{ fontSize:'0.8rem', fontWeight:700, color:'#334155', display:'block', marginBottom:5 }}>
              Supérieur hiérarchique (N+1)
            </label>
            <div style={{ position:'relative' }} ref={dropRef}>
              <div
                onClick={() => setShowDrop(v => !v)}
                style={{
                  padding:'8px 10px', border:`1.5px solid ${showDrop ? DARK : '#d1d5db'}`, borderRadius:7,
                  cursor:'pointer', fontSize:'0.82rem', color: selectedN1 ? DARK : '#94a3b8',
                  display:'flex', justifyContent:'space-between', alignItems:'center', background: 'var(--card)'
                }}
              >
                <span>{currentN1Label}</span>
                <ChevronDown size={13} style={{ color:'#94a3b8', flexShrink:0 }} />
              </div>
              {showDrop && (
                <div className="n1-drop">
                  <div style={{ padding:'6px 8px', borderBottom:'1px solid #f1f5f9', position:'sticky', top:0, background: 'var(--card)' }}>
                    <input
                      autoFocus
                      value={n1Search}
                      onChange={e => setN1Search(e.target.value)}
                      placeholder="Rechercher par nom ou matricule..."
                      style={{ width:'100%', padding:'5px 8px', border: '1px solid var(--border)', borderRadius:5, fontSize:'0.8rem', boxSizing:'border-box', outline:'none' }}
                      onClick={e => e.stopPropagation()}
                    />
                  </div>
                  <div
                    className="n1-opt"
                    style={{ color: ACCENT, fontWeight:700 }}
                    onClick={() => { setSelectedN1(null); setShowDrop(false); setN1Search('') }}
                  >
                    — Aucun supérieur (racine)
                  </div>
                  {filteredN1.map(e => (
                    <div
                      key={e.matricule}
                      className="n1-opt"
                      onClick={() => { setSelectedN1(e); setShowDrop(false); setN1Search('') }}
                      style={{ background: selectedN1 && String(selectedN1.matricule) === String(e.matricule) ? '#f0f4fa' : undefined }}
                    >
                      <div style={{ fontWeight:600, color: DARK }}>{e.prenom} {e.nom}</div>
                      <div style={{ fontSize:'0.72rem', color:'#64748b', display:'flex', gap:8, marginTop:1 }}>
                        <span>#{e.matricule}</span>
                        {e.fonction && <span>{e.fonction}</span>}
                        {e.ville && <span style={{ color: ACCENT }}>{e.ville}</span>}
                      </div>
                    </div>
                  ))}
                  {filteredN1.length === 0 && n1Search && (
                    <div style={{ padding:'10px', color:'#94a3b8', fontSize:'0.8rem', textAlign:'center' }}>{"Aucun résultat"}</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Subordinates info */}
          {subs.length > 0 && (
            <div style={{ background:'#f8f9fb', borderRadius:7, padding:'10px 12px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize:'0.78rem', fontWeight:700, color:DARK, marginBottom:6 }}>
                Subordonnés directs ({subs.length})
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                {subs.map(s => (
                  <span key={s.matricule} style={{ background:'#e8eef5', color:'#0a2847', borderRadius:20, padding:'2px 9px', fontSize:'0.7rem', fontWeight:600 }}>
                    {s.prenom} {s.nom}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Fonction */}
          <label style={{ fontSize:'0.8rem', fontWeight:700, color:'#334155' }}>
            Fonction / Poste
            <input
              value={form.fonction}
              onChange={e => setForm(f => ({ ...f, fonction: e.target.value }))}
              placeholder="Directeur, Manager, Chef de service..."
              style={{ display:'block', width:'100%', marginTop:4, padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:6, fontSize:'0.85rem', boxSizing:'border-box', outline:'none' }}
            />
          </label>

          {/* Ville */}
          <label style={{ fontSize:'0.8rem', fontWeight:700, color:'#334155' }}>
            Ville
            <input
              value={form.ville}
              onChange={e => setForm(f => ({ ...f, ville: e.target.value }))}
              placeholder="Yaoundé, Douala, Bafoussam..."
              style={{ display:'block', width:'100%', marginTop:4, padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:6, fontSize:'0.85rem', boxSizing:'border-box', outline:'none' }}
            />
          </label>

          {/* Entité */}
          <label style={{ fontSize:'0.8rem', fontWeight:700, color:'#334155' }}>
            Entité
            <input
              value={form.entite}
              onChange={e => setForm(f => ({ ...f, entite: e.target.value }))}
              placeholder="Nom de l'entité..."
              style={{ display:'block', width:'100%', marginTop:4, padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:6, fontSize:'0.85rem', boxSizing:'border-box', outline:'none' }}
            />
          </label>
        </div>

        <div style={{ display:'flex', gap:8, marginTop:20, justifyContent:'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding:'8px 16px', background: 'var(--bg)', border:'none', borderRadius:7, cursor:'pointer', fontWeight:600, fontSize:'0.82rem', color:'#64748b' }}
          >{"Annuler"}</button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding:'8px 16px', background:DARK, color:'white', border:'none', borderRadius:7, cursor:'pointer', fontWeight:700, fontSize:'0.82rem', display:'flex', alignItems:'center', gap:5, opacity: saving ? 0.7 : 1 }}
          >
            <Save size={13} /> {saving ? '...' : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Main ---------------------------------------------------------------------
export default function OrgChart() {
  const { user } = useAuth()
  const isAdmin = ['RH', 'DG', 'PCA', 'ADMIN'].includes(user?.role || '')

  const [employees, setEmployees]       = useState([])
  const [loading, setLoading]           = useState(true)
  const [selectedEntity, setSelectedEntity] = useState('Tous')
  const [view, setView]                 = useState('hierarchie')
  const [searchQ, setSearchQ]           = useState('')
  const [expandOverride, setExpand]     = useState(null)
  const [editMode, setEditMode]         = useState(false)
  const [editEmp, setEditEmp]           = useState(null)

  // Référence vers la zone scrollable de l'arbre, utilisée par les exports
  // PDF (impression) et PNG (capture html-to-image).
  const treeRef = useRef(null)
  // Menu « ... » d'exports : ouvert/fermé + ref pour détecter clic extérieur
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const exportMenuRef = useRef(null)
  useEffect(() => {
    if (!exportMenuOpen) return
    const onDocClick = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setExportMenuOpen(false)
      }
    }
    const onEsc = (e) => { if (e.key === 'Escape') setExportMenuOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [exportMenuOpen])

  useEffect(() => {
    api.get('/employees/')
      .then(r => setEmployees(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = useCallback((updated) => {
    setEmployees(prev =>
      prev.map(e => String(e.matricule) === String(updated.matricule) ? { ...e, ...updated } : e)
    )
    setEditEmp(null)
  }, [])

  // Entity list from employees
  const entities = useMemo(() => {
    const ents = new Set(
      employees
        .map(e => e.nom_entite || e.entite || '')
        .filter(Boolean)
    )
    return ['Tous', ...Array.from(ents).sort()]
  }, [employees])

  // Filter by selected entity
  const filteredEmps = useMemo(() => {
    if (selectedEntity === 'Tous') return employees
    return employees.filter(e =>
      (e.nom_entite || e.entite || '') === selectedEntity
    )
  }, [employees, selectedEntity])

  // --- Exports organigramme -------------------------------------------------
  // PDF : capture le sous-arbre en PNG via html-to-image, puis intègre
  // l'image dans un PDF A3 paysage avec jsPDF et force le téléchargement.
  const exportPDF = useCallback(async () => {
    const node = treeRef.current
    if (!node) { toast.error?.('Arbre non disponible'); return }
    try {
      const dataUrl = await toPng(node, { backgroundColor: '#ffffff', pixelRatio: 2 })
      const img = new Image()
      img.src = dataUrl
      await new Promise(res => { img.onload = res })
      // A3 paysage en mm : 420 × 297
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const margin = 10
      const maxW = pageW - margin * 2
      const maxH = pageH - margin * 2 - 12  // 12 mm réservé pour le titre
      const ratio = Math.min(maxW / img.width, maxH / img.height)
      const drawW = img.width * ratio
      const drawH = img.height * ratio
      const x = margin + (maxW - drawW) / 2
      // Titre
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(13)
      pdf.text(`Organigramme — ${selectedEntity}`, margin, margin + 7)
      // Image
      pdf.addImage(dataUrl, 'PNG', x, margin + 12, drawW, drawH)
      pdf.save(`organigramme_${selectedEntity}.pdf`.replace(/\s+/g, '_'))
    } catch (e) {
      toast.error?.('Échec de l\'export PDF')
    }
  }, [selectedEntity])

  // PNG : capture le sous-arbre via html-to-image puis force le téléchargement.
  const exportPNG = useCallback(async () => {
    const node = treeRef.current
    if (!node) { toast.error?.('Arbre non disponible'); return }
    try {
      const dataUrl = await toPng(node, { backgroundColor: '#ffffff', pixelRatio: 2 })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `organigramme_${selectedEntity}.png`.replace(/\s+/g, '_')
      a.click()
    } catch (e) {
      toast.error?.('Échec de l’export PNG')
    }
  }, [selectedEntity])

  // Excel : exporte la liste plate des employés visibles (filtre entité courant).
  const exportExcel = useCallback(() => {
    if (!filteredEmps || filteredEmps.length === 0) {
      toast.error?.('Aucune donnée à exporter'); return
    }
    const rows = filteredEmps.map(e => ({
      Matricule: e.matricule || '',
      Nom: e.nom || '',
      Fonction: e.fonction || '',
      Direction: e.nom_direction || e.direction || '',
      Entité: e.nom_entite || e.entite || '',
      Ville: e.ville || '',
      Email: e.email || '',
      'Responsable (N+1)': e.n1 || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Organigramme')
    XLSX.writeFile(wb, `organigramme_${selectedEntity}.xlsx`.replace(/\s+/g, '_'))
  }, [filteredEmps, selectedEntity])
  // -------------------------------------------------------------------------

  // Trees
  const n1Tree = useMemo(() => {
    const withN1 = filteredEmps.filter(e => e.n1 != null && e.n1 !== '').length
    if (withN1 > filteredEmps.length * 0.2) return buildN1Tree(filteredEmps)
    // fallback: group by direction
    return buildGroupTree(filteredEmps, e => e.nom_direction || e.direction || 'Sans direction')
  }, [filteredEmps])

  const villeTree    = useMemo(() => buildGroupTree(filteredEmps, e => e.ville),    [filteredEmps])

  const nomList = useMemo(() =>
    filteredEmps
      .filter(e => {
        if (!searchQ) return true
        const q = searchQ.toLowerCase()
        return (
          `${e.prenom} ${e.nom}`.toLowerCase().includes(q) ||
          String(e.matricule).includes(q) ||
          (e.fonction || '').toLowerCase().includes(q) ||
          (e.ville || '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom, 'fr'))
  , [filteredEmps, searchQ])

  const hitSet = useMemo(() => hits(filteredEmps, searchQ), [filteredEmps, searchQ])

  const activeTree =
    view === 'hierarchie' ? n1Tree :
    view === 'fonction'   ? n1Tree :
    view === 'ville'      ? villeTree : []

  const visibleRoots = useMemo(() => {
    if (!searchQ || view === 'nom') return activeTree
    return activeTree.filter(n => nodeHasHit(n, hitSet))
  }, [activeTree, searchQ, hitSet, view])

  const doExpand = v => { setExpand(v); setTimeout(() => setExpand(null), 60) }

  const VIEWS = [
    { key: 'hierarchie', icon: <GitBranch size={12} />, label: 'Hiérarchie' },
    { key: 'fonction',   icon: <Briefcase size={12} />, label: 'Par fonction' },
    { key: 'ville',      icon: <MapPin    size={12} />, label: 'Par ville' },
    { key: 'nom',        icon: <AlignLeft size={12} />, label: 'Par nom' },
  ]

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
      {"Chargement..."}
    </div>
  )

  return (
    <div style={{ paddingBottom: 16 }}>
      <style>{CSS}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(90deg, #02162e 0%, #02162e 50%, #0a2e57 72%, #274a73 100%)', color: 'white', padding: '14px 18px', borderRadius: 10, marginBottom: 10 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
          <div>
            <h1 style={{ margin:0, fontSize:'1.1rem', fontWeight:800, display:'flex', alignItems:'center', gap:7 }}>
              <GitBranch size={18} /> Organigramme
            </h1>
            <p style={{ margin:'3px 0 0', fontSize:'0.78rem', opacity:0.8 }}>
              {selectedEntity === 'Tous'
                ? `${employees.length} employés — toutes entités`
                : `${filteredEmps.length} employés — ${selectedEntity}`}
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setEditMode(v => !v)}
              style={{
                display:'inline-flex', alignItems:'center', gap:5,
                padding:'7px 13px',
                background: editMode ? ACCENT : 'rgba(255,255,255,0.15)',
                color:'white', border:'1px solid rgba(255,255,255,0.3)',
                borderRadius:7, cursor:'pointer', fontWeight:700, fontSize:'0.8rem'
              }}
            >
              <Pencil size={13} /> {editMode ? 'Mode édition ON' : "Modifier l'organigramme"}
            </button>
          )}
        </div>
      </div>

      {/* Entity filter pills */}
      {entities.length > 1 && (
        <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap', alignItems:'center' }}>
          <Building2 size={13} style={{ color:'#94a3b8', flexShrink:0 }} />
          {entities.map(ent => (
            <button
              key={ent}
              className={`ent-pill${selectedEntity === ent ? ' active' : ''}`}
              onClick={() => setSelectedEntity(ent)}
            >
              {ent === 'Tous' ? 'Toutes les entités' : ent}
            </button>
          ))}
        </div>
      )}

      {/* View + Search controls */}
      <div style={{ display:'flex', gap:7, marginBottom:10, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', background: 'var(--bg)', borderRadius:8, padding:3, gap:2, flexWrap:'wrap' }}>
          {VIEWS.map(v => (
            <button
              key={v.key}
              className="tab-btn"
              onClick={() => setView(v.key)}
              style={{
                background: view === v.key ? 'white' : 'transparent',
                color: view === v.key ? DARK : '#64748b',
                boxShadow: view === v.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {v.icon} {v.label}
            </button>
          ))}
        </div>

        <div style={{ position:'relative', flex:1, maxWidth:220 }}>
          <Search size={12} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'#94a3b8', pointerEvents:'none' }} />
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Rechercher…"
            style={{ width:'100%', padding:'6px 28px', border: '1px solid var(--border)', borderRadius:7, fontSize:'0.8rem', boxSizing:'border-box', outline:'none' }}
          />
          {searchQ && (
            <button onClick={() => setSearchQ('')} style={{ position:'absolute', right:7, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', padding:1, color:'#94a3b8', display:'flex' }}>
              <X size={12} />
            </button>
          )}
        </div>

        {view !== 'nom' && (
          <>
            <button onClick={() => doExpand('all')} style={{ padding:'5px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius:6, cursor:'pointer', fontSize:'0.75rem', color:'#475569', fontWeight:600 }}>
              ? Tout développer
            </button>
            <button onClick={() => doExpand('reset')} style={{ padding:'5px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius:6, cursor:'pointer', fontSize:'0.75rem', color:'#475569', fontWeight:600 }}>
              ↺ {"Réinitialiser"}
            </button>
            <div ref={exportMenuRef} style={{ position:'relative' }}>
              <button
                title="Exporter"
                aria-label="Exporter"
                aria-haspopup="menu"
                aria-expanded={exportMenuOpen}
                onClick={() => setExportMenuOpen(o => !o)}
                style={{ padding:'5px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius:6, cursor:'pointer', fontSize:'0.85rem', color:'#475569', fontWeight:700, lineHeight:1 }}
              >
                ⋯
              </button>
              {exportMenuOpen && (
                <div role="menu" style={{ position:'absolute', top:'calc(100% + 4px)', right:0, background:'var(--card,#fff)', border:'1px solid var(--border,#e2e8f0)', borderRadius:8, boxShadow:'0 6px 20px rgba(0,0,0,0.10)', minWidth:170, zIndex:50, padding:4 }}>
                  <button role="menuitem" aria-label="Exporter en PDF" onClick={() => { setExportMenuOpen(false); exportPDF() }} style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'7px 10px', background:'none', border:'none', cursor:'pointer', fontSize:'0.8rem', color:'#021630', textAlign:'left', borderRadius:6 }} onMouseEnter={e => e.currentTarget.style.background='#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background='none'}>
                    <FileDown size={14} /> Exporter en PDF
                  </button>
                  <button role="menuitem" aria-label="Exporter en PNG" onClick={() => { setExportMenuOpen(false); exportPNG() }} style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'7px 10px', background:'none', border:'none', cursor:'pointer', fontSize:'0.8rem', color:'#021630', textAlign:'left', borderRadius:6 }} onMouseEnter={e => e.currentTarget.style.background='#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background='none'}>
                    <ImageIcon size={14} /> Exporter en PNG
                  </button>
                  <button role="menuitem" aria-label="Exporter en Excel" onClick={() => { setExportMenuOpen(false); exportExcel() }} style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'7px 10px', background:'none', border:'none', cursor:'pointer', fontSize:'0.8rem', color:'#021630', textAlign:'left', borderRadius:6 }} onMouseEnter={e => e.currentTarget.style.background='#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background='none'}>
                    <FileSpreadsheet size={14} /> Exporter en Excel
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Tree views */}
      {view !== 'nom' && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
          {visibleRoots.length === 0 ? (
            <div style={{ textAlign:'center', padding:32, color:'#94a3b8', fontSize:'0.85rem' }}>
              {searchQ ? `Aucun résultat pour « ${searchQ} »` : "Aucune donnée"}
            </div>
          ) : (
            <div className="oc-scroll" ref={treeRef}>
              <div style={{ display:'flex', gap:32, flexWrap:'wrap', justifyContent:'center' }}>
                {visibleRoots.map(root => (
                  <TreeNode
                    key={root._key || root.matricule}
                    node={root} depth={0}
                    hitSet={hitSet} expandOverride={expandOverride}
                    onEdit={setEditEmp} editMode={editMode}
                    viewMode={view}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Par nom */}
      {view === 'nom' && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius:10, padding:'14px 16px' }}>
          {nomList.length === 0 ? (
            <div style={{ textAlign:'center', padding:24, color:'#94a3b8' }}>{"Aucun résultat"}</div>
          ) : (
            <>
              <div style={{ fontSize:'0.75rem', color:'#94a3b8', marginBottom:10, fontWeight:600 }}>
                {nomList.length} employés — ordre alphabétique
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:7 }}>
                {nomList.map(e => {
                  const isHit = hitSet.has(String(e.matricule))
                  return (
                    <div
                      key={e.matricule}
                      style={{
                        background: 'var(--card)', borderRadius:6, padding:'8px 10px', position:'relative',
                        border: `1.5px solid ${isHit ? ACCENT : '#dde2ea'}`,
                        boxShadow: isHit ? `0 0 0 2px rgba(206,43,43,.18)` : '0 1px 3px rgba(0,0,0,0.06)',
                      }}
                    >
                      {editMode && (
                        <button
                          onClick={() => setEditEmp(e)}
                          style={{ position:'absolute', top:4, right:4, background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:1 }}
                          title="Modifier"
                        >
                          <Pencil size={11} />
                        </button>
                      )}
                      <div style={{ fontWeight:700, color:DARK, fontSize:'0.78rem', marginBottom:2, paddingRight: editMode ? 16 : 0 }}>
                        {e.prenom} {e.nom}
                      </div>
                      {e.fonction && (
                        <div style={{ fontSize:'0.66rem', color:'#64748b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {e.fonction}
                        </div>
                      )}
                      <div style={{ marginTop:4, display:'flex', gap:4, flexWrap:'wrap' }}>
                        {e.ville && (
                          <span style={{ background:'#e8eef5', color:'#0a2847', borderRadius:20, padding:'1px 7px', fontSize:'0.6rem', fontWeight:600 }}>
                            {e.ville}
                          </span>
                        )}
                        <span style={{ background: 'var(--bg)', color:'#475569', borderRadius:20, padding:'1px 7px', fontSize:'0.6rem', fontWeight:600 }}>
                          #{e.matricule}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {editEmp && (
        <EditModal
          emp={editEmp}
          allEmployees={employees}
          onClose={() => setEditEmp(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
