import React from 'react'
import {Link, NavLink} from 'react-router-dom'
import {useAuth} from '../contexts/AuthContext'

const topNavLinkStyle = ({isActive}) => ({
  display:'inline-flex',
  alignItems:'center',
  height:'30px',
  padding:'0 12px',
  fontSize:'0.84rem',
  fontWeight: isActive ? 700 : 500,
  color: isActive ? '#fff' : 'rgba(255,255,255,0.7)',
  borderBottom: isActive ? '2px solid #fff' : '2px solid transparent',
  textDecoration:'none',
})

export default function Navbar(){
  const {user,logout} = useAuth()
  return (
    <div className="nav">
      <div style={{display:'flex',alignItems:'center',gap:16}}>
        <div style={{fontSize:'1rem',fontWeight:'800',letterSpacing:'0.02em'}}>ELITE CAPITAL EMS</div>
        {user && (
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <NavLink to="/rh/home" style={topNavLinkStyle}>Accueil</NavLink>
            <NavLink to="/rh/dashboard" style={topNavLinkStyle}>Dashboard</NavLink>
            <NavLink to="/rh/organisation" style={topNavLinkStyle}>Organisation</NavLink>
          </div>
        )}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        {user ? (
          <>
            <span style={{color:'rgba(255,255,255,0.75)',fontSize:'0.8rem'}}>
              {user.matricule} · <span style={{opacity:0.8}}>{user.role || 'Utilisateur'}</span>
            </span>
            <button className="button" onClick={logout} style={{padding:'5px 12px',fontSize:'0.78rem'}}>Déconnexion</button>
          </>
        ) : (
          <Link to="/login" style={{color:'rgba(255,255,255,0.9)',textDecoration:'none',fontSize:'0.82rem'}}>Se connecter</Link>
        )}
      </div>
    </div>
  )
}
