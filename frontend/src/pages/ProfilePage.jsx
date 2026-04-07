import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'

export default function ProfilePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    if (!user?.matricule) return
    api.get(`/employees/${user.matricule}`)
      .then(r => setProfile(r.data))
      .catch(() => setErr('Impossible de charger le profil'))
      .finally(() => setLoading(false))
  }, [user?.matricule])

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setErr('Veuillez sélectionner une image (JPG, PNG, WebP)'); return }
    if (file.size > 5 * 1024 * 1024) { setErr('Image trop volumineuse (max 5 Mo)'); return }
    setUploading(true)
    setErr(null)
    setSuccess(null)
    try {
      const form = new FormData()
      form.append('photo', file)
      const res = await api.post(`/employees/${user.matricule}/photo`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setProfile(prev => ({ ...prev, photo_url: res.data.photo_url }))
      setSuccess('Photo mise à jour avec succès')
    } catch {
      setErr("Erreur lors de l'upload de la photo")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleDeletePhoto() {
    if (!window.confirm('Supprimer la photo de profil ?')) return
    setUploading(true)
    setErr(null)
    setSuccess(null)
    try {
      await api.delete(`/employees/${user.matricule}/photo`)
      setProfile(prev => ({ ...prev, photo_url: null }))
      setSuccess('Photo supprimée')
    } catch {
      setErr('Erreur lors de la suppression')
    } finally {
      setUploading(false)
    }
  }

  const initials = profile
    ? `${(profile.prenom || '?')[0]}${(profile.nom || '?')[0]}`.toUpperCase()
    : (user?.matricule || '?')[0]

  if (loading) return <div className="container"><p style={{ color: '#64748b' }}>Chargement...</p></div>

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 620 }}>
        <button
          onClick={() => navigate('/rh')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '0.9rem', marginBottom: 16, padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          &#8592; Retour à l’accueil
        </button>
        <h2 style={{ marginBottom: 24 }}>Mon profil</h2>

        {/* Avatar section */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            {profile?.photo_url ? (
              <img
                src={profile.photo_url}
                alt="Photo de profil"
                style={{ width: 128, height: 128, borderRadius: '50%', objectFit: 'cover', border: '3px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
              />
            ) : (
              <div style={{
                width: 128, height: 128, borderRadius: '50%',
                background: 'linear-gradient(135deg, rgb(2,22,46), rgb(208,32,43))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '2.2rem', fontWeight: 700, color: '#fff',
                border: '3px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
              }}>
                {initials}
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{
                position: 'absolute', bottom: 2, right: 2,
                width: 30, height: 30, borderRadius: '50%',
                background: 'rgb(2,22,46)', border: '2px solid #fff',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.85rem', color: '#fff'
              }}
              title="Changer la photo"
            >✎</button>
          </div>

          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />

          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button
              className="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{ padding: '5px 14px', fontSize: '0.8rem' }}
            >
              {uploading ? 'Envoi...' : profile?.photo_url ? 'Changer la photo' : 'Ajouter une photo'}
            </button>
            {profile?.photo_url && (
              <button
                className="button"
                onClick={handleDeletePhoto}
                disabled={uploading}
                style={{ padding: '5px 14px', fontSize: '0.8rem', background: 'rgb(208,32,43)' }}
              >
                Supprimer
              </button>
            )}
          </div>

          {err && <p style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: 8 }}>{err}</p>}
          {success && <p style={{ color: '#16a34a', fontSize: '0.82rem', marginTop: 8 }}>{success}</p>}
        </div>

        {/* Info section */}
        {profile && (
          <div style={{ display: 'grid', gap: 12 }}>
            <InfoRow label="Matricule" value={profile.matricule} />
            <InfoRow label="Nom complet" value={`${profile.prenom || ''} ${profile.nom || ''}`.trim()} />
            <InfoRow label="Email" value={profile.email} />
            <InfoRow label="Téléphone" value={profile.telephone} />
            <InfoRow label="Rôle" value={profile.role || user?.role} />
            <InfoRow label="Fonction" value={profile.fonction} />
            <InfoRow label="Entité" value={profile.entite} />
            <InfoRow label="Direction" value={profile.direction} />
            <InfoRow label="Département" value={profile.departement} />
            <InfoRow label="Date d'embauche" value={profile.date_embauche} />
            <InfoRow label="Statut" value={profile.statut_employe || 'ACTIF'} />
          </div>
        )}

        {/* Quick actions */}
        <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #e5e7eb', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/rh/password" className="button" style={{ padding: '7px 16px', fontSize: '0.82rem', textDecoration: 'none', display: 'inline-block' }}>
            Changer le mot de passe
          </Link>
          <Link to="/rh/mfa" className="button" style={{ padding: '7px 16px', fontSize: '0.82rem', textDecoration: 'none', display: 'inline-block', background: 'rgb(2,22,46)' }}>
            Configurer MFA
          </Link>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
      <span style={{ color: '#64748b', fontSize: '0.82rem', minWidth: 140, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: 500 }}>{value}</span>
    </div>
  )
}
