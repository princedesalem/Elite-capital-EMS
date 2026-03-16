import React, {useState} from 'react'
import {NavLink, Outlet, useLocation} from 'react-router-dom'
import {useAuth} from '../contexts/AuthContext'

const SIDEBAR_BG = '#112033'
const SIDEBAR_BG_ALT = '#17283d'
const SIDEBAR_BORDER = 'rgba(255,255,255,0.08)'
const SIDEBAR_TEXT = '#f3f6fb'
const SIDEBAR_MUTED = 'rgba(243,246,251,0.64)'
const ACCENT = '#ce2b2b'

function Icon({name, size = 18, stroke = 1.8}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: stroke,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  const icons = {
    home: (<path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5M9 21v-6h6v6" />),
    chart: (<><path d="M4 20h16" /><path d="M7 16V9" /><path d="M12 16V5" /><path d="M17 16v-3" /></>),
    org: (<><path d="M12 4v5" /><path d="M6 14h12" /><rect x="3" y="14" width="6" height="6" rx="1" /><rect x="15" y="14" width="6" height="6" rx="1" /><rect x="9" y="8" width="6" height="4" rx="1" /></>),
    users: (<><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy="7" r="3" /><path d="M20 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 4.13a3 3 0 0 1 0 5.74" /></>),
    leave: (<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>),
    operations: (<><path d="M4 7h16" /><path d="M7 4v6" /><path d="M17 14h3v3" /><path d="M20 14l-5.5 5.5-3-3" /></>),
    mission: (<><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7Z" /></>),
    evaluation: (<><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>),
    calendar: (<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /><path d="M8 14h3v3H8z" /></>),
    exit: (<><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M14 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /></>),
    bell: (<><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .53-.21 1.04-.59 1.4L4 17h5" /><path d="M10 17a2 2 0 0 0 4 0" /></>),
    box: (<><path d="M12 3 4 7l8 4 8-4-8-4Z" /><path d="M4 7v10l8 4 8-4V7" /><path d="M12 11v10" /></>),
    briefcase: (<><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>),
    megaphone: (<><path d="M3 11v2" /><path d="M7 10v4" /><path d="M7 10 19 6v12L7 14" /><path d="M7 14l2 6" /></>),
    signal: (<><path d="M4 18a8 8 0 0 1 0-12" /><path d="M8 15a4 4 0 0 1 0-6" /><path d="M12 12h.01" /><path d="M16 9a4 4 0 0 1 0 6" /><path d="M20 6a8 8 0 0 1 0 12" /></>),
    monitor: (<><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8" /><path d="M12 16v4" /></>),
    car: (<><path d="M5 16l1.5-5h11L19 16" /><path d="M5 16h14" /><circle cx="7.5" cy="17.5" r="1.5" /><circle cx="16.5" cy="17.5" r="1.5" /></>),
    audit: (<><path d="M14 3h7v7" /><path d="M10 14 21 3" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></>),
    folder: (<><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></>),
    handshake: (<><path d="M8 12 11 9a2.5 2.5 0 0 1 3.5 0L17 11.5" /><path d="M3 12l4-4 4 4-4 4-4-4Z" /><path d="M21 12l-4-4-4 4 4 4 4-4Z" /></>),
    usage: (<><path d="M4 19V5" /><path d="M9 19V9" /><path d="M14 19v-5" /><path d="M19 19v-9" /></>),
    shield: (<><path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3Z" /><path d="m9 12 2 2 4-4" /></>),
    settings: (<><path d="M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 1 0 12 8.5Z" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-.4-1.1 1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2.8a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.1-.4 1.7 1.7 0 0 0 .6-1A1.7 1.7 0 0 0 4.26 6.3L4.2 6.24A2 2 0 1 1 7.03 3.4l.06.06A1.7 1.7 0 0 0 8.96 3.8a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V2a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 .4 1.1 1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.87-.34l.06-.06A2 2 0 1 1 20.52 6.2l-.06.06A1.7 1.7 0 0 0 19.4 8a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.1.4 1.7 1.7 0 0 0-.6 1Z" /></>),
    key: (<><path d="M21 2l-2 2" /><path d="M17.5 5.5A4.5 4.5 0 1 1 14 4l7-2-1.5 3.5Z" /><path d="M6 14l-4 4 2 2 4-4" /></>),
    lock: (<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 1 1 8 0v3" /></>),
  }

  return <svg {...common}>{icons[name]}</svg>
}

const MODULES = [
  {
    id: 'rh',
    icon: 'users',
    label: 'Ressources Humaines',
    subs: [
      {label: 'Employés', path: '/rh/employees', adminOnly: true},
      {label: 'Administration', path: '/rh/administration', adminMgmtOnly: true},
      {label: 'Absences', path: '/rh/absences', isGroup: true, groupSubs: [
        {label: 'Congés',            path: '/rh/conges'},
        {label: 'Permissions',       path: '/rh/permissions'},
        {label: 'Demandes de Sortie',path: '/rh/sorties'},
      ]},
      {label: 'Opérations', path: '/rh/operations'},
      {label: 'Missions', path: '/rh/missions', isGroup: true, groupSubs: [
        {label: 'Missions',          path: '/rh/missions'},
        {label: 'Frais de mission',  path: '/rh/frais'},
        {label: 'Missions IG',       path: '/rh/missions-ig'},
      ]},
      {label: 'Évaluations', path: '/rh/evaluations'},
      {label: 'Calendrier Congés', path: '/rh/calendrier-conge'},
      {label: 'Workflow', path: '/rh/operations?tab=workflow'},
      {label: 'Tâches', path: '/rh/tasks'},
      {label: 'Événements', path: '/rh/events'},
      {label: 'Analytics RH', path: '/rh/analytics'},
      {label: 'Parcours Employé', path: '/rh/timeline'},
      {label: 'Performance 360°', path: '/rh/performance'},
      {label: 'Workforce Planning', path: '/rh/workforce'},
      {label: 'Talent Management', path: '/rh/talent'},
      {label: 'Club Review', path: '/rh/club-review'},
      {label: 'Sandbox', path: '/rh/sandbox'},
    ]
  },
  {id:'achats',    icon:'box', label:'Achats',                subs:[{label:'Prochainement', path:'/rh/module/achats'}]},
  {id:'commercial',icon:'briefcase', label:'Commercial',      subs:[{label:'Prochainement', path:'/rh/module/commercial'}]},
  {id:'marketing', icon:'megaphone', label:'Marketing',       subs:[{label:'Prochainement', path:'/rh/module/marketing'}]},
  {id:'comms',     icon:'signal', label:'Communication',      subs:[{label:'Prochainement', path:'/rh/module/communication'}]},
  {id:'si',        icon:'monitor', label:"Système d'Information", subs:[{label:'Prochainement', path:'/rh/module/si'}]},
  {id:'flotte',    icon:'car', label:'Flotte',                subs:[{label:'Prochainement', path:'/rh/module/flotte'}]},
  {id:'audit',     icon:'audit', label:'Audit',               subs:[{label:'Prochainement', path:'/rh/module/audit'}]},
  {id:'projets',   icon:'folder', label:'Gestion des Projets', subs:[{label:'Prochainement', path:'/rh/module/projets'}]},
  {id:'crm',       icon:'handshake', label:'CRM',             subs:[{label:'Prochainement', path:'/rh/module/crm'}]},
]

function getInitialOpen(pathname) {
  const mod = MODULES.find(m => m.subs.some(s => pathname.startsWith(s.path)))
  return mod ? mod.id : 'rh'
}

function quickLink(isActive) {
  return {
    display:'flex', alignItems:'center', gap:'8px',
    padding:'10px 12px', borderRadius:'8px',
    textDecoration:'none', fontSize:'0.92rem', fontWeight:700,
    color: SIDEBAR_TEXT,
    background: isActive ? 'linear-gradient(90deg, rgba(206,43,43,0.24), rgba(206,43,43,0.08))' : 'transparent',
    borderLeft: isActive ? `3px solid ${ACCENT}` : '3px solid transparent',
    marginBottom:'4px', transition:'background 0.15s, color 0.15s',
  }
}

function subLink(isActive) {
  return {
    display:'flex', alignItems:'center', gap:'10px', padding:'8px 10px', borderRadius:'7px',
    textDecoration:'none', fontSize:'0.86rem', fontWeight:600,
    color: isActive ? SIDEBAR_TEXT : SIDEBAR_MUTED,
    background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
    borderLeft: isActive ? `2px solid ${ACCENT}` : '2px solid transparent',
    marginBottom:'3px', transition:'background 0.15s, color 0.15s',
  }
}

export default function RHLayout() {
  const {user} = useAuth()
  const location = useLocation()
  const role = user?.role || ''
  const isAdminRH = ['RH','PCA','ADMIN'].includes(role)
  const isAdminStats = ['RH','DG','PCA','ADMIN'].includes(role)
  const isAdminMgmt = ['RH','DG','PCA','ADMIN'].includes(role)

  const [open, setOpen] = useState(() => ({[getInitialOpen(location.pathname)]: true}))
  const toggle = id => setOpen(p => ({...p, [id]: !p[id]}))

  const absencePaths = ['/rh/absences', '/rh/conges', '/rh/permissions', '/rh/sorties']
  const missionPaths = ['/rh/missions', '/rh/frais', '/rh/missions-ig']
  const [openGroups, setOpenGroups] = useState(() => {
    const init = {}
    if (absencePaths.some(p => location.pathname.startsWith(p))) init['/rh/absences'] = true
    if (missionPaths.some(p => location.pathname.startsWith(p))) init['/rh/missions'] = true
    return init
  })
  const toggleGroup = key => setOpenGroups(p => ({...p, [key]: !p[key]}))

  return (
    <div style={{display:'flex', minHeight:'calc(100vh - 50px)'}}>

      {/* ── Sidebar ── */}
      <aside style={{
        width:'250px', minWidth:'250px', background:SIDEBAR_BG,
        display:'flex', flexDirection:'column',
        position:'sticky', top:'50px',
        height:'calc(100vh - 50px)', overflowY:'auto', zIndex:10,
        borderRight:`1px solid ${SIDEBAR_BORDER}`,
      }}>
        {/* Brand */}
        <div style={{padding:'16px 16px 12px', borderBottom:`1px solid ${SIDEBAR_BORDER}`, background:SIDEBAR_BG_ALT}}>
          <div style={{fontSize:'0.72rem', color:SIDEBAR_MUTED, letterSpacing:'0.09em', textTransform:'uppercase'}}>Elite Capital</div>
          <div style={{fontSize:'1.05rem', fontWeight:800, color:SIDEBAR_TEXT, marginTop:'2px'}}>EMS Platform</div>
        </div>

        <nav style={{padding:'10px', flex:1}}>
          <div style={{fontSize:'0.72rem', color:SIDEBAR_MUTED, padding:'0 8px 8px', letterSpacing:'0.07em', textTransform:'uppercase', fontWeight:700}}>Modules</div>

          {/* Accordion modules */}
          {MODULES.map(mod => {
            const isOpen = !!open[mod.id]
            const visibleSubs = mod.id === 'rh'
              ? mod.subs.filter(s => (!s.adminOnly || isAdminRH) && (!s.adminMgmtOnly || isAdminMgmt))
              : mod.subs
            return (
              <div key={mod.id} style={{marginBottom:'1px'}}>
                <button onClick={() => toggle(mod.id)} style={{
                  width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'10px 12px', background:isOpen ? 'rgba(255,255,255,0.05)' : 'transparent', border:'none', borderRadius:'8px',
                  cursor:'pointer', color:SIDEBAR_TEXT, fontSize:'0.93rem', fontWeight:700,
                }}>
                  <span style={{display:'flex', alignItems:'center', gap:'10px'}}><Icon name={mod.icon} /> {mod.label}</span>
                  <span style={{fontSize:'0.7rem', opacity:0.65}}>{isOpen ? '▲' : '▼'}</span>
                </button>
                {isOpen && (
                  <div style={{paddingLeft:'16px', paddingBottom:'6px'}}>
                    {visibleSubs.map(s => {
                      if (s.isGroup) {
                        const grpOpen = !!openGroups[s.path]
                        const grpActive = s.groupSubs.some(gs => location.pathname.startsWith(gs.path)) || location.pathname.startsWith(s.path)
                        return (
                          <div key={s.path}>
                            <button
                              onClick={() => toggleGroup(s.path)}
                              style={{
                                ...subLink(grpActive),
                                width: '100%', border: 'none', cursor: 'pointer',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                background: grpActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                              }}
                            >
                              <span style={{display:'flex', alignItems:'center', gap:10}}>
                                <span style={{width:'4px', height:'4px', borderRadius:'50%', background:'currentColor', opacity:0.9}} />
                                <span>{s.label}</span>
                              </span>
                              <span style={{fontSize:'0.65rem', opacity:0.55, marginLeft:4}}>{grpOpen ? '▲' : '▼'}</span>
                            </button>
                            {grpOpen && (
                              <div style={{paddingLeft:14, marginTop:2}}>
                                {s.groupSubs.map(gs => (
                                  <NavLink key={gs.path} to={gs.path} style={({isActive}) => ({
                                    ...subLink(isActive),
                                    fontSize: '0.8rem',
                                    padding: '6px 10px',
                                  })}>
                                    <span style={{width:'3px', height:'3px', borderRadius:'50%', background:'currentColor', opacity:0.8}} />
                                    <span>{gs.label}</span>
                                  </NavLink>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      }
                      return (
                        <NavLink key={s.path} to={s.path} style={({isActive})=>subLink(isActive)}>
                          <span style={{width:'4px', height:'4px', borderRadius:'50%', background:'currentColor', opacity:0.9}} />
                          <span>{s.label}</span>
                        </NavLink>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          <div style={{height:'1px', background:SIDEBAR_BORDER, margin:'10px 0'}} />

          {/* Stats & admin */}
          <NavLink to="/rh/usage-stats" style={({isActive})=>quickLink(isActive)}><Icon name="usage" /> Utilisation</NavLink>
          {isAdminStats && <NavLink to="/rh/admin/usage-stats" style={({isActive})=>quickLink(isActive)}><Icon name="shield" /> Stats Admin</NavLink>}

          <div style={{height:'1px', background:SIDEBAR_BORDER, margin:'10px 0'}} />

          <NavLink to="/rh/notifications" style={({isActive})=>quickLink(isActive)}><Icon name="bell" /> Notifications</NavLink>

          <div style={{height:'1px', background:SIDEBAR_BORDER, margin:'10px 0'}} />

          {/* Bottom */}
          <NavLink to="/rh/parametrage" style={({isActive})=>quickLink(isActive)}><Icon name="settings" /> Paramétrage</NavLink>
          <NavLink to="/rh/password"    style={({isActive})=>quickLink(isActive)}><Icon name="key" /> Mot de passe</NavLink>
          <NavLink to="/rh/mfa"         style={({isActive})=>quickLink(isActive)}><Icon name="lock" /> MFA</NavLink>
        </nav>
      </aside>

      {/* ── Content area ── */}
      <main style={{flex:1, minWidth:0, padding:'16px', background:'#f4f5f7', overflowY:'auto'}}>
        <Outlet />
      </main>
    </div>
  )
}
