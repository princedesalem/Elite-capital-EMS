import React from 'react'
import {Navigate} from 'react-router-dom'
import {useAuth} from '../contexts/AuthContext'

export default function ProtectedRoute({children,allowedRoles}){
  const {user} = useAuth()
  if(!user) return <Navigate to="/login" replace />
  if(allowedRoles && allowedRoles.length>0 && !allowedRoles.includes(user.role)) return <div style={{padding:24}}>Accès refusé</div>
  return children
}
