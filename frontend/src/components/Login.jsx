import React, {useState, useEffect} from 'react'
import {useAuth} from '../contexts/AuthContext'
import {useNavigate} from 'react-router-dom'
import api from '../services/api'
import {validatePasswordPolicy} from '../utils/passwordPolicy'

const CG = "'Century Gothic', 'Avant Garde', Avantgarde, AppleGothic, 'URW Gothic L', sans-serif"
const NAVY = '#02162e'
const RED  = '#d0202b'

export default function Login(){
  const [matricule,setMatricule]=useState('')
  const [password,setPassword]=useState('')
  const [showPassword,setShowPassword]=useState(false)
  const [mfa,setMfa]=useState('')
  const [err,setErr]=useState(null)
  const [email,setEmail]=useState('')
  const [emailMsg,setEmailMsg]=useState(null)
  const [showEmail,setShowEmail]=useState(false)
  const [loading,setLoading]=useState(false)
  const [emailLoading,setEmailLoading]=useState(false)
  const {login,silentLogout}=useAuth()
  const nav=useNavigate()

  useEffect(()=>{
    silentLogout()
    const prev=document.body.style.paddingTop
    const prevBg=document.body.style.background
    document.body.style.paddingTop='0'
    document.body.style.background='#dde8f4'
    return ()=>{
      document.body.style.paddingTop=prev
      document.body.style.background=prevBg
    }
  },[])

  async function submit(e){
    e.preventDefault(); setErr(null)
    const pwOk=validatePasswordPolicy(password)
    if(!pwOk.ok){setErr(pwOk.message);return}
    setLoading(true)
    try{
      await login({matricule,password,mfaCode:mfa})
      nav('/home')
    }catch(ex){
      let errMsg='Erreur connexion'
      if(ex.response?.data?.detail){
        const d=ex.response.data.detail
        errMsg=typeof d==='string'?d:JSON.stringify(d)
      }
      setErr(errMsg)
    }finally{
      setLoading(false)
    }
  }

  async function submitEmail(e){
    e.preventDefault(); setEmailMsg(null)
    if(!email||email.trim()===''){setEmailMsg('Veuillez entrer votre adresse email');return}
    setEmailLoading(true)
    try{
      await api.post('/auth/login/email',new URLSearchParams({email}))
      setEmailMsg('Lien envoy\u00e9 ! V\u00e9rifiez votre bo\u00eete mail.')
    }catch(ex){setEmailMsg(ex.response?.data?.detail||'Erreur envoi email')}
    finally{setEmailLoading(false)}
  }

  const LoadingDots = ({color='#ffffff'}) => (
    <span data-testid="login-loading-dots" aria-label="Chargement en cours" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:6,height:15}}>
      <span style={{width:8,height:8,borderRadius:'50%',background:color,display:'inline-block',animation:'emsLoginDot 1.2s infinite ease-in-out',animationDelay:'0s'}}/>
      <span style={{width:8,height:8,borderRadius:'50%',background:color,display:'inline-block',animation:'emsLoginDot 1.2s infinite ease-in-out',animationDelay:'0.2s'}}/>
      <span style={{width:8,height:8,borderRadius:'50%',background:color,display:'inline-block',animation:'emsLoginDot 1.2s infinite ease-in-out',animationDelay:'0.4s'}}/>
    </span>
  )

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  useEffect(()=>{
    if(typeof document==='undefined') return
    if(document.getElementById('ems-login-dots-style')) return
    const s=document.createElement('style')
    s.id='ems-login-dots-style'
    s.textContent='@keyframes emsLoginDot{0%,80%,100%{opacity:0.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-4px)}}'
    document.head.appendChild(s)
  },[])

  return (
    <div data-testid="login-page" style={{
      fontFamily: CG,
      position: 'fixed', inset: 0,
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      background: isMobile
        ? '#02162e'
        : 'linear-gradient(90deg, #02162e 0%, #02162e 45%, #d0daea 75%, #ffffff 100%)',
      overflow: isMobile ? 'auto' : 'hidden',
    }}>

      {/* ==== MOITIE GAUCHE (desktop) / HEADER (mobile) ==== */}
      <div style={{
        flex: isMobile ? '0 0 auto' : '0 0 54%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: isMobile ? 'flex-start' : 'space-between',
        padding: isMobile ? '32px 24px 20px' : '48px 56px 44px 52px',
      }}>

        {/* Logo ECG SA — blend multiply pour faire disparaître le fond blanc du PNG sur le dégradé */}
        <div>
          <img
            src="/logo-ecg.png"
            alt="ELITE CAPITAL Group S.A"
            width={560}
            height={163}
            decoding="async"
            style={{ height: 'clamp(96px, 7vw, 160px)', width: 'auto', maxWidth: '32vw', objectFit: 'contain', mixBlendMode: 'screen', filter: 'brightness(1.1) contrast(1.05)' }}
          />
        </div>

        {/* Bloc titre */}
        <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',paddingRight:20,paddingTop:16}}>
          <h1
            data-testid="login-title"
            style={{
              margin: '0 0 0',
              fontSize: isMobile ? 28 : 'clamp(36px, 3.8vw, 72px)',
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: 1.12,
              letterSpacing: -0.5,
              fontFamily: CG,
            }}
          >
            <em style={{color:'#a8b8cc'}}>Bienvenue sur</em>
            <span style={{display:'block',height: isMobile ? 10 : 28}}></span>
            {isMobile ? 'ELITE CAPITAL EMS' : <>ELITE CAPITAL ENTERPRISE<br/>MANAGEMENT<br/>SYSTEM&nbsp;<span style={{color: RED}}>(EMS)</span></>}
          </h1>
          {!isMobile && <p style={{
            margin: '44px 0 0',
            fontSize: 'clamp(16px, 1.3vw, 26px)',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.80)',
            letterSpacing: 0.4,
            fontFamily: CG,
          }}>
            Votre ERP de gestion
          </p>}
        </div>

        {/* Slogan — grand, blanc, italique, sans boîte, remonté */}
        <div
          data-testid="login-slogan"
          style={{
            margin: '10px 0 0',
            padding: 0,
          }}
        >
          <span style={{
            fontSize: isMobile ? 15 : 'clamp(22px, 2.2vw, 44px)',
            fontWeight: 400,
            color: isMobile ? 'rgba(255,255,255,0.65)' : '#ffffff',
            fontStyle: 'italic',
            letterSpacing: 0.3,
            lineHeight: 1.3,
            fontFamily: CG,
            textShadow: '0 2px 14px rgba(0,0,0,0.45)',
          }}>
            {'« Le marché des capitaux, plus proche de vous ! »'}
          </span>
        </div>
      </div>

      {/* ==== MOITIE DROITE : formulaire ==== */}
      <div style={{
        flex:1,
        display:'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent:'center',
        padding: isMobile ? '24px 16px 40px' : '40px 48px 40px 16px',
        background: isMobile ? '#ffffff' : 'transparent',
        borderRadius: isMobile ? '20px 20px 0 0' : 0,
      }}>
        <div style={{
          width:'100%', maxWidth: isMobile ? '100%' : 420,
          background:'#ffffff',
          borderRadius: isMobile ? 16 : 24,
          padding: isMobile ? '32px 24px' : '48px 44px',
          boxShadow: isMobile ? 'none' : '0 20px 70px rgba(2,22,46,0.14),0 4px 20px rgba(2,22,46,0.08)',
        }}>
          {!showEmail?(
            <>
              <h2 style={{margin:'0 0 6px',fontSize:24,fontWeight:800,color:NAVY,fontFamily:CG}}>
                Connexion
              </h2>
              <p style={{margin:'0 0 28px',fontSize:13,color:'#7a8fa6',fontFamily:CG}}>
                Entrez vos identifiants pour accéder à EMS
              </p>
              <form onSubmit={submit} style={{display:'grid',gap:14}}>
                <input className="input" placeholder="Matricule" value={matricule}
                  onChange={e=>setMatricule(e.target.value)} style={{fontFamily:CG}}/>
                <div style={{position:'relative'}}>
                  <input className="input" placeholder="Mot de passe" value={password}
                    onChange={e=>setPassword(e.target.value)}
                    type={showPassword?'text':'password'}
                    style={{paddingRight:40,fontFamily:CG}}/>
                  <button type="button" onClick={()=>setShowPassword(v=>!v)}
                    style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',padding:2,cursor:'pointer',display:'flex',alignItems:'center',color:'#9ca3af'}}
                    onMouseEnter={e=>e.currentTarget.style.color=NAVY}
                    onMouseLeave={e=>e.currentTarget.style.color='#9ca3af'}>
                    {showPassword?(
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ):(
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
                <input className="input" placeholder="Code MFA (si requis)" value={mfa}
                  onChange={e=>setMfa(e.target.value)} style={{fontFamily:CG}}/>
                {err&&<div className="error" style={{fontFamily:CG}}>{err}</div>}
                <button type="submit" disabled={loading}
                  style={{marginTop:6,background:'linear-gradient(90deg,'+NAVY+' 0%,#1a4e8a 100%)',color:'#fff',border:'none',borderRadius:10,padding:'14px 0',fontWeight:800,fontSize:15,cursor:loading?'wait':'pointer',letterSpacing:0.5,fontFamily:CG,boxShadow:'0 4px 20px rgba(2,22,46,0.28)',transition:'filter 0.15s',opacity:loading?0.85:1,display:'flex',alignItems:'center',justifyContent:'center',minHeight:47}}
                  onMouseEnter={e=>{if(!loading)e.currentTarget.style.filter='brightness(1.18)'}}
                  onMouseLeave={e=>e.currentTarget.style.filter='none'}>
                  {loading ? <LoadingDots/> : 'Se connecter'}
                </button>
              </form>
              <div style={{marginTop:20,textAlign:'center'}}>
                <button style={{background:'none',border:'none',color:'#1a5fa8',cursor:'pointer',fontSize:13,fontFamily:CG}}
                  onClick={()=>setShowEmail(true)}>
                  {'Mot de passe oublié ?'}
                </button>
              </div>
            </>
          ):(
            <>
              <h2 style={{margin:'0 0 6px',fontSize:24,fontWeight:800,color:NAVY,fontFamily:CG}}>
                {'Mot de passe oublié'}
              </h2>
              <p style={{margin:'0 0 28px',fontSize:13,color:'#7a8fa6',fontFamily:CG}}>
                {'Recevez un lien de réinitialisation par email'}
              </p>
              <form onSubmit={submitEmail} style={{display:'grid',gap:14}}>
                <input className="input" placeholder="Email" value={email}
                  onChange={e=>setEmail(e.target.value)} type="email" style={{fontFamily:CG}}/>
                <button type="submit" disabled={emailLoading}
                  style={{background:'linear-gradient(90deg,'+NAVY+' 0%,#1a4e8a 100%)',color:'#fff',border:'none',borderRadius:10,padding:'14px 0',fontWeight:800,fontSize:15,cursor:emailLoading?'wait':'pointer',fontFamily:CG,boxShadow:'0 4px 20px rgba(2,22,46,0.28)',opacity:emailLoading?0.85:1,display:'flex',alignItems:'center',justifyContent:'center',minHeight:47}}>
                  {emailLoading ? <LoadingDots/> : 'Recevoir le lien'}
                </button>
              </form>
              {emailMsg&&<div className="small" style={{marginTop:12,fontFamily:CG}}>{emailMsg}</div>}
              <div style={{marginTop:20,textAlign:'center'}}>
                <button style={{background:'none',border:'none',color:'#1a5fa8',cursor:'pointer',fontSize:13,fontFamily:CG}}
                  onClick={()=>setShowEmail(false)}>
                  Retour à la connexion
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}