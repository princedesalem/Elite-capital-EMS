import React, {useState} from 'react'
import api from '../services/api'
import {useNavigate} from 'react-router-dom'

export default function LeaveForm(){
  const [form,setForm]=useState({matricule:'',date_debut:'',date_fin:'',type:'conge',preuve:null,justification:''})
  const nav = useNavigate()
  const [err,setErr]=useState(null)

  function setField(k,v){setForm(s=>({...s,[k]:v}))}

  async function submit(e){
    e.preventDefault(); setErr(null)
    try{
      const payload = new FormData()
      Object.keys(form).forEach(k=>{ if(form[k] !== null) payload.append(k, form[k]) })
      await api.post('/leaves',payload,{headers:{'Content-Type':'multipart/form-data'}})
      nav('/leaves')
    }catch(e){setErr('Erreur envoi')}
  }

  return (
    <div className="container">
      <div className="card" style={{maxWidth:600}}>
        <h2>Nouvelle demande</h2>
        <form onSubmit={submit} style={{display:'grid',gap:8}}>
          <input className="input" placeholder="Matricule" value={form.matricule} onChange={e=>setField('matricule',e.target.value)} />
          <div className="form-row">
            <input className="input" type="date" value={form.date_debut} onChange={e=>setField('date_debut',e.target.value)} />
            <input className="input" type="date" value={form.date_fin} onChange={e=>setField('date_fin',e.target.value)} />
          </div>
          <select className="input" value={form.type} onChange={e=>setField('type',e.target.value)}>
            <option value="conge">Congé</option>
            <option value="maternite">Maternité</option>
            <option value="paternite">Paternité</option>
            <option value="maladie">Maladie</option>
            <option value="permission_formelle">Permission formelle</option>
            <option value="permission_informelle">Permission informelle</option>
          </select>
          <input className="input" type="file" onChange={e=>setField('preuve',e.target.files[0])} />
          <textarea className="input" placeholder="Justification" value={form.justification} onChange={e=>setField('justification',e.target.value)} />
          {err && <div style={{color:'crimson'}}>{err}</div>}
          <div style={{display:'flex',justifyContent:'flex-end'}}>
            <button className="button" type="submit">Envoyer</button>
          </div>
        </form>
      </div>
    </div>
  )
}
