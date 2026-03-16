import React, {createContext, useContext, useEffect, useState} from 'react'
import api from '../services/api'
import jwt_decode from 'jwt-decode'
import {useNavigate} from 'react-router-dom'

const AuthContext = createContext()

export function AuthProvider({children}){
  const [user,setUser] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const navigate = useNavigate()

  useEffect(()=>{
    const token = localStorage.getItem('ec_token') || localStorage.getItem('access_token')
    if(token){
      try{const data = jwt_decode(token); setUser(data)}catch(e){localStorage.removeItem('ec_token'); localStorage.removeItem('access_token')}
    }
  },[])

  async function login({matricule,password,mfaCode}){
    // FastAPI expects form data with proper Content-Type header
    const formData = new FormData()
    formData.append('matricule', matricule)
    formData.append('password', password)
    if(mfaCode) formData.append('mfaCode', mfaCode)
    const res = await api.post('/auth/login', formData, {
      headers: {'Content-Type': 'application/x-www-form-urlencoded'}
    }).catch(e=>{throw e})
    const {access_token}=res.data
    localStorage.setItem('ec_token',access_token)
    localStorage.setItem('access_token',access_token)
    const data = jwt_decode(access_token)
    setUser(data)

    // Record session login
    try {
      const sessionRes = await api.post('/employees/sessions/login', { matricule: parseInt(matricule) })
      const { id_session } = sessionRes.data
      setSessionId(id_session)
      localStorage.setItem('session_id', id_session)
    } catch (err) {
      console.error('Erreur enregistrement session:', err)
    }

    return data
  }

  async function loginWithToken(token){
    // token reçu via lien email
    localStorage.setItem('ec_token',token)
    localStorage.setItem('access_token',token)
    const data = jwt_decode(token)
    setUser(data)

    // Record session login
    try {
      const sessionRes = await api.post('/employees/sessions/login', { matricule: parseInt(data.matricule) })
      const { id_session } = sessionRes.data
      setSessionId(id_session)
      localStorage.setItem('session_id', id_session)
    } catch (err) {
      console.error('Erreur enregistrement session:', err)
    }

    return data
  }

  async function logout(){
    // Record session logout
    const id_session = sessionId || localStorage.getItem('session_id')
    if (id_session) {
      try {
        await api.put(`/employees/sessions/${id_session}/logout`)
      } catch (err) {
        console.error('Erreur enregistrement déconnexion:', err)
      }
    }

    localStorage.removeItem('ec_token')
    localStorage.removeItem('access_token')
    localStorage.removeItem('session_id')
    setUser(null)
    setSessionId(null)
    navigate('/login')
  }

  return (
    <AuthContext.Provider value={{user,login,loginWithToken,logout,sessionId}}>{children}</AuthContext.Provider>
  )
}

export function useAuth(){return useContext(AuthContext)}
