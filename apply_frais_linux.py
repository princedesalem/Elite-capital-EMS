import sys

FRAIS = '/work/frontend/src/pages/FraisPage.jsx'
MISSIONS = '/work/frontend/src/pages/MissionsPage.jsx'

with open(FRAIS, 'r', encoding='utf-8') as f:
    frais = f.read()
with open(MISSIONS, 'r', encoding='utf-8') as f:
    missions_txt = f.read()

errors = []

# ── FRAIS 2: make badges clickable + add Preuves <td> ──
old2 = (
    "          if (ps.frais_payes) {\n"
    "            const tooltip = ps.date_paiement_frais ? `Payé le ${fmtDateTime(ps.date_paiement_frais)}` : undefined\n"
    "            return <span title={tooltip} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color: '#065f46', background: '#d1fae5', cursor: tooltip ? 'help' : 'default' }}><Banknote size={10}/>Payé</span>\n"
    "          }\n"
    "          if (ps.frais_valides_missionnaire && !ps.frais_valides_rh) {\n"
    "            return <span style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 999, fontSize: '0.63rem', fontWeight: 700, color: '#92400e', background: '#fef3c7' }}><Clock size={10}/>Att. conf. RH</span>\n"
    "          }\n"
    "          return <span style={{ padding: '2px 7px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color: '#991b1b', background: '#fee2e2' }}>Impayé</span>\n"
    "        })()}</td>\n"
    "        <td style={td}>{renderActionButtons(item, isRecu)}</td>"
)
new2 = (
    "          if (ps.frais_payes) {\n"
    "            const tooltip = ps.date_paiement_frais ? `Payé le ${fmtDateTime(ps.date_paiement_frais)}` : 'Voir détails'\n"
    "            return <span onClick={(e) => openFraisDetail(e, item.id_operation)} title={tooltip} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color: '#065f46', background: '#d1fae5', cursor: 'pointer' }}><Banknote size={10}/>Payé</span>\n"
    "          }\n"
    "          if (ps.frais_valides_missionnaire && !ps.frais_valides_rh) {\n"
    "            return <span onClick={(e) => openFraisDetail(e, item.id_operation)} title=\"Voir détails\" style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 999, fontSize: '0.63rem', fontWeight: 700, color: '#92400e', background: '#fef3c7', cursor: 'pointer' }}><Clock size={10}/>Att. conf. RH</span>\n"
    "          }\n"
    "          return <span onClick={(e) => openFraisDetail(e, item.id_operation)} title=\"Voir détails\" style={{ padding: '2px 7px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color: '#991b1b', background: '#fee2e2', cursor: 'pointer' }}>Impayé</span>\n"
    "        })()}</td>\n"
    "        <td style={{ ...td, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>{(() => {\n"
    "          const ps = fraisPaymentStatuts[item.id_operation]\n"
    "          if (!ps) return <span style={{ color: '#9ca3af' }}>—</span>\n"
    "          const count = (ps.preuves_paiement || []).length\n"
    "          if (count === 0) return <span style={{ color: '#cbd5e1', fontSize: '0.7rem' }}>0</span>\n"
    "          return <span onClick={(e) => openFraisDetail(e, item.id_operation)} title=\"Voir les preuves\" style={{ padding: '1px 7px', borderRadius: 999, fontSize: '0.65rem', fontWeight: 700, color: '#2563eb', background: '#dbeafe', cursor: 'pointer' }}>{count}</span>\n"
    "        })()}</td>\n"
    "        <td style={td}>{renderActionButtons(item, isRecu)}</td>"
)
if old2 in frais:
    frais = frais.replace(old2, new2, 1)
    print("FRAIS 2: OK")
else:
    errors.append("FRAIS 2: NOT FOUND")

# ── FRAIS 4: add Preuves column header ──
old4 = (
    "              <th style={{ ...th, width: '5%' }}>Duree</th>\n"
    "              <th style={{ ...th, width: '7%' }}>Paiement</th>\n"
    "              <th style={{ ...th, width: '16%' }}>Actions</th>"
)
new4 = (
    "              <th style={{ ...th, width: '5%' }}>Durée</th>\n"
    "              <th style={{ ...th, width: '7%' }}>Paiement</th>\n"
    "              <th style={{ ...th, width: '5%', textAlign: 'center' }}>Preuves</th>\n"
    "              <th style={{ ...th, width: '14%' }}>Actions</th>"
)
if old4 in frais:
    frais = frais.replace(old4, new4, 1)
    print("FRAIS 4: OK")
else:
    errors.append("FRAIS 4: NOT FOUND")

# ── FRAIS 5: replace ID Frais input with dropdown ──
old5 = (
    "            <div className=\"form-group\"><label>ID Frais</label>"
    "<input value={preuveUpload.id_frais} onChange={(e) => setPreuveUpload({ ...preuveUpload, id_frais: e.target.value })} "
    "required placeholder=\"Entrez l'ID de la demande de frais\" /></div>"
)
new5 = (
    "            <div className=\"form-group\">\n"
    "              <label>Demande de frais</label>\n"
    "              <select value={preuveUpload.id_frais} onChange={(e) => setPreuveUpload({ ...preuveUpload, id_frais: e.target.value })} required>\n"
    "                <option value=\"\">— Sélectionner une demande de frais —</option>\n"
    "                {workflowEnvoye.map(f => {\n"
    "                  const ps = fraisPaymentStatuts[f.id_operation]\n"
    "                  const mission = ps ? missions.find(m => m.id_operation === ps.id_mission) : null\n"
    "                  const label = mission\n"
    "                    ? `#${f.id_operation} — ${mission.pays || '?'}${mission.ville ? ', ' + mission.ville : ''}`\n"
    "                    : `#${f.id_operation} — ${f.motif || missionLabel(f)}`\n"
    "                  return <option key={f.id_operation} value={f.id_operation}>{label}</option>\n"
    "                })}\n"
    "              </select>\n"
    "              {workflowEnvoye.length === 0 && <p style={{ fontSize: '0.82rem', color: '#92400e', marginTop: 6 }}>Aucune demande de frais trouvée. Soumettez d'abord une demande de frais.</p>}\n"
    "            </div>"
)
if old5 in frais:
    frais = frais.replace(old5, new5, 1)
    print("FRAIS 5: OK")
else:
    errors.append("FRAIS 5: NOT FOUND")

# ── MISSIONS 1: robust openFraisDetail ──
old6 = (
    "  async function openFraisDetail(e, idMission) {\n"
    "    e.stopPropagation()\n"
    "    setDetailFraisData(null)\n"
    "    try {\n"
    "      const ps = statutsPaiementFrais[idMission]\n"
    "      const idFrais = ps?.id_frais_operation\n"
    "      if (!idFrais) { setDetailFraisData({ error: true }); return }\n"
    "      const res = await api.get(`/api/missions/frais/${idFrais}`)\n"
    "      setDetailFraisData(res.data)\n"
    "    } catch {\n"
    "      setDetailFraisData({ error: true })\n"
    "    }\n"
    "  }"
)
new6 = (
    "  async function openFraisDetail(e, idMission) {\n"
    "    e.stopPropagation()\n"
    "    setDetailFraisData(null)\n"
    "    try {\n"
    "      let idFrais = statutsPaiementFrais[idMission]?.id_frais_operation\n"
    "      if (!idFrais) {\n"
    "        const psRes = await api.get(`/api/missions/${idMission}/statut-paiement-frais`)\n"
    "        idFrais = psRes.data?.id_frais_operation\n"
    "        if (psRes.data) setStatutsPaiementFrais(prev => ({ ...prev, [idMission]: psRes.data }))\n"
    "      }\n"
    "      if (!idFrais) { setDetailFraisData({ error: true }); return }\n"
    "      const res = await api.get(`/api/missions/frais/${idFrais}`)\n"
    "      setDetailFraisData(res.data)\n"
    "    } catch {\n"
    "      setDetailFraisData({ error: true })\n"
    "    }\n"
    "  }"
)
if old6 in missions_txt:
    missions_txt = missions_txt.replace(old6, new6, 1)
    print("MISSIONS 1: OK")
else:
    errors.append("MISSIONS 1: NOT FOUND")

# Write files
with open(FRAIS, 'w', encoding='utf-8') as f:
    f.write(frais)
print("FraisPage.jsx written")

with open(MISSIONS, 'w', encoding='utf-8') as f:
    f.write(missions_txt)
print("MissionsPage.jsx written")

if errors:
    print("\nERRORS:")
    for e in errors:
        print(" -", e)
    sys.exit(1)
else:
    print("\nAll changes applied successfully")
