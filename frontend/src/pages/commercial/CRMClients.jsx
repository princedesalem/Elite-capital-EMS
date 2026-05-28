import React, { useEffect, useState, useCallback, useRef } from 'react'
import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { Plus, Edit3, Trash2, X, Search, Upload, Download, Building2, RotateCcw, CheckSquare } from 'lucide-react'
import { BRAND_GRADIENT, BRAND_NAVY, BRAND_RED } from '../../theme'

const READONLY = ['DG', 'PCA', 'AG', 'ADMIN']

const emptyClient = {
  raison_sociale: '',
  type: 'PROSPECT',
  type_personne: '',
  forme_juridique: '',
  num_compte: '',
  pole: '',
  fcp_type: 'AUCUN',
  date_entree_fcp: '',
  secteur_activite: '',
  capacite_financiere: '',
  contact_principal: '',
  fonction_contact: '',
  email: '',
  telephone: '',
  employeur: '',
  adresse: '',
  ville: '',
  pays: '',
  charge_matricule: '',
  gestionnaire_matricule: '',
  notes: '',
}

export default function CRMClients() {
  const { user } = useAuth()
  const role = String(user?.role || '').toUpperCase()
  const isReadOnly = READONLY.includes(role)

  const [clients, setClients] = useState([])
  const [referentiels, setReferentiels] = useState({ POLE: [], SECTEUR: [], TYPE_CLIENT: [] })
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyClient)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [importing, setImporting] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [lastImport, setLastImport] = useState(() => {
    try { return JSON.parse(localStorage.getItem('crm_last_import') || 'null') } catch { return null }
  })
  const fileInputRef = useRef(null)

  // Persiste lastImport dans localStorage
  useEffect(() => {
    if (lastImport) localStorage.setItem('crm_last_import', JSON.stringify(lastImport))
    else localStorage.removeItem('crm_last_import')
  }, [lastImport])

  const load = useCallback(async () => {
    try {
      const r = await api.get('/api/commercial/clients')
      setClients(Array.isArray(r.data) ? r.data : [])
    } catch (e) {
      setError(e?.response?.data?.detail || 'Erreur de chargement')
    }
  }, [])

  const loadReferentiels = useCallback(async () => {
    try {
      const cats = ['POLE', 'SECTEUR', 'TYPE_CLIENT']
      const results = await Promise.all(
        cats.map((c) => api.get('/api/commercial/referentiels', { params: { categorie: c } })),
      )
      const merged = {}
      cats.forEach((c, i) => {
        merged[c] = Array.isArray(results[i].data) ? results[i].data : []
      })
      setReferentiels(merged)
    } catch (_) { /* silencieux */ }
  }, [])

  useEffect(() => { load(); loadReferentiels() }, [load, loadReferentiels])

  function startCreate() {
    setEditingId(null)
    setForm({ ...emptyClient, charge_matricule: String(user?.matricule || '') })
    setShowForm(true)
    setError('')
  }
  function startEdit(c) {
    setEditingId(c.id)
    setForm({
      raison_sociale: c.raison_sociale || '',
      type: c.type || 'PROSPECT',
      type_personne: c.type_personne || '',
      forme_juridique: c.forme_juridique || '',
      num_compte: c.num_compte || '',
      pole: c.pole || '',
      fcp_type: c.fcp_type || 'AUCUN',
      date_entree_fcp: c.date_entree_fcp || '',
      secteur_activite: c.secteur_activite || '',
      capacite_financiere: c.capacite_financiere || '',
      contact_principal: c.contact_principal || '',
      fonction_contact: c.fonction_contact || '',
      email: c.email || '',
      telephone: c.telephone || '',
      employeur: c.employeur || '',
      adresse: c.adresse || '',
      ville: c.ville || '',
      pays: c.pays || '',
      charge_matricule: c.charge_matricule || '',
      gestionnaire_matricule: c.gestionnaire_matricule || '',
      notes: c.notes || '',
    })
    setShowForm(true)
    setError('')
  }
  async function submit(e) {
    e.preventDefault()
    setError('')
    try {
      const payload = { ...form }
      // Convert empty strings to null for optional date / enums where appropriate
      if (!payload.date_entree_fcp) delete payload.date_entree_fcp
      if (editingId) await api.patch(`/api/commercial/clients/${editingId}`, payload)
      else await api.post('/api/commercial/clients', payload)
      setShowForm(false); setEditingId(null); setForm(emptyClient); load()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Erreur lors de la sauvegarde')
    }
  }
  async function del(id) {
    if (!window.confirm('Supprimer ce client ?')) return
    try { await api.delete(`/api/commercial/clients/${id}`); load() }
    catch (e) { setError(e?.response?.data?.detail || 'Erreur') }
  }

  async function bulkDelete() {
    const ids = Array.from(selected)
    if (!ids.length) return
    if (!window.confirm(`Supprimer ${ids.length} client(s) sélectionné(s) ?`)) return
    try {
      const r = await api.delete('/api/commercial/clients', { data: { ids } })
      setSelected(new Set())
      if (lastImport) setLastImport(prev => prev ? { ...prev, created_ids: prev.created_ids.filter(id => !selected.has(id)) } : null)
      setInfo(`${r.data.deleted} client(s) supprimé(s).`)
      load()
    } catch (e) { setError(e?.response?.data?.detail || 'Erreur lors de la suppression') }
  }

  async function annulerImport() {
    const ids = lastImport?.created_ids || []
    if (!ids.length) return
    if (!window.confirm(`Annuler l'import et supprimer ${ids.length} client(s) créé(s) ?`)) return
    try {
      const r = await api.delete('/api/commercial/clients', { data: { ids } })
      setLastImport(null)
      setSelected(new Set())
      setInfo(`Import annulé : ${r.data.deleted} client(s) supprimé(s).`)
      load()
    } catch (e) { setError(e?.response?.data?.detail || "Erreur lors de l'annulation") }
  }

  async function exportClients() {
    try {
      const r = await api.get('/api/commercial/clients-export', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([r.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `clients_${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a); a.click(); a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) { setError("Erreur d'export") }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true); setError(''); setInfo('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await api.post('/api/commercial/clients-import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const sheetMsg = r.data.sheet ? ` (feuille « ${r.data.sheet} »)` : ''
      setInfo(`Import terminé${sheetMsg} : ${r.data.created} créé(s), ${r.data.updated} mis à jour.` +
        (r.data.errors?.length ? ` ${r.data.errors.length} erreur(s).` : ''))
      if ((r.data.created || 0) + (r.data.updated || 0) > 0) {
        setLastImport({
          created: r.data.created || 0,
          updated: r.data.updated || 0,
          created_ids: r.data.created_ids || [],
          sheet: r.data.sheet || '',
        })
      }
      load()
    } catch (err) {
      setError(err?.response?.data?.detail || "Erreur lors de l'import")
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const allFilteredIds = clients
    .filter((c) => {
      if (filterType && (c.type || '').toUpperCase() !== filterType.toUpperCase()) return false
      if (!search) return true
      const s = search.toLowerCase()
      return (c.raison_sociale || '').toLowerCase().includes(s)
        || (c.num_compte || '').toLowerCase().includes(s)
        || (c.contact_principal || '').toLowerCase().includes(s)
        || (c.employeur || '').toLowerCase().includes(s)
    })
    .map(c => c.id)

  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selected.has(id))

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(prev => { const next = new Set(prev); allFilteredIds.forEach(id => next.delete(id)); return next })
    } else {
      setSelected(prev => new Set([...prev, ...allFilteredIds]))
    }
  }

  function toggleSelect(id) {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  const filtered = clients.filter((c) => {
    if (filterType && (c.type || '').toUpperCase() !== filterType.toUpperCase()) return false
    if (!search) return true
    const s = search.toLowerCase()
    return (c.raison_sociale || '').toLowerCase().includes(s)
      || (c.num_compte || '').toLowerCase().includes(s)
      || (c.contact_principal || '').toLowerCase().includes(s)
      || (c.employeur || '').toLowerCase().includes(s)
  })

  const total = clients.length
  const nbClients = clients.filter(c => (c.type || '').toUpperCase() === 'CLIENT').length
  const nbProspects = clients.filter(c => (c.type || '').toUpperCase() === 'PROSPECT').length

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: BRAND_NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Building2 size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: BRAND_NAVY }}>Clients & Prospects</h1>
            <p style={{ margin: '2px 0 0', color: '#667085', fontSize: '0.85rem' }}>Référentiel commercial — gestion des clients et prospects</p>
          </div>
        </div>
      </div>

      <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 }}>
          <KpiCard label="Total" value={total} color={BRAND_NAVY} />
          <KpiCard label="Clients" value={nbClients} color="#1f7a3d" />
          <KpiCard label="Prospects" value={nbProspects} color={BRAND_RED} />
        </div>

        {/* Toolbar */}
        <div style={{ background: '#fff', padding: 16, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: 11, color: '#888' }} />
            <input
              placeholder="Rechercher (raison sociale, n° compte, contact)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', padding: '10px 10px 10px 34px', border: '1px solid #d0d5dd', borderRadius: 6 }}
            />
          </div>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            style={{ padding: '10px 12px', border: '1px solid #d0d5dd', borderRadius: 6 }}>
            <option value="">Tous types</option>
            <option value="CLIENT">Clients</option>
            <option value="PROSPECT">Prospects</option>
          </select>
          <button type="button" onClick={exportClients} style={btnSecondary}>
            <Download size={16} /> Exporter
          </button>
          {!isReadOnly && (
            <>
              <label style={{ ...btnSecondary, cursor: importing ? 'wait' : 'pointer' }}>
                <Upload size={16} /> {importing ? 'Import…' : 'Importer'}
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.xlsb" onChange={handleImport} style={{ display: 'none' }} />
              </label>
              <button type="button" onClick={startCreate} style={btnPrimary}>
                <Plus size={16} /> Nouveau
              </button>
            </>
          )}
        </div>

        {/* Barre annuler import */}
        {!isReadOnly && lastImport && (
          <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 8, padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <RotateCcw size={16} color="#795548" />
            <span style={{ flex: 1, minWidth: 200, fontSize: '0.9rem', color: '#795548' }}>
              Dernier import{lastImport.sheet ? ` — ${lastImport.sheet}` : ''} :
              {lastImport.created > 0 && <> <strong>{lastImport.created}</strong> créé(s)</>}
              {lastImport.created > 0 && lastImport.updated > 0 && <>,</>}
              {lastImport.updated > 0 && <> <strong>{lastImport.updated}</strong> mis à jour</>}.
              {lastImport.created_ids.length === 0 && <em style={{ marginLeft: 6, color: '#a57f4e' }}>(mises à jour uniquement — non annulable)</em>}
            </span>
            {lastImport.created_ids.length > 0 && (
              <button onClick={annulerImport} style={{ ...btnSecondary, color: '#c62828', borderColor: '#c62828', gap: 6 }}>
                <RotateCcw size={14} /> Annuler les créations ({lastImport.created_ids.length})
              </button>
            )}
            <button onClick={() => setLastImport(null)} style={{ background: 'transparent', border: 0, color: '#888', cursor: 'pointer' }} title="Fermer"><X size={16} /></button>
          </div>
        )}

        {/* Barre suppression groupée */}
        {!isReadOnly && selected.size > 0 && (
          <div style={{ background: '#fdecea', border: '1px solid #f5c6c6', borderRadius: 8, padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <CheckSquare size={16} color={BRAND_RED} />
            <span style={{ flex: 1, fontSize: '0.9rem', color: '#c62828' }}>
              <strong>{selected.size}</strong> client(s) sélectionné(s)
            </span>
            <button onClick={bulkDelete} style={{ ...btnPrimary, background: BRAND_RED, gap: 6 }}>
              <Trash2 size={14} /> Supprimer la sélection
            </button>
            <button onClick={() => setSelected(new Set())} style={{ background: 'transparent', border: 0, color: '#888', cursor: 'pointer' }} title="Désélectionner"><X size={16} /></button>
          </div>
        )}

        {error && <Banner type="error" onClose={() => setError('')}>{error}</Banner>}
        {info && <Banner type="success" onClose={() => setInfo('')}>{info}</Banner>}

        {/* Table */}
        <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                {!isReadOnly && (
                  <th style={{ ...th, width: 40, textAlign: 'center' }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} title="Tout sélectionner" style={{ cursor: 'pointer' }} />
                  </th>
                )}
                <th style={th}>Raison sociale</th>
                <th style={th}>Type</th>
                <th style={th}>N° Compte</th>
                <th style={th}>Pôle</th>
                <th style={th}>FCP</th>
                <th style={th}>Secteur</th>
                <th style={th}>Contact</th>
                <th style={th}>Téléphone</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={isReadOnly ? 9 : 10} style={{ padding: 24, textAlign: 'center', color: '#888' }}>Aucun client</td></tr>
              )}
              {filtered.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f0f1f3', background: selected.has(c.id) ? '#fff3e0' : undefined }}>
                  {!isReadOnly && (
                    <td style={{ ...td, width: 40, textAlign: 'center' }}>
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} style={{ cursor: 'pointer' }} />
                    </td>
                  )}
                  <td style={td}><strong style={{ color: BRAND_NAVY }}>{c.raison_sociale}</strong></td>
                  <td style={td}>
                    <Tag color={(c.type || '').toUpperCase() === 'CLIENT' ? '#1f7a3d' : BRAND_RED}>{c.type}</Tag>
                  </td>
                  <td style={td}>{c.num_compte || '-'}</td>
                  <td style={td}>{c.pole || '-'}</td>
                  <td style={td}>{c.fcp_type && c.fcp_type !== 'AUCUN' ? <Tag color={BRAND_NAVY}>{c.fcp_type}</Tag> : '-'}</td>
                  <td style={td}>{c.secteur_activite || '-'}</td>
                  <td style={td}>{c.contact_principal || '-'}</td>
                  <td style={td}>{c.telephone || '-'}</td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {!isReadOnly && (
                      <>
                        <button onClick={() => startEdit(c)} style={iconBtn} title="Modifier"><Edit3 size={14} /></button>
                        <button onClick={() => del(c.id)} style={{ ...iconBtn, color: BRAND_RED }} title="Supprimer"><Trash2 size={14} /></button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal form */}
      {showForm && (
        <div style={modalOverlay} onClick={() => setShowForm(false)}>
          <div style={modalDialog} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: BRAND_NAVY }}>{editingId ? 'Modifier le client' : 'Nouveau client / prospect'}</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'transparent', border: 0, color: '#667085', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={submit} style={{ padding: 20, maxHeight: '70vh', overflowY: 'auto' }}>
              {error && <Banner type="error" onClose={() => setError('')}>{error}</Banner>}

              <Section title="Identification">
                <Row>
                  <Field label="Raison sociale *" full>
                    <input required value={form.raison_sociale} onChange={(e) => setForm({ ...form, raison_sociale: e.target.value })} style={inp} />
                  </Field>
                </Row>
                <Row>
                  <Field label="Type">
                    <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={inp}>
                      <option value="PROSPECT">Prospect</option>
                      <option value="CLIENT">Client</option>
                    </select>
                  </Field>
                  <Field label="Type personne">
                    <select value={form.type_personne} onChange={(e) => setForm({ ...form, type_personne: e.target.value })} style={inp}>
                      <option value="">—</option>
                      <option value="PHYSIQUE">Physique</option>
                      <option value="MORALE">Morale</option>
                    </select>
                  </Field>
                  <Field label="Forme juridique">
                    <input value={form.forme_juridique} onChange={(e) => setForm({ ...form, forme_juridique: e.target.value })} style={inp} placeholder="SA, SARL, SAS…" />
                  </Field>
                </Row>
                <Row>
                  <Field label="N° de compte">
                    <input value={form.num_compte} onChange={(e) => setForm({ ...form, num_compte: e.target.value })} style={inp} />
                  </Field>
                  <Field label="Pôle">
                    <select value={form.pole} onChange={(e) => setForm({ ...form, pole: e.target.value })} style={inp}>
                      <option value="">—</option>
                      {(referentiels.POLE || []).map((r) => (
                        <option key={r.id} value={r.libelle}>{r.libelle}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Secteur d'activité">
                    <select value={form.secteur_activite} onChange={(e) => setForm({ ...form, secteur_activite: e.target.value })} style={inp}>
                      <option value="">—</option>
                      {(referentiels.SECTEUR || []).map((r) => (
                        <option key={r.id} value={r.libelle}>{r.libelle}</option>
                      ))}
                    </select>
                  </Field>
                </Row>
                <Row>
                  <Field label="Type FCP">
                    <select value={form.fcp_type} onChange={(e) => setForm({ ...form, fcp_type: e.target.value })} style={inp}>
                      <option value="AUCUN">Aucun</option>
                      <option value="FCP_INVEST">FCP Invest</option>
                      <option value="FCP_RECORD">FCP Record</option>
                    </select>
                  </Field>
                  <Field label="Date entrée FCP">
                    <input type="date" value={form.date_entree_fcp || ''} onChange={(e) => setForm({ ...form, date_entree_fcp: e.target.value })} style={inp} />
                  </Field>
                  <Field label="Capacité financière">
                    <input value={form.capacite_financiere} onChange={(e) => setForm({ ...form, capacite_financiere: e.target.value })} style={inp} />
                  </Field>
                </Row>
              </Section>

              <Section title="Contact">
                <Row>
                  <Field label="Contact principal">
                    <input value={form.contact_principal} onChange={(e) => setForm({ ...form, contact_principal: e.target.value })} style={inp} />
                  </Field>
                  <Field label="Fonction">
                    <input value={form.fonction_contact} onChange={(e) => setForm({ ...form, fonction_contact: e.target.value })} style={inp} />
                  </Field>
                  <Field label="Employeur">
                    <input value={form.employeur} onChange={(e) => setForm({ ...form, employeur: e.target.value })} style={inp} />
                  </Field>
                </Row>
                <Row>
                  <Field label="Email">
                    <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inp} />
                  </Field>
                  <Field label="Téléphone">
                    <input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} style={inp} />
                  </Field>
                </Row>
                <Row>
                  <Field label="Adresse" full>
                    <input value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} style={inp} />
                  </Field>
                </Row>
                <Row>
                  <Field label="Ville">
                    <input value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} style={inp} />
                  </Field>
                  <Field label="Pays">
                    <input value={form.pays} onChange={(e) => setForm({ ...form, pays: e.target.value })} style={inp} />
                  </Field>
                </Row>
              </Section>

              <Section title="Gestion">
                <Row>
                  <Field label="Chargé d'affaire (matricule)">
                    <input value={form.charge_matricule} onChange={(e) => setForm({ ...form, charge_matricule: e.target.value })} style={inp} />
                  </Field>
                  <Field label="Gestionnaire (matricule)">
                    <input value={form.gestionnaire_matricule} onChange={(e) => setForm({ ...form, gestionnaire_matricule: e.target.value })} style={inp} />
                  </Field>
                </Row>
                <Row>
                  <Field label="Notes" full>
                    <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ ...inp, fontFamily: 'inherit' }} />
                  </Field>
                </Row>
              </Section>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button type="button" onClick={() => setShowForm(false)} style={btnSecondary}>Annuler</button>
                <button type="submit" style={btnPrimary}>{editingId ? 'Mettre à jour' : 'Créer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Styled helpers ───
const btnPrimary = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: BRAND_NAVY, color: '#fff', border: 0, borderRadius: 6, cursor: 'pointer', fontWeight: 600 }
const btnSecondary = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: '#fff', color: BRAND_NAVY, border: `1px solid ${BRAND_NAVY}`, borderRadius: 6, cursor: 'pointer', fontWeight: 600 }
const iconBtn = { background: 'transparent', border: 0, padding: 6, cursor: 'pointer', color: '#555', marginLeft: 4 }
const th = { padding: '12px 14px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 600, color: '#475467', textTransform: 'uppercase', letterSpacing: '0.04em' }
const td = { padding: '12px 14px', color: '#1d2939' }
const inp = { width: '100%', padding: '8px 10px', border: '1px solid #d0d5dd', borderRadius: 6, fontSize: '0.92rem', boxSizing: 'border-box' }
const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(2,22,46,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }
const modalDialog = { background: '#fff', borderRadius: 10, width: '100%', maxWidth: 900, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }

function KpiCard({ label, value, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: '0.78rem', color: '#667085', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '1.8rem', fontWeight: 700, color, marginTop: 4 }}>{value}</div>
    </div>
  )
}
function Tag({ children, color }) {
  return <span style={{ display: 'inline-block', padding: '3px 9px', background: `${color}15`, color, borderRadius: 4, fontSize: '0.78rem', fontWeight: 600 }}>{children}</span>
}
function Banner({ type, children, onClose }) {
  const colors = type === 'error'
    ? { bg: '#fee', fg: '#9a1010', bd: '#fcc' }
    : { bg: '#e7f7ed', fg: '#1f7a3d', bd: '#a7e0ba' }
  return (
    <div style={{ padding: '10px 14px', background: colors.bg, color: colors.fg, border: `1px solid ${colors.bd}`, borderRadius: 6, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span>{children}</span>
      {onClose && <button onClick={onClose} style={{ background: 'transparent', border: 0, color: 'inherit', cursor: 'pointer' }}><X size={14} /></button>}
    </div>
  )
}
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: BRAND_NAVY, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, paddingBottom: 6, borderBottom: `2px solid ${BRAND_NAVY}15` }}>{title}</div>
      {children}
    </div>
  )
}
function Row({ children }) {
  return <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>{children}</div>
}
function Field({ label, full, children }) {
  return (
    <div style={{ flex: full ? '1 1 100%' : '1 1 200px', minWidth: 160 }}>
      <label style={{ display: 'block', fontSize: '0.78rem', color: '#475467', marginBottom: 4, fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  )
}
