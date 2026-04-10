import sys

FRAIS = '/work/frontend/src/pages/FraisPage.jsx'

with open(FRAIS, 'r', encoding='utf-8') as f:
    frais = f.read()

errors = []

# ── 1: Add openFraisSimple function after openFraisDetail ──
old1 = (
    "  async function openFraisDetail(e, id) {\n"
    "    e.stopPropagation()\n"
    "    setDetailFraisData(null)\n"
    "    try {\n"
    "      const res = await api.get(`/api/missions/frais/${id}`)\n"
    "      setDetailFraisData(res.data)\n"
    "    } catch {\n"
    "      setDetailFraisData({ error: true })\n"
    "    }\n"
    "  }"
)
new1 = (
    "  async function openFraisDetail(e, id) {\n"
    "    e.stopPropagation()\n"
    "    setDetailFraisData(null)\n"
    "    try {\n"
    "      const res = await api.get(`/api/missions/frais/${id}`)\n"
    "      setDetailFraisData(res.data)\n"
    "    } catch {\n"
    "      setDetailFraisData({ error: true })\n"
    "    }\n"
    "  }\n"
    "\n"
    "  async function openFraisSimple(e, id) {\n"
    "    e.stopPropagation()\n"
    "    setDetailFraisData(null)\n"
    "    try {\n"
    "      const res = await api.get(`/api/missions/frais/${id}`)\n"
    "      setDetailFraisData({ ...res.data, _simple: true })\n"
    "    } catch {\n"
    "      setDetailFraisData({ error: true })\n"
    "    }\n"
    "  }"
)
if old1 in frais:
    frais = frais.replace(old1, new1, 1)
    print("1 openFraisSimple added: OK")
else:
    errors.append("1 openFraisSimple: NOT FOUND")

# ── 2: Change badge onClick calls from openFraisDetail to openFraisSimple ──
old2 = (
    "          if (ps.frais_payes) {\n"
    "            const tooltip = ps.date_paiement_frais ? `Payé le ${fmtDateTime(ps.date_paiement_frais)}` : 'Voir détails'\n"
    "            return <span onClick={(e) => openFraisDetail(e, item.id_operation)} title={tooltip} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color: '#065f46', background: '#d1fae5', cursor: 'pointer' }}><Banknote size={10}/>Payé</span>\n"
    "          }\n"
    "          if (ps.frais_valides_missionnaire && !ps.frais_valides_rh) {\n"
    "            return <span onClick={(e) => openFraisDetail(e, item.id_operation)} title=\"Voir détails\" style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 999, fontSize: '0.63rem', fontWeight: 700, color: '#92400e', background: '#fef3c7', cursor: 'pointer' }}><Clock size={10}/>Att. conf. RH</span>\n"
    "          }\n"
    "          return <span onClick={(e) => openFraisDetail(e, item.id_operation)} title=\"Voir détails\" style={{ padding: '2px 7px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color: '#991b1b', background: '#fee2e2', cursor: 'pointer' }}>Impayé</span>\n"
    "        })()}</td>"
)
new2 = (
    "          if (ps.frais_payes) {\n"
    "            const tooltip = ps.date_paiement_frais ? `Payé le ${fmtDateTime(ps.date_paiement_frais)}` : 'Voir détails'\n"
    "            return <span onClick={(e) => openFraisSimple(e, item.id_operation)} title={tooltip} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color: '#065f46', background: '#d1fae5', cursor: 'pointer' }}><Banknote size={10}/>Payé</span>\n"
    "          }\n"
    "          if (ps.frais_valides_missionnaire && !ps.frais_valides_rh) {\n"
    "            return <span onClick={(e) => openFraisSimple(e, item.id_operation)} title=\"Voir détails\" style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 999, fontSize: '0.63rem', fontWeight: 700, color: '#92400e', background: '#fef3c7', cursor: 'pointer' }}><Clock size={10}/>Att. conf. RH</span>\n"
    "          }\n"
    "          return <span onClick={(e) => openFraisSimple(e, item.id_operation)} title=\"Voir détails\" style={{ padding: '2px 7px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, color: '#991b1b', background: '#fee2e2', cursor: 'pointer' }}>Impayé</span>\n"
    "        })()}</td>"
)
if old2 in frais:
    frais = frais.replace(old2, new2, 1)
    print("2 badges → openFraisSimple: OK")
else:
    errors.append("2 badges: NOT FOUND")

# ── 3: Hide demandeur+titre block when _simple ──
old3 = (
    "                  {(_m.titre || _d.demandeur) && (\n"
    "                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', padding: '8px 4px', background: '#f8fafc', borderRadius: 6, marginBottom: 4 }}>"
)
new3 = (
    "                  {!_d._simple && (_m.titre || _d.demandeur) && (\n"
    "                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', padding: '8px 4px', background: '#f8fafc', borderRadius: 6, marginBottom: 4 }}>"
)
if old3 in frais:
    frais = frais.replace(old3, new3, 1)
    print("3 hide demandeur+titre in simple: OK")
else:
    errors.append("3 demandeur+titre: NOT FOUND")

# ── 4: Hide preuves section when _simple ──
old4 = (
    "                  {(() => {\n"
    "                    const _preuves = Array.isArray(_d.preuves_paiement) ? _d.preuves_paiement : []\n"
    "                    const _peuVoir = estRh || ['ADMIN','PCA','AG'].includes(roleUtilisateur) || String(user?.fonction || '').toUpperCase().includes('IG')"
)
new4 = (
    "                  {!_d._simple && (() => {\n"
    "                    const _preuves = Array.isArray(_d.preuves_paiement) ? _d.preuves_paiement : []\n"
    "                    const _peuVoir = estRh || ['ADMIN','PCA','AG'].includes(roleUtilisateur) || String(user?.fonction || '').toUpperCase().includes('IG')"
)
if old4 in frais:
    frais = frais.replace(old4, new4, 1)
    print("4 hide preuves in simple: OK")
else:
    errors.append("4 preuves: NOT FOUND")

with open(FRAIS, 'w', encoding='utf-8') as f:
    f.write(frais)
print("FraisPage.jsx written")

if errors:
    print("\nERRORS:")
    for e in errors: print(" -", e)
    sys.exit(1)
else:
    print("\nAll changes applied successfully")
