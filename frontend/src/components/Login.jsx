import React, {useState} from 'react'
import {useAuth} from '../contexts/AuthContext'
import {useNavigate} from 'react-router-dom'
import api from '../services/api'
import {validatePasswordPolicy} from '../utils/passwordPolicy'

export default function Login(){
  const [matricule,setMatricule]=useState('')
  const [password,setPassword]=useState('')
  const [mfa,setMfa]=useState('')
  const [err,setErr]=useState(null)
  const [email,setEmail]=useState('')
  const [emailMsg,setEmailMsg]=useState(null)
  const [showEmail,setShowEmail]=useState(false) // toggle between forms
  const {login}=useAuth()
  const nav = useNavigate()

  async function submit(e){
    e.preventDefault(); setErr(null)
    const pwOk = validatePasswordPolicy(password)
    if(!pwOk.ok){setErr(pwOk.message);return}
    try{
      await login({matricule,password,mfaCode:mfa})
      nav('/home')
    }catch(e){
      // Handle both string and nested error objects
      let errMsg = 'Erreur connexion'
      if(e.response?.data?.detail){
        const detail = e.response.data.detail
        errMsg = typeof detail === 'string' ? detail : JSON.stringify(detail)
      }
      setErr(errMsg)
    }
  }

  async function submitEmail(e){
    e.preventDefault(); setEmailMsg(null)
    if(!email || email.trim()===''){
      setEmailMsg('Veuillez entrer votre adresse email')
      return
    }
    try{
      const res = await api.post('/auth/login/email', new URLSearchParams({email}))
      setEmailMsg('Lien envoyé ! Vérifiez votre boîte mail.')
    }catch(e){setEmailMsg(e.response?.data?.detail || 'Erreur envoi email')}
  }

  return (
    <div className="container">
      {/* show either matricule or email form */}
      {!showEmail ? (
        <div className="card" style={{maxWidth:480,margin:'0 auto',marginBottom:24}}>
          <h2>Connexion par matricule</h2>
          <form onSubmit={submit} style={{display:'grid',gap:8}}>
            <input className="input" placeholder="Matricule" value={matricule} onChange={e=>setMatricule(e.target.value)} />
            <input className="input" placeholder="Mot de passe" value={password} onChange={e=>setPassword(e.target.value)} type="password" />
            <input className="input" placeholder="Code MFA (si requis)" value={mfa} onChange={e=>setMfa(e.target.value)} />
            {err && <div className="error">{err}</div>}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <button className="button" type="submit">Se connecter</button>
            </div>
          </form>
          <div style={{textAlign:'right',marginTop:8}}>
            <button className="small" style={{background:'none',border:'none',color:'#0366d6',cursor:'pointer'}} onClick={()=>setShowEmail(true)}>
              ou connexion par email
            </button>
          </div>
        </div>
      ) : (
        <div className="card" style={{maxWidth:480,margin:'0 auto',marginBottom:24}}>
          <h2>Connexion par email</h2>
          <form onSubmit={submitEmail} style={{display:'grid',gap:8}}>
            <input className="input" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} type="email" />
            <button className="button" type="submit">Recevoir le lien</button>
          </form>
          {emailMsg && <div className="small">{emailMsg}</div>}
          <div style={{textAlign:'right',marginTop:8}}>
            <button className="small" style={{background:'none',border:'none',color:'#0366d6',cursor:'pointer'}} onClick={()=>setShowEmail(false)}>
              ou connexion par matricule
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
