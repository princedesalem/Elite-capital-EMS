import React, {useState} from 'react'
import {useAuth} from '../contexts/AuthContext'
import {useNavigate} from 'react-router-dom'
import api from '../services/api'
import {validatePasswordPolicy} from '../utils/passwordPolicy'

export default function Login(){
  const [matricule,setMatricule]=useState('')
  const [password,setPassword]=useState('')
  const [showPassword, setShowPassword] = useState(false)
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
          <form onSubmit={submit} style={{display:'grid',gap:8}} autoComplete="off">
            <input className="input" placeholder="Matricule" value={matricule} onChange={e=>setMatricule(e.target.value)} autoComplete="off" />
            <div style={{position:'relative'}}>
              <input
                className="input"
                placeholder="Mot de passe"
                value={password}
                onChange={e=>setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                style={{paddingRight:32}}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={()=>setShowPassword(v=>!v)}
                title={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',padding:'2px',cursor:'pointer',display:'flex',alignItems:'center',color:'#9ca3af',borderRadius:4,transition:'color 0.15s'}}
                onMouseEnter={e=>e.currentTarget.style.color='#1b4f9e'}
                onMouseLeave={e=>e.currentTarget.style.color='#9ca3af'}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
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
