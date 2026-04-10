import sys

MISSIONS = '/work/frontend/src/pages/MissionsPage.jsx'
FRAIS = '/work/frontend/src/pages/FraisPage.jsx'
BACKEND = '/work/backend/app/routers/missions_router.py'

with open(MISSIONS, 'r', encoding='utf-8') as f: missions = f.read()
with open(FRAIS, 'r', encoding='utf-8') as f: frais = f.read()
with open(BACKEND, 'r', encoding='utf-8') as f: backend = f.read()

errors = []

# ── MISSIONS: Remove canOpen gate, always clickable for validated missions ──
old_m1 = (
    "          const p = statutsPaiementFrais[item.id_operation]\n"
    "          if (!isValidated(item.statut || item.status) && !item.validation_terminee) return <span style={{ color: '#9ca3af' }}>—</span>\n"
    "          if (!p) return <span style={{ color: '#9ca3af' }}>—</span>\n"
    "          const canOpen = !!p.id_frais_operation\n"
    "          const clickProps = canOpen ? { onClick: (e) => openFraisDetail(e, item.id_operation), style: { cursor: 'pointer' } } : {}\n"
    "          if (p.frais_payes) {\n"
    "            const tooltip = p.date_paiement_frais ? `Payé le ${fmtDateTime(p.date_paiement_frais)}` : canOpen ? 'Cliquez pour voir les détails' : undefined\n"
    "            return <span {...clickProps} title={tooltip} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 999, fontSize: '0.65rem', fontWeight: 700, color: '#065f46', background: '#d1fae5', cursor: canOpen ? 'pointer' : 'default' }}><Banknote size={10}/>Payé</span>\n"
    "          }\n"
    "          if (p.frais_valides_missionnaire && !p.frais_valides_rh) {\n"
    "            return <span {...clickProps} title={canOpen ? 'Cliquez pour voir les détails' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 999, fontSize: '0.63rem', fontWeight: 700, color: '#92400e', background: '#fef3c7', cursor: canOpen ? 'pointer' : 'default' }}><Clock size={10}/>Att. conf. RH</span>\n"
    "          }\n"
    "          return <span {...clickProps} title={canOpen ? 'Cliquez pour voir les détails' : undefined} style={{ padding: '2px 6px', borderRadius: 999, fontSize: '0.65rem', fontWeight: 700, color: '#991b1b', background: '#fee2e2', cursor: canOpen ? 'pointer' : 'default' }}>Impayé</span>"
)
new_m1 = (
    "          const p = statutsPaiementFrais[item.id_operation]\n"
    "          if (!isValidated(item.statut || item.status) && !item.validation_terminee) return <span style={{ color: '#9ca3af' }}>—</span>\n"
    "          if (!p) return <span style={{ color: '#9ca3af' }}>—</span>\n"
    "          if (p.frais_payes) {\n"
    "            const tooltip = p.date_paiement_frais ? `Payé le ${fmtDateTime(p.date_paiement_frais)}` : 'Cliquez pour voir les détails'\n"
    "            return <span onClick={(e) => openFraisDetail(e, item.id_operation)} title={tooltip} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 999, fontSize: '0.65rem', fontWeight: 700, color: '#065f46', background: '#d1fae5', cursor: 'pointer' }}><Banknote size={10}/>Payé</span>\n"
    "          }\n"
    "          if (p.frais_valides_missionnaire && !p.frais_valides_rh) {\n"
    "            return <span onClick={(e) => openFraisDetail(e, item.id_operation)} title=\"Cliquez pour voir les détails\" style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 999, fontSize: '0.63rem', fontWeight: 700, color: '#92400e', background: '#fef3c7', cursor: 'pointer' }}><Clock size={10}/>Att. conf. RH</span>\n"
    "          }\n"
    "          return <span onClick={(e) => openFraisDetail(e, item.id_operation)} title=\"Cliquez pour voir les détails\" style={{ padding: '2px 6px', borderRadius: 999, fontSize: '0.65rem', fontWeight: 700, color: '#991b1b', background: '#fee2e2', cursor: 'pointer' }}>Impayé</span>"
)
if old_m1 in missions:
    missions = missions.replace(old_m1, new_m1, 1)
    print("MISSIONS 1: OK")
else:
    errors.append("MISSIONS 1: NOT FOUND")
    # Print a snippet to debug
    idx = missions.find("canOpen = !!p.id_frais_operation")
    if idx >= 0:
        print("DEBUG snippet:", repr(missions[idx-200:idx+200]))
    else:
        print("canOpen not found at all")

# ── BACKEND: Add demandeur to obtenir_detail_frais ──
old_b1 = (
    "    return {\n"
    "        'id_operation': operation.id_operation,\n"
    "        'id_frais': frais.id_frais,\n"
    "        'id_mission': frais.id_mission,\n"
    "        'statut': operation.statut,\n"
    "        'date_demande': operation.date_demande,"
)
new_b1 = (
    "    demandeur_emp = db.query(models.Employe).filter(models.Employe.matricule == operation.matricule).first()\n"
    "    return {\n"
    "        'id_operation': operation.id_operation,\n"
    "        'id_frais': frais.id_frais,\n"
    "        'id_mission': frais.id_mission,\n"
    "        'statut': operation.statut,\n"
    "        'date_demande': operation.date_demande,\n"
    "        'demandeur': {\n"
    "            'matricule': operation.matricule,\n"
    "            'nom': demandeur_emp.nom if demandeur_emp else None,\n"
    "            'prenom': demandeur_emp.prenom if demandeur_emp else None,\n"
    "            'fonction': demandeur_emp.fonction if demandeur_emp else None,\n"
    "        },"
)
if old_b1 in backend:
    backend = backend.replace(old_b1, new_b1, 1)
    print("BACKEND 1: OK")
else:
    errors.append("BACKEND 1: NOT FOUND")

# ── FRAIS modal: add demandeur + titre + preuves status (for everyone) ──
# 1) Insert demandeur + titre row just after the header banner inside the modal
old_f1 = (
    "                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: '8px 2px', borderBottom: '1px solid #f1f5f9', marginBottom: 2 }}>\n"
    "                    {renderStatusBadge(normalizeListStatus(_d.statut || 'en attente'))}\n"
    "                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Transport : <strong style={{ color: '#0f172a' }}>{_transports}</strong></span>\n"
    "                    {_m.heure_retour && <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Retour : <strong style={{ color: '#0f172a' }}>{_m.heure_retour}</strong></span>}\n"
    "                  </div>"
)
new_f1 = (
    "                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: '8px 2px', borderBottom: '1px solid #f1f5f9', marginBottom: 2 }}>\n"
    "                    {renderStatusBadge(normalizeListStatus(_d.statut || 'en attente'))}\n"
    "                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Transport : <strong style={{ color: '#0f172a' }}>{_transports}</strong></span>\n"
    "                    {_m.heure_retour && <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Retour : <strong style={{ color: '#0f172a' }}>{_m.heure_retour}</strong></span>}\n"
    "                  </div>\n"
    "                  {(_m.titre || _d.demandeur) && (\n"
    "                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', padding: '8px 4px', background: '#f8fafc', borderRadius: 6, marginBottom: 4 }}>\n"
    "                      {_d.demandeur && <div>\n"
    "                        <span style={{ fontSize: '0.63rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Demandeur</span>\n"
    "                        <p style={{ margin: '2px 0 0', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>{_d.demandeur.prenom} {_d.demandeur.nom}</p>\n"
    "                        {_d.demandeur.fonction && <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>{_d.demandeur.fonction}</p>}\n"
    "                      </div>}\n"
    "                      {_m.titre && <div>\n"
    "                        <span style={{ fontSize: '0.63rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Titre mission</span>\n"
    "                        <p style={{ margin: '2px 0 0', fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}>{_m.titre}</p>\n"
    "                      </div>}\n"
    "                    </div>\n"
    "                  )}"
)
if old_f1 in frais:
    frais = frais.replace(old_f1, new_f1, 1)
    print("FRAIS modal demandeur+titre: OK")
else:
    errors.append("FRAIS modal demandeur+titre: NOT FOUND")

# 2) Replace the preuves section to be visible to everyone (with count + status)
old_f2 = (
    "                  {(() => {\n"
    "                    const _peuVoir = estRh || ['ADMIN','PCA','AG'].includes(roleUtilisateur) || String(user?.fonction || '').toUpperCase().includes('IG')\n"
    "                    const _preuves = Array.isArray(_d.preuves_paiement) ? _d.preuves_paiement : []\n"
    "                    if (!_peuVoir || !_preuves.length) return null\n"
    "                    return (\n"
    "                      <>\n"
    "                        {_sec('Preuves de paiement')}\n"
    "                        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>\n"
    "                          {_preuves.map((p, i) => {\n"
    "                            const chemin = typeof p === 'string' ? p : (p.chemin_fichier || p.chemin || p.path || '')\n"
    "                            const typePreuve = typeof p === 'object' ? (p.type_preuve || p.type || '') : ''\n"
    "                            const fileName = chemin.split('/').pop() || chemin\n"
    "                            return (\n"
    "                              <li key={i} style={{ marginBottom: 4 }}>\n"
    "                                <a href={`/${chemin.replace(/^\\//, '')}`} target=\"_blank\" rel=\"noopener noreferrer\" style={{ color: '#2563eb', fontSize: '0.8rem', textDecoration: 'underline' }}>\n"
    "                                  {typePreuve ? `[${typePreuve}] ` : ''}{fileName}\n"
    "                                </a>\n"
    "                              </li>\n"
    "                            )\n"
    "                          })}\n"
    "                        </ul>\n"
    "                      </>\n"
    "                    )\n"
    "                  })()}"
)
new_f2 = (
    "                  {(() => {\n"
    "                    const _preuves = Array.isArray(_d.preuves_paiement) ? _d.preuves_paiement : []\n"
    "                    const _peuVoir = estRh || ['ADMIN','PCA','AG'].includes(roleUtilisateur) || String(user?.fonction || '').toUpperCase().includes('IG')\n"
    "                    return (\n"
    "                      <>\n"
    "                        {_sec('Preuves de paiement téléversées')}\n"
    "                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, background: _preuves.length > 0 ? '#f0fdf4' : '#fef9ec', border: `1px solid ${_preuves.length > 0 ? '#bbf7d0' : '#fde68a'}`, marginBottom: 6 }}>\n"
    "                          {_preuves.length > 0\n"
    "                            ? <span style={{ fontSize: '0.82rem', color: '#14532d', fontWeight: 700 }}>✓ {_preuves.length} preuve{_preuves.length > 1 ? 's' : ''} téléversée{_preuves.length > 1 ? 's' : ''}</span>\n"
    "                            : <span style={{ fontSize: '0.82rem', color: '#92400e', fontWeight: 600 }}>⚠ Aucune preuve de paiement téléversée</span>}\n"
    "                        </div>\n"
    "                        {_peuVoir && _preuves.length > 0 && (\n"
    "                          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>\n"
    "                            {_preuves.map((p, i) => {\n"
    "                              const chemin = typeof p === 'string' ? p : (p.chemin_fichier || p.chemin || p.path || '')\n"
    "                              const typePreuve = typeof p === 'object' ? (p.type_preuve || p.type || '') : ''\n"
    "                              const fileName = chemin.split('/').pop() || chemin\n"
    "                              return (\n"
    "                                <li key={i} style={{ marginBottom: 4 }}>\n"
    "                                  <a href={`/${chemin.replace(/^\\//, '')}`} target=\"_blank\" rel=\"noopener noreferrer\" style={{ color: '#2563eb', fontSize: '0.8rem', textDecoration: 'underline' }}>\n"
    "                                    {typePreuve ? `[${typePreuve}] ` : ''}{fileName}\n"
    "                                  </a>\n"
    "                                </li>\n"
    "                              )\n"
    "                            })}\n"
    "                          </ul>\n"
    "                        )}\n"
    "                      </>\n"
    "                    )\n"
    "                  })()}"
)
if old_f2 in frais:
    frais = frais.replace(old_f2, new_f2, 1)
    print("FRAIS modal preuves: OK")
else:
    errors.append("FRAIS modal preuves: NOT FOUND")

# Write files
with open(MISSIONS, 'w', encoding='utf-8') as f: f.write(missions)
print("MissionsPage.jsx written")
with open(FRAIS, 'w', encoding='utf-8') as f: f.write(frais)
print("FraisPage.jsx written")
with open(BACKEND, 'w', encoding='utf-8') as f: f.write(backend)
print("missions_router.py written")

if errors:
    print("\nERRORS:")
    for e in errors: print(" -", e)
    sys.exit(1)
else:
    print("\nAll changes applied successfully")
