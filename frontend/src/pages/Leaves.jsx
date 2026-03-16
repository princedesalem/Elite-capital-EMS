import React, {useEffect, useState} from 'react'
import api from '../services/api'
import {Link} from 'react-router-dom'

export default function Leaves(){
  const [list,setList]=useState([])
  useEffect(()=>{api.get('/leaves').then(r=>setList(r.data)).catch(()=>{})},[])
  return (
    <div className="container">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h2>Congés & Permissions</h2>
        <Link to="/leaves/new" className="button">Nouvelle demande</Link>
      </div>
      <div className="card" style={{marginTop:12}}>
        <table className="table">
          <thead><tr><th>Matricule</th><th>Type</th><th>Départ</th><th>Fin</th><th>Statut</th></tr></thead>
          <tbody>
            {list.map(l=> (
              <tr key={l.id_conge || l.id_permission}>
                <td>{l.matricule}</td>
                <td>{l.type}</td>
                <td>{l.date_debut}</td>
                <td>{l.date_fin}</td>
                <td>{l.statut}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
