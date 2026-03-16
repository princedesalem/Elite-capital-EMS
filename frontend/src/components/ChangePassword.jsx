import React, {useState} from 'react'
import api from '../services/api'

export default function ChangePassword(){
  const [mat, setMat] = useState('')
  const [oldp, setOldp] = useState('')
  const [newp, setNewp] = useState('')
  const [msg, setMsg] = useState(null)

  async function submit(e){
    e.preventDefault(); setMsg(null)
    const body = new URLSearchParams({matricule: mat, old_password: oldp, new_password: newp})
    try{
      await api.post('/auth/password/change', body)
      setMsg('Mot de passe changé')
    }catch(e){setMsg(e.response?.data?.detail || 'Erreur')}
  }

  return (
    <div className="container">
      <div className="card" style={{maxWidth:480,margin:'0 auto'}}>
        <h2>Changer mot de passe</h2>
        <form onSubmit={submit} style={{display:'grid',gap:8}}>
          <input className="input" placeholder="Matricule" value={mat} onChange={e=>setMat(e.target.value)} />
          <input className="input" placeholder="Ancien mot de passe" type="password" value={oldp} onChange={e=>setOldp(e.target.value)} />
          <input className="input" placeholder="Nouveau mot de passe" type="password" value={newp} onChange={e=>setNewp(e.target.value)} />
          {msg && <div className="small">{msg}</div>}
          <div style={{display:'flex',justifyContent:'flex-end'}}>
            <button className="button" type="submit">Enregistrer</button>
          </div>
        </form>
      </div>
    </div>
  )
}
