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
          <form onSubmit={submit} style={{display:'grid',gap:8}}>
            <input className="input" placeholder="Matricule" value={matricule} onChange={e=>setMatricule(e.target.value)} />
            <div style={{position:'relative'}}>
              <input
                className="input"
                placeholder="Mot de passe"
                value={password}
                onChange={e=>setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                style={{paddingRight:32}}
              />
              <span
                onClick={()=>setShowPassword(v=>!v)}
                style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',cursor:'pointer',userSelect:'none',width:24,height:24,display:'flex',alignItems:'center'}}
                title={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {showPassword ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <ellipse cx="12" cy="12" rx="8" ry="5" />
                    <circle cx="12" cy="12" r="2.5" />
                  </svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <ellipse cx="12" cy="12" rx="8" ry="5" />
                    <circle cx="12" cy="12" r="2.5" />
                    <line x1="4" y1="20" x2="20" y2="4" />
                  </svg>
                )}
              </span>
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
