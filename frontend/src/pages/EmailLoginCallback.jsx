import React, {useEffect, useState} from 'react'
import {useSearchParams, useNavigate} from 'react-router-dom'
import {useAuth} from '../contexts/AuthContext'
import api from '../services/api'

export default function EmailLoginCallback(){
  const [params] = useSearchParams()
  const [err,setErr]=useState(null)
  const nav = useNavigate()
  const {loginWithToken} = useAuth()

  useEffect(()=>{
    const token = params.get('token')
    if(!token){setErr('Token manquant');return}
    api.get('/auth/login/email/validate', {params:{token}})
      .then(res => {
        loginWithToken(res.data.access_token)
        nav('/home')
      })
      .catch(e=>setErr(e.response?.data?.detail || 'Erreur validation'))
  },[])

  return (
    <div className="container">
      <div className="card" style={{maxWidth:480,margin:'0 auto'}}>
        <h2>Connexion par email</h2>
        {err ? <div className="error">{err}</div> : <div>Connexion en cours...</div>}
      </div>
    </div>
  )
}
