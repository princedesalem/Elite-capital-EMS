import React from 'react'
import {useNavigate} from 'react-router-dom'
import LeaveRequestForm from '../components/LeaveRequestForm'

export default function LeaveForm(){
  const nav = useNavigate()

  return (
    <div className="container">
      <div className="card" style={{maxWidth:600}}>
        <h2>Nouvelle demande</h2>
        <LeaveRequestForm onSuccess={() => nav('/rh/leaves')} submitLabel="Envoyer" />
      </div>
    </div>
  )
}
