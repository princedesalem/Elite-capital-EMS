import React, {useState, useEffect, useCallback} from 'react'
import api from '../services/api'
import {useAuth} from '../contexts/AuthContext'
import { useAutoRefresh } from '../hooks/useAutoRefresh'

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const DAYS   = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

const TYPE_COLOR = {
  CONGE:                        {bg:'#dbeafe', border:'#3b82f6', text:'#1d4ed8'},
  CONGE_ANNUEL:                 {bg:'#dbeafe', border:'#1d4ed8', text:'#1e3a8a'},
  PERMISSION_NON_CONVENTIONNELLE:{bg:'#fef3c7', border:'#f59e0b', text:'#92400e'},
  PERMISSION_CONVENTIONNELLE:   {bg:'#ede9fe', border:'#8b5cf6', text:'#4c1d95'},
  PERMISSION_MATERNELLE:        {bg:'#fce7f3', border:'#ec4899', text:'#9d174d'},
  PERMISSION_DECES:             {bg:'#f3f4f6', border:'#6b7280', text:'#374151'},
  PERMISSION_MALADIE:           {bg:'#fee2e2', border:'#ef4444', text:'#991b1b'},
  PERMISSION_BAPTEME:           {bg:'#d1fae5', border:'#10b981', text:'#065f46'},
  PERMISSION_MARIAGE:           {bg:'#ede9fe', border:'#8b5cf6', text:'#4c1d95'},
  MISSION:                      {bg:'#ffedd5', border:'#f97316', text:'#7c2d12'},
  SORTIE:                       {bg:'#ccfbf1', border:'#14b8a6', text:'#134e4a'},
  OPERATION:                    {bg:'#e5e7eb', border:'#9ca3af', text:'#374151'},
}

function getColor(type) {
  return TYPE_COLOR[type] || {bg:'#e5e7eb', border:'#9ca3af', text:'#374151'}
}

/**
 * Convertit la valeur brute type_demande d'une OPERATION_GENERIQUE
 * en clé de TYPE_COLOR pour affichage cohérent dans le calendrier.
 */
function mapTypeDemande(typeDemande) {
  const t = String(typeDemande || '').toLowerCase().trim()
  if (t === 'conge' || t === 'congé') return 'CONGE'
  if (t === 'mission') return 'MISSION'
  if (t === 'sortie') return 'SORTIE'
  if (t.includes('conventionnel')) return 'PERMISSION_CONVENTIONNELLE'
  if (t.includes('perm')) return 'PERMISSION_NON_CONVENTIONNELLE'
  return 'OPERATION'
}

/**
 * Retourne un libellé lisible pour affichage dans la cellule du calendrier.
 */
function humanLabel(resolvedType, typeDemande) {
  if (resolvedType === 'CONGE' || resolvedType === 'CONGE_ANNUEL') return 'Congé'
  if (resolvedType === 'MISSION') return 'Mission'
  if (resolvedType === 'SORTIE') return 'Sortie'
  if (resolvedType.startsWith('PERMISSION')) return 'Permission'
  // Fallback: utilise le type_demande brut si disponible
  return typeDemande ? String(typeDemande) : 'Opération'
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year, month) {
  // 0=Mon … 6=Sun
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
}

function isoToDate(str) {
  if (!str) return null
  return new Date(str.split('T')[0])
}

function dateInRange(date, start, end) {
  if (!start || !end) return false
  const d = date.getTime()
  return d >= start.getTime() && d <= end.getTime()
}

export default function CongeCalendar() {
  const {user} = useAuth()
  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [ops,   setOps]   = useState([])
  const [leaves, setLeaves] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('mensuel') // 'mensuel' | 'hebdomadaire' | 'annuel'
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedPerson, setSelectedPerson] = useState('tous')
  const [selectedOperation, setSelectedOperation] = useState('toutes')

  // Matricule → "Prénom Nom"
  const empMap = React.useMemo(() => {
    const m = {}
    employees.forEach(e => {
      if (e.matricule) m[String(e.matricule)] = `${e.prenom || ''} ${e.nom || ''}`.trim()
    })
    return m
  }, [employees])

  const operationOptions = React.useMemo(() => {
    return ops
      .filter((o) => o?.id_operation)
      .map((o) => ({
        id: String(o.id_operation),
        label: `#${o.id_operation} - ${o.type_demande || o.type || 'Opération'}`
      }))
  }, [ops])

  // Monday of current week + weekOffset
  const weekStart = React.useMemo(() => {
    const d = new Date()
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff + weekOffset * 7)
    d.setHours(0, 0, 0, 0)
    return d
  }, [weekOffset])

  const weekDays = React.useMemo(() =>
    Array.from({length: 7}, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      return d
    }), [weekStart])

  const loadData = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get('/api/operations').catch(() => ({data:[]})),
      api.get('/leaves').catch(() => ({data:[]})),
      api.get('/employees/').catch(() => ({data:[]})),
    ]).then(([opsRes, leavesRes, empRes]) => {
      setOps(opsRes.data || [])
      setLeaves(leavesRes.data || [])
      setEmployees(empRes.data || [])
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Actualisation automatique toutes les 30 secondes
  useAutoRefresh(loadData)

  // Merge all events with dates — inclut toutes les opérations validées, y compris OPERATION_GENERIQUE
  const allEvents = [
    ...ops.filter(o => o.date_depart && o.date_retour).map(o => {
      // Pour OPERATION_GENERIQUE, dériver le type d'affichage depuis type_demande
      const resolvedType = o.type === 'OPERATION_GENERIQUE'
        ? mapTypeDemande(o.type_demande)
        : (o.type || 'OPERATION')
      const displayLabel = humanLabel(resolvedType, o.type_demande)
      return {
        id: o.id_operation,
        label: `${displayLabel} — ${empMap[String(o.matricule)] || o.matricule}`,
        type: resolvedType,
        matricule: String(o.matricule || ''),
        operationId: String(o.id_operation || ''),
        start: isoToDate(o.date_depart),
        end:   isoToDate(o.date_retour),
      }
    }),
    ...leaves.filter(l => l.date_debut && l.date_fin).map(l => ({
      id: l.id_conge || l.id_permission || Math.random(),
      label: `${l.type || l.type_conge || 'CONGE'} — ${empMap[String(l.matricule)] || l.matricule}`,
      type: (String(l.type_conge || '').toUpperCase() === 'ANNUEL')
        ? 'CONGE_ANNUEL'
        : (l.type?.toUpperCase() === 'CONGE' ? 'CONGE' : (l.type?.toUpperCase() || 'CONGE')),
      matricule: String(l.matricule || ''),
      operationId: '',
      start: isoToDate(l.date_debut),
      end:   isoToDate(l.date_fin),
    })),
  ]

  function matchesFilters(event) {
    if (selectedPerson !== 'tous' && String(event.matricule || '') !== selectedPerson) return false
    if (selectedOperation !== 'toutes' && String(event.operationId || '') !== selectedOperation) return false
    return true
  }

  function eventsForDay(date) {
    return allEvents.filter(e => dateInRange(date, e.start, e.end) && matchesFilters(e))
  }

  const days    = getDaysInMonth(year, month)
  const offset  = getFirstDayOfMonth(year, month)
  const cells   = Array.from({length: offset + days}, (_, i) => i < offset ? null : i - offset + 1)

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y-1) }
    else setMonth(m => m-1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y+1) }
    else setMonth(m => m+1)
  }

  const todayD = now.getDate(), todayM = now.getMonth(), todayY = now.getFullYear()

  const WORK_HOURS = Array.from({length: 13}, (_, i) => 7 + i) // 07:00–19:00
  const fmt2 = n => String(n).padStart(2, '0')

  return (
    <div style={{background:'#fff', borderRadius:'8px', padding:'16px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>

      {/* ── Header ── */}
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px', flexWrap:'wrap', gap:8}}>
        <h2 style={{margin:0, fontSize:'1.05rem', fontWeight:700, color:'#111827'}}>
          Calendrier des Congés &amp; Opérations
        </h2>
        <div style={{display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap'}}>

          {/* View toggle */}
          <div style={{display:'flex', background:'#f1f5f9', borderRadius:8, padding:3, gap:3}}>
            {[['mensuel','Mensuel'],['hebdomadaire','Semaine'],['annuel','Annuel']].map(([v,l]) => (
              <button key={v} onClick={() => setViewMode(v)} style={{
                background: viewMode === v ? 'white' : 'transparent',
                border:'none', borderRadius:6, padding:'5px 12px', cursor:'pointer',
                fontSize:'0.75rem', fontWeight:700,
                color: viewMode === v ? '#021630' : '#64748b',
                boxShadow: viewMode === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}>{l}</button>
            ))}
          </div>

          {/* Nav buttons */}
          {viewMode === 'mensuel' ? (
            <>
              <button onClick={prevMonth} style={navBtn}>‹</button>
              <span style={{fontWeight:600, fontSize:'0.9rem', minWidth:'140px', textAlign:'center'}}>{MONTHS[month]} {year}</span>
              <button onClick={nextMonth} style={navBtn}>›</button>
            </>
          ) : viewMode === 'annuel' ? (
            <>
              <button onClick={() => setYear((y) => y - 1)} style={navBtn}>‹</button>
              <span style={{fontWeight:600, fontSize:'0.9rem', minWidth:'90px', textAlign:'center'}}>{year}</span>
              <button onClick={() => setYear((y) => y + 1)} style={navBtn}>›</button>
            </>
          ) : (
            <>
              <button onClick={() => setWeekOffset(w => w - 1)} style={navBtn}>‹</button>
              <span style={{fontWeight:600, fontSize:'0.82rem', minWidth:'200px', textAlign:'center'}}>
                {weekDays[0].toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})} – {weekDays[6].toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}
              </span>
              <button onClick={() => setWeekOffset(w => w + 1)} style={navBtn}>›</button>
              <button onClick={() => setWeekOffset(0)} style={{...navBtn, width:'auto', padding:'0 8px', fontSize:'0.7rem'}}>Auj.</button>
            </>
          )}
        </div>
      </div>

      <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:12}}>
        <select value={selectedPerson} onChange={(e) => setSelectedPerson(e.target.value)} style={{padding:'6px 10px', border:'1px solid #d1d5db', borderRadius:6, fontSize:'0.78rem', minWidth:200}}>
          <option value="tous">Toutes les personnes</option>
          {employees.map((e) => (
            <option key={e.matricule} value={String(e.matricule)}>
              {`${e.prenom || ''} ${e.nom || ''}`.trim() || e.matricule}
            </option>
          ))}
        </select>
        <select value={selectedOperation} onChange={(e) => setSelectedOperation(e.target.value)} style={{padding:'6px 10px', border:'1px solid #d1d5db', borderRadius:6, fontSize:'0.78rem', minWidth:240}}>
          <option value="toutes">Toutes les opérations</option>
          {operationOptions.map((op) => (
            <option key={op.id} value={op.id}>{op.label}</option>
          ))}
        </select>
      </div>

      {/* ── Legend ── */}
      <div style={{display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'12px'}}>
        {Object.entries(TYPE_COLOR).map(([t,c]) => (
          <span key={t} style={{
            display:'inline-flex', alignItems:'center', gap:'4px',
            padding:'2px 8px', borderRadius:'999px', fontSize:'0.68rem', fontWeight:600,
            background:c.bg, color:c.text, border:`1px solid ${c.border}`
          }}>{t.replace('PERMISSION_','PERM. ').replace(/_/g,' ')}</span>
        ))}
      </div>

      {loading ? (
        <p style={{color:'#6b7280', textAlign:'center', padding:'40px'}}>Chargement…</p>

      ) : viewMode === 'mensuel' ? (
        /* ══════════ MONTHLY VIEW ══════════ */
        <>
          <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px', marginBottom:'2px'}}>
            {DAYS.map(d => (
              <div key={d} style={{textAlign:'center', fontSize:'0.72rem', fontWeight:700, color:'#6b7280', padding:'4px 0'}}>{d}</div>
            ))}
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px'}}>
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} />
              const date = new Date(year, month, day)
              const isToday = day === todayD && month === todayM && year === todayY
              const dayEvents = eventsForDay(date)
              return (
                <div key={idx} style={{
                  minHeight:'68px', border:'1px solid', borderRadius:'5px',
                  borderColor: isToday ? '#ce2b2b' : '#e5e7eb',
                  background: isToday ? '#fff5f5' : '#fff',
                  padding:'3px',
                }}>
                  <div style={{
                    fontSize:'0.72rem', fontWeight: isToday ? 800 : 500,
                    color: isToday ? '#ce2b2b' : '#374151',
                    marginBottom:'2px', textAlign:'right', paddingRight:'2px',
                  }}>{day}</div>
                  {dayEvents.slice(0,3).map((e,i) => {
                    const c = getColor(e.type)
                    return (
                      <div key={i} title={e.label} style={{
                        fontSize:'0.6rem', padding:'1px 4px', borderRadius:'3px', marginBottom:'1px',
                        background:c.bg, color:c.text, border:`1px solid ${c.border}`,
                        overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis',
                      }}>{e.label}</div>
                    )
                  })}
                  {dayEvents.length > 3 && (
                    <div style={{fontSize:'0.58rem', color:'#6b7280', paddingLeft:'2px'}}>+{dayEvents.length-3}</div>
                  )}
                </div>
              )
            })}
          </div>
        </>

      ) : viewMode === 'annuel' ? (
        <div style={{display:'grid', gridTemplateColumns:'repeat(3, minmax(220px, 1fr))', gap:10}}>
          {MONTHS.map((monthLabel, monthIndex) => {
            const annualDays = getDaysInMonth(year, monthIndex)
            const annualOffset = getFirstDayOfMonth(year, monthIndex)
            const annualCells = Array.from({length: annualOffset + annualDays}, (_, i) => i < annualOffset ? null : i - annualOffset + 1)
            return (
              <div key={monthLabel} style={{border:'1px solid #e5e7eb', borderRadius:8, padding:8, background:'#fff'}}>
                <div style={{fontSize:'0.8rem', fontWeight:700, color:'#0f172a', marginBottom:6}}>{monthLabel}</div>
                <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:4}}>
                  {DAYS.map((d) => <div key={d} style={{fontSize:'0.58rem', textAlign:'center', color:'#94a3b8', fontWeight:700}}>{d[0]}</div>)}
                </div>
                <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2}}>
                  {annualCells.map((day, idx) => {
                    if (!day) return <div key={`${monthLabel}-${idx}`} style={{minHeight:22}} />
                    const date = new Date(year, monthIndex, day)
                    const dayEvents = eventsForDay(date)
                    return (
                      <div key={`${monthLabel}-${day}`} title={dayEvents.map((e) => e.label).join(' | ')} style={{minHeight:22, borderRadius:4, border:'1px solid #f1f5f9', background:dayEvents.length ? '#eef2ff' : '#fff', fontSize:'0.62rem', display:'flex', alignItems:'center', justifyContent:'center', color:'#334155', fontWeight: dayEvents.length ? 700 : 500}}>
                        {day}
                        {dayEvents.length > 0 ? ` (${dayEvents.length})` : ''}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ══════════ WEEKLY / HOURLY VIEW ══════════ */
        <div style={{overflowX:'auto'}}>
          {/* Day column headers */}
          <div style={{display:'grid', gridTemplateColumns:'64px repeat(7,1fr)', borderBottom:'2px solid #e5e7eb'}}>
            <div style={{padding:'6px', fontSize:'0.68rem', color:'#94a3b8', textAlign:'center', borderRight:'1px solid #e5e7eb', fontWeight:700}}>Heure</div>
            {weekDays.map((d, i) => {
              const isToday = d.toDateString() === now.toDateString()
              return (
                <div key={i} style={{
                  padding:'8px 4px', textAlign:'center', borderLeft:'1px solid #e5e7eb',
                  background: isToday ? '#fff5f5' : 'white',
                }}>
                  <div style={{fontSize:'0.7rem', color:'#64748b', fontWeight:600}}>{DAYS[i]}</div>
                  <div style={{
                    fontSize:'1rem', fontWeight: isToday ? 800 : 600,
                    color: isToday ? '#ce2b2b' : '#021630',
                  }}>{d.getDate()}</div>
                  <div style={{fontSize:'0.68rem', color:'#94a3b8'}}>{d.toLocaleDateString('fr-FR',{month:'short'})}</div>
                </div>
              )
            })}
          </div>

          {/* All-day row — shows absences as name tags */}
          <div style={{display:'grid', gridTemplateColumns:'64px repeat(7,1fr)', borderBottom:'2px solid #e5e7eb', background:'#fafafa'}}>
            <div style={{
              padding:'4px 6px', fontSize:'0.65rem', color:'#94a3b8', textAlign:'center',
              borderRight:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'center',
              fontWeight:700, lineHeight:1.2,
            }}>Toute<br/>la<br/>journée</div>
            {weekDays.map((d, idx) => {
              const dayEvts = eventsForDay(d)
              return (
                <div key={idx} style={{padding:'3px', borderLeft:'1px solid #e5e7eb', minHeight:36}}>
                  {dayEvts.map((e, i) => {
                    const c = getColor(e.type)
                    return (
                      <div key={i} title={e.label} style={{
                        fontSize:'0.62rem', padding:'2px 5px', borderRadius:'4px', marginBottom:'2px',
                        background:c.bg, color:c.text, border:`1px solid ${c.border}`,
                        overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', fontWeight:700,
                      }}>{e.label}</div>
                    )
                  })}
                </div>
              )
            })}
          </div>

          {/* Hourly rows */}
          {WORK_HOURS.map(h => (
            <div key={h} style={{display:'grid', gridTemplateColumns:'64px repeat(7,1fr)', borderBottom:'1px solid #f1f5f9', minHeight:44}}>
              {/* Hour label */}
              <div style={{
                padding:'4px 8px', fontSize:'0.72rem', fontWeight:700, color:'#94a3b8',
                borderRight:'1px solid #e5e7eb', textAlign:'right', paddingTop:5,
                background:'#fafafa',
              }}>{fmt2(h)}:00</div>
              {/* Day cells */}
              {weekDays.map((d, idx) => {
                const dayEvts = eventsForDay(d)
                const hasAbsence = dayEvts.length > 0
                const firstColor = hasAbsence ? getColor(dayEvts[0].type) : null
                return (
                  <div key={idx} style={{
                    borderLeft:'1px solid #f1f5f9', minHeight:44,
                    background: hasAbsence
                      ? `${firstColor.bg}80`         // subtle tint for absent days
                      : h % 2 === 0 ? '#fafafa' : 'white',
                  }} />
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const navBtn = {
  background:'#f3f4f6', border:'none', borderRadius:'5px',
  width:'28px', height:'28px', cursor:'pointer', fontSize:'1rem',
  display:'flex', alignItems:'center', justifyContent:'center',
  color:'#374151', fontWeight:700,
}
