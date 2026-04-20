import React, {useState, useEffect, useCallback} from 'react'
import api from '../services/api'
import {useAuth} from '../contexts/AuthContext'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import {
  Umbrella, Plane, Shield, Baby, Heart, Activity, Star, LogOut, FileText, ClipboardList,
  X, User, Calendar, Clock, MapPin, MessageSquare, CheckCircle, Tag, ChevronLeft, ChevronRight
} from 'lucide-react'

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const DAYS   = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

// Brand palette:
//   navy  = rgb(2,22,46)   → #02162e
//   rouge = rgb(208,32,43) → #d0202b
//   teal  = #0f766e (--accent)
const TYPE_META = {
  CONGE:                         { bg:'#e8eef7', border:'#02162e', text:'#02162e', label:'Congé',            Icon: Umbrella },
  CONGE_ANNUEL:                  { bg:'#e8eef7', border:'#02162e', text:'#02162e', label:'Congé annuel',     Icon: Umbrella },
  PERMISSION_NON_CONVENTIONNELLE:{ bg:'#fef3c7', border:'#b45309', text:'#78350f', label:'Perm. NC',         Icon: Shield },
  PERMISSION_CONVENTIONNELLE:    { bg:'#eef2ff', border:'#4338ca', text:'#312e81', label:'Permission',       Icon: ClipboardList },
  PERMISSION_MATERNELLE:         { bg:'#fdf2f8', border:'#9d174d', text:'#831843', label:'Maternelle',       Icon: Baby },
  PERMISSION_DECES:              { bg:'#f3f4f6', border:'#6b7280', text:'#374151', label:'Perm. Décès',      Icon: Heart },
  PERMISSION_MALADIE:            { bg:'#fff1f2', border:'#d0202b', text:'#9f1239', label:'Perm. Maladie',    Icon: Activity },
  PERMISSION_BAPTEME:            { bg:'#fdf2f8', border:'#9d174d', text:'#831843', label:'Perm. Baptême',    Icon: Star },
  PERMISSION_MARIAGE:            { bg:'#fdf2f8', border:'#9d174d', text:'#831843', label:'Perm. Mariage',    Icon: Heart },
  PERMISSION:                    { bg:'#fef3c7', border:'#b45309', text:'#78350f', label:'Permission',       Icon: Shield },
  MISSION:                       { bg:'#fff7ed', border:'#c2410c', text:'#7c2d12', label:'Mission',          Icon: Plane },
  SORTIE:                        { bg:'#f0fdfa', border:'#0f766e', text:'#134e4a', label:'Sortie',           Icon: LogOut },
  OPERATION:                     { bg:'#f3f4f6', border:'#9ca3af', text:'#374151', label:'Opération',        Icon: FileText },
}

// Types to show in the type-filter dropdown (excludes fine-grained sub-types)
const TYPE_FILTER_OPTIONS = [
  { value: 'tous', label: 'Tous les types' },
  { value: 'CONGE',                          label: 'Congé' },
  { value: 'MISSION',                        label: 'Mission' },
  { value: 'SORTIE',                         label: 'Sortie' },
  { value: 'PERMISSION',                     label: 'Permission' },
  { value: 'PERMISSION_NON_CONVENTIONNELLE', label: 'Perm. NC' },
  { value: 'PERMISSION_MATERNELLE',          label: 'Maternelle' },
  { value: 'PERMISSION_MALADIE',             label: 'Perm. Maladie' },
  { value: 'PERMISSION_DECES',               label: 'Perm. Décès' },
  { value: 'PERMISSION_BAPTEME',             label: 'Perm. Baptême' },
  { value: 'PERMISSION_MARIAGE',             label: 'Perm. Mariage' },
  { value: 'OPERATION',                      label: 'Opération' },
]

function getMeta(type) {
  return TYPE_META[type] || TYPE_META['OPERATION']
}

function mapTypeDemande(typeDemande) {
  const t = String(typeDemande || '').toLowerCase().trim()
  if (t === 'conge' || t === 'congé' || t === 'congés' || t === 'conges') return 'CONGE'
  if (t === 'mission' || t === 'frais de mission') return 'MISSION'
  if (t === 'sortie') return 'SORTIE'
  if (t.includes('maternelle')) return 'PERMISSION_MATERNELLE'
  if (t.includes('décès') || t.includes('deces')) return 'PERMISSION_DECES'
  if (t.includes('maladie')) return 'PERMISSION_MALADIE'
  if (t.includes('baptême') || t.includes('bapteme')) return 'PERMISSION_BAPTEME'
  if (t.includes('mariage')) return 'PERMISSION_MARIAGE'
  if (t.includes('conventionnel')) return 'PERMISSION_CONVENTIONNELLE'
  if (t.includes('perm') || t === 'permission') return 'PERMISSION_NON_CONVENTIONNELLE'
  return 'OPERATION'
}

function isValidatedStatut(statut) {
  const s = String(statut || '').toLowerCase().trim()
  return s.includes('valid') || s.includes('approuv') || s === 'terminé' || s === 'termine' || s === 'clôturé' || s === 'cloture'
}

function fmtDateFR(str) {
  if (!str) return '—'
  return new Date(str.split('T')[0]).toLocaleDateString('fr-FR')
}

/* ─── Event detail modal ─────────────────────────────────────────── */
function EventDetailModal({ event, empMap, onClose }) {
  if (!event) return null
  const meta = getMeta(event.type)
  const Icon = meta.Icon
  const raw = event.raw || {}
  const isSortie = event.type === 'SORTIE'
  const isMission = event.type === 'MISSION'
  const empName = empMap[String(event.matricule)] || `Matr. ${event.matricule}`

  const LabelRow = ({ icon: IcComp, children }) => (
    <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'7px 0', borderBottom:'1px solid #f1f5f9' }}>
      <IcComp size={14} style={{ color:'#64748b', flexShrink:0, marginTop:2 }} />
      <div style={{ fontSize:'0.8rem', color:'#1f2937', lineHeight:1.5 }}>{children}</div>
    </div>
  )

  return (
    <div
      data-testid="event-modal-backdrop"
      onClick={onClose}
      style={{
        position:'fixed', inset:0, background:'rgba(2,22,46,0.35)',
        display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999,
      }}
    >
      <div
        data-testid="event-modal"
        role="dialog"
        onClick={e => e.stopPropagation()}
        style={{
          background:'#fff', borderRadius:12, boxShadow:'0 8px 40px rgba(2,22,46,0.18)',
          width:'100%', maxWidth:420, padding:'20px 24px', position:'relative',
          maxHeight:'90vh', overflowY:'auto',
        }}
      >
        {/* Close */}
        <button
          data-testid="modal-close"
          onClick={onClose}
          style={{
            position:'absolute', top:12, right:12,
            background:'none', border:'none', cursor:'pointer', padding:4, borderRadius:6,
            color:'#64748b', display:'flex', alignItems:'center',
          }}
          aria-label="Fermer"
        >
          <X size={18} />
        </button>

        {/* Type badge + title */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
          <span style={{
            display:'inline-flex', alignItems:'center', gap:6,
            padding:'4px 12px', borderRadius:999, fontSize:'0.78rem', fontWeight:700,
            background:meta.bg, color:meta.text, border:`1.5px solid ${meta.border}`,
          }}>
            <Icon size={12} strokeWidth={2.5} />
            {meta.label}
          </span>
          <span style={{ fontSize:'0.72rem', color:'#94a3b8', fontWeight:600 }}>#{raw.id_operation || raw.id_sortie}</span>
        </div>

        {/* Detail rows */}
        <div style={{ display:'flex', flexDirection:'column' }}>
          <LabelRow icon={User}>
            <span style={{ fontWeight:700 }}>{empName}</span>
          </LabelRow>

          <LabelRow icon={Calendar}>
            {isSortie ? (
              <><span style={{ fontWeight:600 }}>Date :</span> {fmtDateFR(raw.date_sortie)}</>
            ) : (
              <><span style={{ fontWeight:600 }}>Période :</span> {fmtDateFR(raw.date_depart || raw.date_debut)} → {fmtDateFR(raw.date_retour || raw.date_fin)}</>
            )}
          </LabelRow>

          {isSortie && (raw.heure_sortie || raw.heure_retour) && (
            <LabelRow icon={Clock}>
              <span style={{ fontWeight:600 }}>Horaire :</span> {raw.heure_sortie || '—'} → {raw.heure_retour || '—'}
              {raw.duree_heures ? <span style={{ marginLeft:8, color:'#64748b' }}>({raw.duree_heures} h)</span> : null}
            </LabelRow>
          )}

          {!isSortie && raw.duree != null && (
            <LabelRow icon={Clock}>
              <span style={{ fontWeight:600 }}>Durée :</span> {raw.duree} jour{raw.duree > 1 ? 's' : ''}
            </LabelRow>
          )}

          <LabelRow icon={CheckCircle}>
            <span style={{ fontWeight:600 }}>Statut :</span>{' '}
            <span style={{
              display:'inline-block', marginLeft:4, padding:'1px 8px', borderRadius:999,
              fontSize:'0.72rem', fontWeight:700,
              background: (raw.statut||'').toLowerCase().includes('valid') || (raw.statut||'').toLowerCase().includes('approuv') ? '#dcfce7' : '#f3f4f6',
              color: (raw.statut||'').toLowerCase().includes('valid') || (raw.statut||'').toLowerCase().includes('approuv') ? '#15803d' : '#374151',
            }}>
              {raw.statut || '—'}
            </span>
          </LabelRow>

          {isMission && raw.details?.pays && (
            <LabelRow icon={MapPin}>
              <span style={{ fontWeight:600 }}>Destination :</span> {raw.details.pays}{raw.details.ville ? `, ${raw.details.ville}` : ''}
            </LabelRow>
          )}

          {isMission && raw.details?.transport && (
            <LabelRow icon={Plane}>
              <span style={{ fontWeight:600 }}>Transport :</span> {raw.details.transport}
            </LabelRow>
          )}

          {(raw.commentaire || raw.motif) && (
            <LabelRow icon={MessageSquare}>
              <span style={{ fontWeight:600 }}>Commentaire :</span> {raw.commentaire || raw.motif}
            </LabelRow>
          )}
        </div>
      </div>
    </div>
  )
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year, month) {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
}

function getNow() {
  const tz = localStorage.getItem('ems_timezone')
  if (!tz) return new Date()
  try {
    const parts = new Intl.DateTimeFormat('fr-FR', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date())
    const y = parseInt(parts.find(p => p.type === 'year').value)
    const m = parseInt(parts.find(p => p.type === 'month').value) - 1
    const d = parseInt(parts.find(p => p.type === 'day').value)
    return new Date(y, m, d)
  } catch { return new Date() }
}

function isoToDate(str) {
  if (!str) return null
  const parts = str.split('T')[0].split('-')
  // Use local midnight (not UTC) so dateInRange matches calendar grid cells
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
}

function parseHourMin(str) {
  if (!str) return 0
  const parts = str.split(':')
  return parseInt(parts[0] || 0) * 60 + parseInt(parts[1] || 0)
}

function dateInRange(date, start, end) {
  if (!start || !end) return false
  const d = date.getTime()
  return d >= start.getTime() && d <= end.getTime()
}

export default function CongeCalendar() {
  useAuth()
  const now = getNow()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [ops,      setOps]      = useState([])
  const [sorties,  setSorties]  = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('mensuel')
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedPerson, setSelectedPerson] = useState('tous')
  const [selectedType,   setSelectedType]   = useState('tous')
  const [selectedEvent,  setSelectedEvent]  = useState(null)

  const empMap = React.useMemo(() => {
    const m = {}
    employees.forEach(e => {
      if (e.matricule) m[String(e.matricule)] = `${e.prenom || ''} ${e.nom || ''}`.trim()
    })
    return m
  }, [employees])

  const weekStart = React.useMemo(() => {
    const d = getNow()
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
      api.get('/api/sorties').catch(() => ({data:[]})),
      api.get('/employees/').catch(() => ({data:[]})),
    ]).then(([opsRes, sortiesRes, empRes]) => {
      setOps(opsRes.data || [])
      setSorties(sortiesRes.data || [])
      setEmployees(empRes.data || [])
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadData() }, [loadData])
  useAutoRefresh(loadData)

  // Build unified validated-only event list
  const allEvents = React.useMemo(() => {
    const events = []

    // Regular operations (congé, permission, mission, …) — skip Sorties, handled below
    ops
      .filter(o => (o.date_depart || o.date_debut) && (o.date_retour || o.date_fin) && isValidatedStatut(o.statut)
        && String(o.type_demande || '').toLowerCase() !== 'sortie')
      .forEach(o => {
        const resolvedType = (!o.type || o.type === 'OPERATION_GENERIQUE')
          ? mapTypeDemande(o.type_demande)
          : o.type
        const meta = getMeta(resolvedType)
        const empName = empMap[String(o.matricule)] || `Matr. ${o.matricule}`
        events.push({
          id: String(o.id_operation),
          label: `${meta.label} — ${empName}`,
          type: resolvedType,
          matricule: String(o.matricule || ''),
          start: isoToDate(o.date_depart || o.date_debut),
          end:   isoToDate(o.date_retour || o.date_fin),
          raw: o,
        })
      })

    // Sorties (infra-daily absences — use date_sortie as single-day span)
    sorties
      .filter(s => s.date_sortie && isValidatedStatut(s.statut))
      .forEach(s => {
        const empName = empMap[String(s.matricule)] || `Matr. ${s.matricule}`
        const d = isoToDate(s.date_sortie)
        const timeLabel = s.heure_sortie && s.heure_retour ? ` (${s.heure_sortie}–${s.heure_retour})` : ''
        events.push({
          id: `sortie-${s.id_sortie}`,
          label: `Sortie — ${empName}${timeLabel}`,
          type: 'SORTIE',
          matricule: String(s.matricule || ''),
          start: d,
          end:   d,
          raw: s,
        })
      })

    return events
  }, [ops, sorties, empMap])

  function matchesFilters(event) {
    if (selectedPerson !== 'tous' && event.matricule !== selectedPerson) return false
    if (selectedType   !== 'tous' && event.type      !== selectedType)   return false
    return true
  }

  function eventsForDay(date) {
    return allEvents.filter(e => dateInRange(date, e.start, e.end) && matchesFilters(e))
  }

  const days   = getDaysInMonth(year, month)
  const offset = getFirstDayOfMonth(year, month)
  const cells  = Array.from({length: offset + days}, (_, i) => i < offset ? null : i - offset + 1)

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y-1) }
    else setMonth(m => m-1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y+1) }
    else setMonth(m => m+1)
  }

  const todayD = now.getDate(), todayM = now.getMonth(), todayY = now.getFullYear()
  const WORK_HOURS = Array.from({length: 13}, (_, i) => 7 + i)
  const fmt2 = n => String(n).padStart(2, '0')

  // Shared event pill renderer
  function EventPill({ event, style = {} }) {
    const m = getMeta(event.type)
    const EIcon = m.Icon
    return (
      <div
        role="button"
        tabIndex={0}
        title={event.label}
        onClick={() => setSelectedEvent(event)}
        onKeyDown={e => e.key === 'Enter' && setSelectedEvent(event)}
        style={{
          fontSize:'0.6rem', padding:'2px 5px', borderRadius:'4px', marginBottom:'2px',
          background:m.bg, color:m.text, border:`1px solid ${m.border}`,
          overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis',
          display:'flex', alignItems:'center', gap:'3px',
          cursor:'pointer', transition:'filter 0.1s',
          ...style,
        }}
      >
        <EIcon size={8} strokeWidth={2.5} style={{flexShrink:0}} />
        <span style={{overflow:'hidden', textOverflow:'ellipsis'}}>{event.label}</span>
      </div>
    )
  }

  return (
    <>
      <div style={{background:'var(--card)', borderRadius:10, padding:'18px 20px', boxShadow:'0 1px 6px rgba(2,22,46,0.08)'}}>

        {/* ── Header ── */}
        <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:14, borderBottom:'1px solid #e5e7eb', paddingBottom:12}}>
          <h2 style={{margin:0, fontSize:'1rem', fontWeight:700, color:'#111827', flexGrow:1}}>
            Calendrier des Opérations
          </h2>
          {/* View toggle */}
          <div style={{display:'flex', background:'#f1f5f9', borderRadius:8, padding:3, gap:2}}>
            {[['mensuel','Mensuel'],['hebdomadaire','Semaine'],['annuel','Annuel']].map(([v,l]) => (
              <button key={v} onClick={() => setViewMode(v)} style={{
                background: viewMode === v ? '#02162e' : 'transparent',
                border:'none', borderRadius:6, padding:'5px 13px', cursor:'pointer',
                fontSize:'0.72rem', fontWeight:700,
                color: viewMode === v ? '#fff' : '#64748b',
                transition:'background 0.15s, color 0.15s',
              }}>{l}</button>
            ))}
          </div>
        </div>

        {/* ── Controls row ── */}
        <div style={{display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:12}}>
          {/* Nav */}
          {viewMode === 'mensuel' && (
            <div style={{display:'flex', alignItems:'center', gap:6}}>
              <button onClick={prevMonth} style={navBtn}><ChevronLeft size={14} /></button>
              <span style={{fontWeight:700, fontSize:'0.88rem', minWidth:130, textAlign:'center', color:'#02162e'}}>{MONTHS[month]} {year}</span>
              <button onClick={nextMonth} style={navBtn}><ChevronRight size={14} /></button>
            </div>
          )}
          {viewMode === 'annuel' && (
            <div style={{display:'flex', alignItems:'center', gap:6}}>
              <button onClick={() => setYear(y => y-1)} style={navBtn}><ChevronLeft size={14} /></button>
              <span style={{fontWeight:700, fontSize:'0.88rem', minWidth:60, textAlign:'center', color:'#02162e'}}>{year}</span>
              <button onClick={() => setYear(y => y+1)} style={navBtn}><ChevronRight size={14} /></button>
            </div>
          )}
          {viewMode === 'hebdomadaire' && (
            <div style={{display:'flex', alignItems:'center', gap:6}}>
              <button onClick={() => setWeekOffset(w => w-1)} style={navBtn}><ChevronLeft size={14} /></button>
              <span style={{fontWeight:700, fontSize:'0.8rem', minWidth:200, textAlign:'center', color:'#02162e'}}>
                {weekDays[0].toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})} – {weekDays[6].toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}
              </span>
              <button onClick={() => setWeekOffset(w => w+1)} style={navBtn}><ChevronRight size={14} /></button>
              <button onClick={() => setWeekOffset(0)} style={{...navBtn, width:'auto', padding:'0 10px', fontSize:'0.7rem', fontWeight:700}}>Auj.</button>
            </div>
          )}

          <div style={{marginLeft:'auto', display:'flex', gap:8, flexWrap:'wrap'}}>
            {/* Person filter */}
            <select value={selectedPerson} onChange={e => setSelectedPerson(e.target.value)} style={selectStyle}>
              <option value="tous">Toutes les personnes</option>
              {employees.map(e => (
                <option key={e.matricule} value={String(e.matricule)}>
                  {`${e.prenom||''} ${e.nom||''}`.trim() || e.matricule}
                </option>
              ))}
            </select>
            {/* Type filter */}
            <select value={selectedType} onChange={e => setSelectedType(e.target.value)} style={selectStyle}>
              {TYPE_FILTER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Legend ── */}
        <div style={{display:'flex', flexWrap:'wrap', gap:5, marginBottom:12, paddingBottom:10, borderBottom:'1px solid #f1f5f9'}}>
          {Object.entries(TYPE_META).map(([t, m]) => {
            const LIcon = m.Icon
            return (
              <button
                key={t}
                onClick={() => setSelectedType(prev => prev === t ? 'tous' : t)}
                style={{
                  display:'inline-flex', alignItems:'center', gap:4,
                  padding:'3px 9px', borderRadius:999, fontSize:'0.67rem', fontWeight:700,
                  background: selectedType === t ? m.border : m.bg,
                  color: selectedType === t ? '#fff' : m.text,
                  border:`1px solid ${m.border}`,
                  cursor:'pointer', transition:'background 0.12s, color 0.12s',
                }}
              >
                <LIcon size={10} strokeWidth={2.5} />
                {m.label}
              </button>
            )
          })}
        </div>

        {loading ? (
          <div style={{textAlign:'center', padding:'60px 0', color:'#94a3b8'}}>
            <div style={{fontSize:'0.85rem', fontWeight:600}}>Chargement…</div>
          </div>

        ) : viewMode === 'mensuel' ? (
          /* ══════════ MONTHLY VIEW ══════════ */
          <>
            <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px', marginBottom:2}}>
              {DAYS.map(d => (
                <div key={d} style={{textAlign:'center', fontSize:'0.7rem', fontWeight:700, color:'#94a3b8', padding:'4px 0'}}>{d}</div>
              ))}
            </div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3}}>
              {cells.map((day, idx) => {
                if (!day) return <div key={idx} style={{minHeight:72}} />
                const date = new Date(year, month, day)
                const isToday = day === todayD && month === todayM && year === todayY
                const dayEvents = eventsForDay(date)
                return (
                  <div key={idx} style={{
                    minHeight:72, borderRadius:6,
                    border: isToday ? '2px solid #d0202b' : '1px solid #e5e7eb',
                    background: isToday ? '#fff8f8' : '#fff',
                    padding:'3px 4px',
                  }}>
                    <div style={{
                      fontSize:'0.68rem', fontWeight: isToday ? 800 : 500,
                      color: isToday ? '#d0202b' : '#6b7280',
                      textAlign:'right', marginBottom:2,
                    }}>{day}</div>
                    {dayEvents.slice(0, 3).map((e, i) => (
                      <EventPill key={i} event={e} />
                    ))}
                    {dayEvents.length > 3 && (
                      <div style={{fontSize:'0.58rem', color:'#94a3b8', paddingLeft:3}}>+{dayEvents.length-3} autre{dayEvents.length-3 > 1 ? 's' : ''}</div>
                    )}
                  </div>
                )
              })}
            </div>
          </>

        ) : viewMode === 'annuel' ? (
          /* ══════════ ANNUAL VIEW ══════════ */
          <div style={{display:'grid', gridTemplateColumns:'repeat(3, minmax(200px, 1fr))', gap:10}}>
            {MONTHS.map((monthLabel, monthIndex) => {
              const aDays   = getDaysInMonth(year, monthIndex)
              const aOffset = getFirstDayOfMonth(year, monthIndex)
              const aCells  = Array.from({length: aOffset + aDays}, (_, i) => i < aOffset ? null : i - aOffset + 1)
              return (
                <div key={monthLabel} style={{border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 6px', background:'var(--card)'}}>
                  <div style={{fontSize:'0.76rem', fontWeight:700, color:'#02162e', marginBottom:5, paddingLeft:2}}>{monthLabel}</div>
                  <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:1, marginBottom:3}}>
                    {DAYS.map(d => <div key={d} style={{fontSize:'0.55rem', textAlign:'center', color:'#94a3b8', fontWeight:700}}>{d[0]}</div>)}
                  </div>
                  <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:1}}>
                    {aCells.map((day, idx) => {
                      if (!day) return <div key={`${monthIndex}-${idx}`} style={{minHeight:20}} />
                      const date = new Date(year, monthIndex, day)
                      const dayEvts = eventsForDay(date)
                      const isToday = day === todayD && monthIndex === todayM && year === todayY
                      // Show up to 3 colored dots
                      const dots = dayEvts.slice(0, 3)
                      return (
                        <div
                          key={`${monthIndex}-${day}`}
                          title={dayEvts.map(e => e.label).join(' | ') || undefined}
                          onClick={() => dayEvts.length === 1 && setSelectedEvent(dayEvts[0])}
                          style={{
                            minHeight:22, borderRadius:4, border: isToday ? '1.5px solid #d0202b' : '1px solid #f1f5f9',
                            background: dayEvts.length ? '#f0f4ff' : '#fff',
                            fontSize:'0.6rem', display:'flex', flexDirection:'column',
                            alignItems:'center', justifyContent:'center',
                            color: isToday ? '#d0202b' : '#334155',
                            fontWeight: isToday || dayEvts.length ? 700 : 400,
                            cursor: dayEvts.length === 1 ? 'pointer' : 'default',
                          }}
                        >
                          {day}
                          {dots.length > 0 && (
                            <div style={{display:'flex', gap:1, marginTop:1}}>
                              {dots.map((e, i) => {
                                const dm = getMeta(e.type)
                                return <div key={i} style={{width:4, height:4, borderRadius:999, background:dm.border}} />
                              })}
                              {dayEvts.length > 3 && <div style={{width:4, height:4, borderRadius:999, background:'#9ca3af'}} />}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* ══════════ WEEKLY VIEW ══════════ */
          <div style={{overflowX:'auto'}}>
            <div style={{display:'grid', gridTemplateColumns:'56px repeat(7,1fr)', borderBottom:'2px solid #e5e7eb'}}>
              <div style={{padding:'6px', fontSize:'0.65rem', color:'#94a3b8', textAlign:'center', borderRight:'1px solid #e5e7eb', fontWeight:700}}>H</div>
              {weekDays.map((d, i) => {
                const isToday = d.toDateString() === now.toDateString()
                return (
                  <div key={i} style={{padding:'8px 4px', textAlign:'center', borderLeft:'1px solid #e5e7eb', background: isToday ? '#fff8f8' : 'white'}}>
                    <div style={{fontSize:'0.68rem', color:'#64748b', fontWeight:600}}>{DAYS[i]}</div>
                    <div style={{fontSize:'1rem', fontWeight: isToday ? 800 : 600, color: isToday ? '#d0202b' : '#02162e'}}>{d.getDate()}</div>
                    <div style={{fontSize:'0.65rem', color:'#94a3b8'}}>{d.toLocaleDateString('fr-FR',{month:'short'})}</div>
                  </div>
                )
              })}
            </div>

            {/* All-day row */}
            <div style={{display:'grid', gridTemplateColumns:'56px repeat(7,1fr)', borderBottom:'2px solid #e5e7eb', background:'#fafafa'}}>
              <div style={{padding:'4px 4px', fontSize:'0.6rem', color:'#94a3b8', textAlign:'center', borderRight:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, lineHeight:1.2}}>
                Journée
              </div>
              {weekDays.map((d, idx) => {
                const allDayEvts = eventsForDay(d).filter(e => !(e.type === 'SORTIE' && e.raw?.heure_sortie && e.raw?.heure_retour))
                return (
                  <div key={idx} style={{padding:3, borderLeft:'1px solid #e5e7eb', minHeight:36}}>
                    {allDayEvts.map((e, i) => (
                      <EventPill key={i} event={e} style={{fontSize:'0.62rem', padding:'2px 5px', fontWeight:700}} />
                    ))}
                  </div>
                )
              })}
            </div>

            {/* Hourly rows */}
            {WORK_HOURS.map(h => (
              <div key={h} style={{display:'grid', gridTemplateColumns:'56px repeat(7,1fr)', borderBottom:'1px solid #f1f5f9', minHeight:40}}>
                <div style={{padding:'4px 6px', fontSize:'0.7rem', fontWeight:700, color:'#94a3b8', borderRight:'1px solid #e5e7eb', textAlign:'right', paddingTop:5, background:'#fafafa'}}>
                  {fmt2(h)}:00
                </div>
                {weekDays.map((d, idx) => {
                  const dayEvts = eventsForDay(d)
                  const sortiesThisHour = dayEvts.filter(e =>
                    e.type === 'SORTIE' && e.raw?.heure_sortie && e.raw?.heure_retour &&
                    parseHourMin(e.raw.heure_sortie) < (h + 1) * 60 &&
                    parseHourMin(e.raw.heure_retour) > h * 60
                  )
                  const nonSortieEvts = dayEvts.filter(e => e.type !== 'SORTIE')
                  const hasAbs = nonSortieEvts.length > 0
                  const fc = hasAbs ? getMeta(nonSortieEvts[0].type) : null
                  return (
                    <div key={idx} style={{
                      borderLeft:'1px solid #f1f5f9', minHeight:40,
                      padding: sortiesThisHour.length ? '2px' : 0,
                      background: hasAbs ? `${fc.bg}99` : h % 2 === 0 ? '#fafafa' : 'white',
                    }}>
                      {sortiesThisHour.map((e, i) => (
                        <EventPill key={i} event={e} style={{fontSize:'0.6rem', fontWeight:700}} />
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Detail Modal ── */}
      <EventDetailModal event={selectedEvent} empMap={empMap} onClose={() => setSelectedEvent(null)} />
    </>
  )
}

const navBtn = {
  background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:6,
  width:28, height:28, cursor:'pointer',
  display:'flex', alignItems:'center', justifyContent:'center',
  color:'#374151', flexShrink:0,
}

const selectStyle = {
  padding:'6px 10px', border:'1px solid #d1d5db', borderRadius:6,
  fontSize:'0.78rem', background:'#fff', color:'#1f2937', cursor:'pointer',
}
