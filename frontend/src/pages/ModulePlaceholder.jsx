import React from 'react'
import {useParams} from 'react-router-dom'
const LABELS = {
  achats: 'Achats',
  commercial: 'Commercial',
  marketing: 'Marketing',
  communication: 'Communication',
  si: "Système d'Information",
  flotte: 'Flotte',
  audit: 'Audit',
  projets: 'Gestion des Projets',
  crm: 'CRM',
}

export default function ModulePlaceholder() {
  const {slug} = useParams()
  const label = LABELS[slug] || 'Module'

  return (
    <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', gap:'16px'}}>
      <div style={{fontSize:'1.1rem', fontWeight:700, color:'#475569'}}>{"Bientôt disponible"}</div>
      <h2 style={{margin:0, color:'#1f2937', fontSize:'1.3rem', fontWeight:700}}>Module {label}</h2>
      <p style={{margin:0, color: 'var(--text-secondary)', fontSize:'0.9rem'}}>{"Ce module sera disponible prochainement."}</p>
    </div>
  )
}
