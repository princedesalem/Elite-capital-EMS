import React, { useState, useEffect } from 'react'
import api from '../services/api'
import { Calendar, ClipboardList, Car, Target, Check, Clock, Building2 } from 'lucide-react'

export default function WorkflowPage() {
  const [pendingRequests, setPendingRequests] = useState({
    conges: 0,
    permissions: 0,
    sorties: 0,
    missions: 0,
  })

  useEffect(() => {
    Promise.all([
      api.get('/conges').catch(() => ({data: []})),
      api.get('/leaves').catch(() => ({data: []})),
      api.get('/api/sorties').catch(() => ({data: []})),
      api.get('/api/missions').catch(() => ({data: []})),
    ]).then(([congesRes, permRes, sortiesRes, missionsRes]) => {
      setPendingRequests({
        conges: congesRes.data.filter(c => c.statut === 'en attente').length,
        permissions: permRes.data.filter(p => (p.statut || p.status) === 'en attente').length,
        sorties: sortiesRes.data.filter(s => s.statut === 'en attente').length,
        missions: missionsRes.data.filter(m => m.statut === 'en attente').length,
      })
    })
  }, [])

  const workflows = [
    { label: 'Congés', pending: pendingRequests.conges, Icon: Calendar, color: '#10b981' },
    { label: 'Permissions', pending: pendingRequests.permissions, Icon: ClipboardList, color: '#3b82f6' },
    { label: 'Sorties', pending: pendingRequests.sorties, Icon: Car, color: '#f59e0b' },
    { label: 'Missions', pending: pendingRequests.missions, Icon: Target, color: '#8b5cf6' },
  ]

  return (
    <div style={{padding:'28px'}}>
      <h1 style={{margin:'0 0 24px 0', fontSize:'1.8rem', fontWeight:800, color:'#021630'}}>Vue d'ensemble des workflow</h1>

      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(250px, 1fr))', gap:'20px', marginBottom:'32px'}}>
        {workflows.map(w => (
          <div key={w.label} style={{background:'#fff', borderRadius:'10px', padding:'20px', boxShadow:'0 1px 3px rgba(0,0,0,0.08)', borderTop:`3px solid ${w.color}`}}>
            <div style={{marginBottom:'12px', color:w.color}}><w.Icon size={28}/></div>
            <h3 style={{margin:'0 0 12px 0', fontSize:'1rem', fontWeight:700, color:'#1f2937'}}>{w.label}</h3>
            <div style={{display:'flex', alignItems:'baseline', gap:'8px'}}>
              <div style={{fontSize:'1.8rem', fontWeight:800, color:w.color}}>{w.pending}</div>
              <div style={{fontSize:'0.85rem', color:'#6b7280'}}>demandes en attente</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{background:'#fff', borderRadius:'10px', padding:'24px', boxShadow:'0 1px 3px rgba(0,0,0,0.08)'}}>
        <h2 style={{margin:'0 0 16px 0', fontSize:'1.1rem', fontWeight:700, color:'#1f2937'}}>Étapes du workflow</h2>
        <div style={{display:'grid', gap:'16px'}}>
          <div style={{padding:'16px', background:'#f0f4f8', borderRadius:'8px', borderLeft:'3px solid #3b82f6'}}>
            <div style={{fontWeight:700, marginBottom:'6px', display:'flex', alignItems:'center', gap:6}}><Check size={14} color="#3b82f6"/> Soumission</div>
            <div style={{fontSize:'0.85rem', color:'#606060'}}>L'employé soumet sa demande</div>
          </div>
          <div style={{padding:'16px', background:'#f9fafb', borderRadius:'8px', borderLeft:'3px solid #f59e0b'}}>
            <div style={{fontWeight:700, marginBottom:'6px', display:'flex', alignItems:'center', gap:6}}><Clock size={14} color="#f59e0b"/> Vérification RH</div>
            <div style={{fontSize:'0.85rem', color:'#606060'}}>Validation administrative et vérification des droits</div>
          </div>
          <div style={{padding:'16px', background:'#f9fafb', borderRadius:'8px', borderLeft:'3px solid #f59e0b'}}>
            <div style={{fontWeight:700, marginBottom:'6px', display:'flex', alignItems:'center', gap:6}}><Clock size={14} color="#f59e0b"/> Approbation Manager</div>
            <div style={{fontSize:'0.85rem', color:'#606060'}}>Approbation du manager direct</div>
          </div>
          <div style={{padding:'16px', background:'#f0fdf4', borderRadius:'8px', borderLeft:'3px solid #10b981'}}>
            <div style={{fontWeight:700, marginBottom:'6px', display:'flex', alignItems:'center', gap:6}}><Check size={14} color="#10b981"/> Confirmée</div>
            <div style={{fontSize:'0.85rem', color:'#606060'}}>La demande est validée et confirmée</div>
          </div>
        </div>
      </div>
    </div>
  )
}
