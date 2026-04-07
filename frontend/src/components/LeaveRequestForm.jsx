import React, {useEffect, useState} from 'react'
import api from '../services/api'

export default function LeaveRequestForm({
  initialMatricule = '',
  onSuccess,
  onCancel,
  submitLabel = 'Envoyer',
  compact = false,
}) {
  const [form, setForm] = useState({
    matricule: initialMatricule ? String(initialMatricule) : '',
    date_debut: '',
    date_fin: '',
    type: 'conge',
    preuve: null,
    justification: '',
  })
  const [err, setErr] = useState(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (initialMatricule) {
      setForm((s) => ({...s, matricule: String(initialMatricule)}))
    }
  }, [initialMatricule])

  function setField(k, v) {
    setForm((s) => ({...s, [k]: v}))
  }

  async function submit(e) {
    e.preventDefault()
    setErr(null)
    setSending(true)
    try {
      const payload = new FormData()
      Object.keys(form).forEach((k) => {
        if (form[k] !== null && form[k] !== '') payload.append(k, form[k])
      })
      await api.post('/leaves', payload, {headers: {'Content-Type': 'multipart/form-data'}})
      if (onSuccess) onSuccess()
    } catch (e2) {
      setErr(e2?.response?.data?.detail || 'Erreur envoi')
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={submit} style={{display: 'grid', gap: 8}}>
      <input
        className="input"
        placeholder="Matricule"
        value={form.matricule}
        onChange={(e) => setField('matricule', e.target.value)}
        required
      />
      <div className="form-row">
        <input
          className="input"
          type="date"
          value={form.date_debut}
          onChange={(e) => setField('date_debut', e.target.value)}
          required
        />
        <input
          className="input"
          type="date"
          value={form.date_fin}
          onChange={(e) => setField('date_fin', e.target.value)}
          required
        />
      </div>
      <select className="input" value={form.type} onChange={(e) => setField('type', e.target.value)}>
        <option value="conge">Conge</option>
        <option value="maternite">Maternite</option>
        <option value="paternite">Paternite</option>
        <option value="maladie">Maladie</option>
        <option value="permission_formelle">Permission formelle</option>
        <option value="permission_informelle">Permission informelle</option>
      </select>
      <input className="input" type="file" onChange={(e) => setField('preuve', e.target.files?.[0] || null)} />
      <textarea
        className="input"
        placeholder="Justification"
        value={form.justification}
        onChange={(e) => setField('justification', e.target.value)}
        rows={compact ? 3 : 5}
      />
      {err && <div style={{color: 'crimson', fontSize: '0.88rem'}}>{err}</div>}
      <div style={{display: 'flex', justifyContent: onCancel ? 'space-between' : 'flex-end', gap: 12}}>
        {onCancel && (
          <button className="button" type="button" style={{background: '#e5e7eb', color: '#1f2937'}} onClick={onCancel}>
            Annuler
          </button>
        )}
        <button className="button" type="submit" disabled={sending}>
          {sending ? 'Envoi...' : submitLabel}
        </button>
      </div>
    </form>
  )
}
