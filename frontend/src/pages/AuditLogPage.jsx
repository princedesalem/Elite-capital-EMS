import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import * as XLSX from 'xlsx'
import { Download, ClipboardList, X, ChevronDown } from 'lucide-react'

const ACTION_COLORS = {
  LOGIN_SUCCESS: { bg: '#e8f5e9', color: '#2e7d32' },
  LOGIN_FAILED: { bg: '#ffebee', color: '#c62828' },
  REGISTER: { bg: '#e3f2fd', color: '#1565c0' },
  PASSWORD_CHANGED: { bg: '#fff3e0', color: '#e65100' },
  EMPLOYEE_CREATED: { bg: '#e8f5e9', color: '#2e7d32' },
  EMPLOYEE_UPDATED: { bg: '#fff3e0', color: '#e65100' },
  OPERATION_VALIDATED: { bg: '#e8f5e9', color: '#2e7d32' },
  OPERATION_REFUSED: { bg: '#ffebee', color: '#c62828' },
  CONGE_ACTIVATED: { bg: '#e3f2fd', color: '#1565c0' },
}

const ACTION_OPTIONS = [
  'LOGIN_SUCCESS', 'LOGIN_FAILED', 'REGISTER', 'PASSWORD_CHANGED',
  'EMPLOYEE_CREATED', 'EMPLOYEE_UPDATED', 'OPERATION_VALIDATED',
  'OPERATION_REFUSED', 'CONGE_ACTIVATED',
]

const ENTITY_OPTIONS = ['auth', 'employe', 'operation', 'request']

const PAGE_SIZE = 50

export default function AuditLogPage() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)

  // Filters
  const [filterAction, setFilterAction] = useState('')
  const [filterMatricule, setFilterMatricule] = useState('')
  const [filterEntity, setFilterEntity] = useState('')
  const [filterDepuis, setFilterDepuis] = useState('')
  const [filterJusqu, setFilterJusqu] = useState('')

  // Sort
  const [sortCol, setSortCol] = useState('timestamp')
  const [sortDir, setSortDir] = useState('desc')

  // Detail modal
  const [selectedLog, setSelectedLog] = useState(null)

  // Export menu
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const exportMenuRef = useRef(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', PAGE_SIZE)
      params.set('offset', offset)
      if (filterAction) params.set('action', filterAction)
      if (filterMatricule) params.set('matricule', filterMatricule)
      if (filterEntity) params.set('ressource_type', filterEntity)
      if (filterDepuis) params.set('depuis', filterDepuis)
      if (filterJusqu) params.set('jusqu', filterJusqu)
      params.set('sort_col', sortCol)
      params.set('sort_dir', sortDir)

      const res = await api.get(`/api/admin/audit-logs?${params.toString()}`)
      setItems(res.data.items || [])
      setTotal(res.data.total || 0)
    } catch (err) {
      console.error('Erreur chargement audit logs:', err)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [offset, filterAction, filterMatricule, filterEntity, filterDepuis, filterJusqu, sortCol, sortDir])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const resetFilters = () => {
    setFilterAction('')
    setFilterMatricule('')
    setFilterEntity('')
    setFilterDepuis('')
    setFilterJusqu('')
    setOffset(0)
  }

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  const buildRows = () => {
    const headers = ['ID', 'Date', 'Acteur', 'Action', 'Type Ressource', 'ID Ressource', 'Détails', 'IP']
    const rows = items.map(i => [
      i.id, i.timestamp || '', i.actor || '', i.action || '', i.entity || '',
      i.entity_id || '', (i.detail || '').replace(/"/g, '""'), i.ip || ''
    ])
    return { headers, rows }
  }

  const exportCSV = () => {
    const { headers, rows } = buildRows()
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExportMenuOpen(false)
  }

  const exportXLSX = (fmt) => {
    const { headers, rows } = buildRows()
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows.map(r => r.map(v => String(v)))])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Audit')
    const ext = fmt === 'xls' ? 'xls' : 'xlsx'
    XLSX.writeFile(wb, `audit_logs_${new Date().toISOString().slice(0, 10)}.${ext}`, { bookType: fmt })
    setExportMenuOpen(false)
  }

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span style={{ opacity: 0.3, fontSize: '0.7em' }}> ↕</span>
    return <span style={{ fontSize: '0.7em', color: '#ce2b2b' }}> {sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const ActionBadge = ({ action }) => {
    const style = ACTION_COLORS[action] || { bg: '#f5f5f5', color: '#555' }
    return (
      <span style={{
        display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '0.78em',
        fontWeight: 600, background: style.bg, color: style.color, whiteSpace: 'nowrap'
      }}>
        {action}
      </span>
    )
  }

  return (
    <>
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, borderLeft: '4px solid #ce2b2b', paddingLeft: 14 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#112033' }}>
            {"Journal d'audit"}
          </h1>
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: '0.88rem' }}>
            {total} entrée{total > 1 ? 's' : ''} au total
          </p>
        </div>
        <div style={{ position: 'relative' }} ref={exportMenuRef}>
          <button
            onClick={() => setExportMenuOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8,
              border: 'none', background: '#112033', cursor: 'pointer', fontWeight: 700,
              fontSize: '0.88rem', color: '#fff'
            }}
          >
            <Download size={15} /> {"Exporter"} <ChevronDown size={13} style={{ marginLeft: 2 }} />
          </button>
          {exportMenuOpen && (
            <div style={{
              position: 'absolute', right: 0, top: '110%', background: 'var(--card)', borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.14)', border: '1px solid var(--border)', zIndex: 50,
              minWidth: 140, overflow: 'hidden'
            }}>
              {[{ label: 'CSV', fn: exportCSV }, { label: 'XLS', fn: () => exportXLSX('xls') }, { label: 'XLSX', fn: () => exportXLSX('xlsx') }].map(opt => (
                <button
                  key={opt.label}
                  onClick={opt.fn}
                  style={{
                    display: 'block', width: '100%', padding: '9px 16px', textAlign: 'left',
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.87rem',
                    fontWeight: 600, color: '#112033'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 10, padding: 14, marginBottom: 16,
        background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
      }}>
        <select
          value={filterAction} onChange={e => { setFilterAction(e.target.value); setOffset(0) }}
          style={filterStyle}
        >
          <option value="">Toutes les actions</option>
          {ACTION_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        <input
          placeholder="Matricule acteur..."
          value={filterMatricule}
          onChange={e => { setFilterMatricule(e.target.value); setOffset(0) }}
          style={{ ...filterStyle, width: 140 }}
        />

        <select
          value={filterEntity} onChange={e => { setFilterEntity(e.target.value); setOffset(0) }}
          style={filterStyle}
        >
          <option value="">Tous les types</option>
          {ENTITY_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>De :</span>
          <input
            type="date" value={filterDepuis}
            onChange={e => { setFilterDepuis(e.target.value); setOffset(0) }}
            style={filterStyle}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>À :</span>
          <input
            type="date" value={filterJusqu}
            onChange={e => { setFilterJusqu(e.target.value); setOffset(0) }}
            style={filterStyle}
          />
        </div>

        <button onClick={resetFilters} style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '6px 14px', borderRadius: 6, border: '1px solid #ddd',
          background: 'var(--bg)', cursor: 'pointer', fontSize: '0.82rem', color: '#555'
        }}>
          <X size={13} /> Réinitialiser
        </button>
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: 20 }}>
            {[...Array(8)].map((_, i) => (
              <div key={i} style={{
                height: 18, marginBottom: 12, borderRadius: 6,
                background: `linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)`,
                backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
                width: `${70 + Math.random() * 30}%`
              }} />
            ))}
            <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#999' }}>
            <ClipboardList size={48} style={{ color: '#d1d5db', marginBottom: 12 }} />
            <div style={{ fontSize: '1rem', fontWeight: 600 }}>{"Aucune entrée"}</div>
            <div style={{ fontSize: '0.85rem', marginTop: 4 }}>{"Essayez de modifier les filtres"}</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#112033', borderBottom: '2px solid #0d1a2a' }}>
                  {[
                    { key: 'timestamp', label: "Date / Heure" },
                    { key: 'actor', label: "Acteur" },
                    { key: 'action', label: "Action" },
                    { key: 'entity', label: "Type ressource" },
                    { key: 'entity_id', label: "ID ressource" },
                    { key: 'detail', label: "Détails" },
                    { key: 'ip', label: "IP" },
                  ].map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      style={{
                        padding: '10px 12px', textAlign: 'left', fontWeight: 700,
                        color: sortCol === col.key ? '#ff8080' : '#e2e8f0',
                        cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none',
                        fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.03em'
                      }}
                    >
                      {col.label}<SortIcon col={col.key} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.id}
                    onClick={() => setSelectedLog(item)}
                    style={{
                      borderBottom: '1px solid #f0f0f0',
                      background: idx % 2 === 1 ? '#fafbfc' : '#fff',
                      transition: 'background 0.15s',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#edf2ff'}
                    onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 1 ? '#fafbfc' : '#fff'}
                  >
                    <td style={cellStyle}>
                      {item.timestamp ? new Date(item.timestamp).toLocaleString('fr-FR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      }) : '—'}
                    </td>
                    <td style={cellStyle}>{item.actor || '—'}</td>
                    <td style={cellStyle}><ActionBadge action={item.action} /></td>
                    <td style={cellStyle}><span style={{ opacity: 0.7 }}>{item.entity || '—'}</span></td>
                    <td style={cellStyle}>{item.entity_id || '—'}</td>
                    <td style={{ ...cellStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.detail || '—'}
                    </td>
                    <td style={{ ...cellStyle, fontFamily: 'monospace', fontSize: '0.78rem', color: '#888' }}>
                      {item.ip || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginTop: 14, fontSize: '0.85rem', color: '#555'
        }}>
          <span>
            Page {currentPage} / {totalPages} — {total} résultat{total > 1 ? 's' : ''}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
              style={paginationBtn}
            >
              ← Précédent
            </button>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total}
              style={paginationBtn}
            >
              Suivant →
            </button>
          </div>
        </div>
      )}
      </div>

    {/* Detail Modal */}
    {selectedLog && (
      <div
        onClick={() => setSelectedLog(null)}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: 'var(--card)', borderRadius: 12, padding: 28, maxWidth: 640, width: '95%',
            maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
            position: 'relative'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#112033', borderLeft: '4px solid #ce2b2b', paddingLeft: 10 }}>
              Détail de l'entrée #{selectedLog.id}
            </h2>
            <button onClick={() => setSelectedLog(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}>
              <X size={20} />
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <tbody>
              {[
                { label: "Date / Heure", value: selectedLog.timestamp ? new Date(selectedLog.timestamp).toLocaleString('fr-FR') : '—' },
                { label: "Acteur", value: selectedLog.actor || '—' },
                { label: "Action", value: <ActionBadge action={selectedLog.action} /> },
                { label: "Type ressource", value: selectedLog.entity || '—' },
                { label: "ID ressource", value: selectedLog.entity_id || '—' },
                { label: "IP", value: selectedLog.ip || '—' },
              ].map(({ label, value }) => (
                <tr key={label} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '9px 10px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap', width: 160 }}>{label}</td>
                  <td style={{ padding: '9px 10px', color: '#112033' }}>{value}</td>
                </tr>
              ))}
              <tr>
                <td style={{ padding: '9px 10px', fontWeight: 700, color: 'var(--text-secondary)', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{"Détails"}</td>
                <td style={{ padding: '9px 10px' }}>
                  {selectedLog.detail ? (
                    <pre style={{
                      margin: 0, padding: '10px 12px', background: 'var(--bg)', borderRadius: 6,
                      fontSize: '0.8rem', overflowX: 'auto', color: 'var(--text)',
                      border: '1px solid var(--border)', whiteSpace: 'pre-wrap', wordBreak: 'break-all'
                    }}>
                      {(() => { try { return JSON.stringify(JSON.parse(selectedLog.detail), null, 2) } catch { return selectedLog.detail } })()}
                    </pre>
                  ) : <span style={{ color: '#999' }}>—</span>}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )}
    </>
  )
}

const filterStyle = {
  padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd',
  fontSize: '0.85rem', background: 'var(--card)', minWidth: 120,
}

const cellStyle = {
  padding: '10px 12px', verticalAlign: 'middle',
}

const paginationBtn = {
  padding: '6px 14px', borderRadius: 6, border: '1px solid #ddd',
  background: 'var(--card)', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem',
}
