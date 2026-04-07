import React, {useState} from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

export default function MFASetup(){
  const navigate = useNavigate()
  const [mat, setMat] = useState('')
  const [secret, setSecret] = useState(null)
  const [otpauth, setOtpauth] = useState(null)

  async function setup(e){
    e.preventDefault()
    const res = await api.post('/auth/mfa/setup', new URLSearchParams({matricule: mat}))
    setSecret(res.data.secret)
    setOtpauth(res.data.otpauth)
  }

  return (
    <div className="container">
      <div className="card" style={{maxWidth:480,margin:'0 auto'}}>
        <h2>Enregistrer MFA</h2>
        <form onSubmit={setup} style={{display:'grid',gap:8}}>
          <input className="input" placeholder="Votre matricule" value={mat} onChange={e=>setMat(e.target.value)} />
          <button className="button" type="submit">Générer secret</button>
          <button className="button" type="button" onClick={() => navigate(-1)} style={{background:'#64748b'}}>Annuler</button>
        </form>
        {secret && (
          <div style={{marginTop:12}}>
            <div>Secret: <strong>{secret}</strong></div>
            <div>Otpauth: <small className="small">{otpauth}</small></div>
            <p className="small">Scannez l'URL dans votre application d'authentification.</p>
          </div>
        )}
      </div>
    </div>
  )
}
