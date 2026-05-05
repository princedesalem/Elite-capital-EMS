"""
E2E test: upload signature → validate operation → generate PDF with signature table.

Flow:
  1. Upload a signature for a validator via the API endpoint
  2. Run the workflow validation (valider_operation)
  3. Confirm the Validation row snapshots the signature_url
  4. Generate the operation PDF and assert it:
     - returns HTTP 200
     - starts with %PDF-
     - renders an "Historique de validation" table with a Signature column
"""
from datetime import date


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# 1×1 px white PNG (base64-encoded)
_TINY_PNG_B64 = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8"
    "/x8AAusB9Y9gNQ8AAAAASUVORK5CYII="
)


# ---------------------------------------------------------------------------
# Test
# ---------------------------------------------------------------------------


def test_full_signature_flow_conge(client, db_session, seed_reference_data, monkeypatch):
    """Upload signature → valider opération CONGE → PDF contient la section Signatures."""
    from app import models
    from app.utils import workflow as wf_utils
    from app.routers import pdf_router

    employe = seed_reference_data["employe"]
    responsable = seed_reference_data["responsable"]

    # ------------------------------------------------------------------
    # 1. Upload de la signature du validateur via l'API
    # ------------------------------------------------------------------
    r = client.post(
        f"/employees/{responsable.matricule}/signature",
        json={"signature_url": _TINY_PNG_B64},
    )
    assert r.status_code == 200, r.text
    sig_url = r.json().get("signature_url", "")
    assert sig_url.startswith("/uploads/signatures/"), f"Unexpected URL: {sig_url}"

    # Recharge l'entité pour confirmer la persistance
    db_session.expire(responsable)
    db_session.refresh(responsable)
    assert responsable.signature_url == sig_url

    # ------------------------------------------------------------------
    # 2. Créer une opération CONGE pour l'employé
    # ------------------------------------------------------------------
    op = models.Operation(
        matricule=employe.matricule,
        cree_par=employe.matricule,
        type_demande="Congé",
        titre="Congé annuel E2E",
        statut="en attente",
        date_debut=date(2026, 6, 1),
        date_fin=date(2026, 6, 5),
        duree_jours=5,
        motif="Test E2E signature",
    )
    db_session.add(op)
    db_session.commit()
    db_session.refresh(op)

    # ------------------------------------------------------------------
    # 3. Identifier le prochain validateur et valider l'opération
    # ------------------------------------------------------------------
    prochain_role, prochain_matricule = wf_utils.obtenir_prochain_validateur(
        op.id_operation, db_session
    )
    assert prochain_matricule is not None, "Aucun validateur trouvé pour l'opération"

    ok, message = wf_utils.valider_operation(
        op.id_operation,
        str(prochain_matricule),
        "validé",
        "Validation E2E",
        db_session,
    )
    assert ok, f"valider_operation a échoué: {message}"

    # ------------------------------------------------------------------
    # 4. Vérifier le snapshot signature dans la table Validation
    # ------------------------------------------------------------------
    val = (
        db_session.query(models.Validation)
        .filter(
            models.Validation.id_operation == op.id_operation,
            models.Validation.matricule_validateur == str(prochain_matricule),
        )
        .first()
    )
    assert val is not None, "Aucune ligne Validation créée"
    # Si le prochain validateur est le responsable qui a sa signature uploadée,
    # le snapshot doit correspondre
    if str(prochain_matricule) == str(responsable.matricule):
        assert val.signature_url == sig_url, (
            f"Snapshot incorrect: {val.signature_url!r} != {sig_url!r}"
        )

    # ------------------------------------------------------------------
    # 5. Générer le PDF et vérifier la structure
    # ------------------------------------------------------------------
    history_table_calls = []
    original_history_table = pdf_router.PDFReport.history_table

    def _spy(self, history):
        history_table_calls.append(history)
        return original_history_table(self, history)

    monkeypatch.setattr(pdf_router.PDFReport, "history_table", _spy)

    r_pdf = client.get(f"/api/pdf/conges/{op.id_operation}")
    assert r_pdf.status_code == 200, r_pdf.text
    assert r_pdf.content[:5] == b"%PDF-", "La réponse n'est pas un PDF valide"

    # history_table doit avoir été appelée avec au moins une entrée de validation
    assert len(history_table_calls) == 1, "history_table n'a pas été appelée"
    called_history = history_table_calls[0]
    assert len(called_history) >= 1, "L'historique passé à history_table est vide"

    # Chaque entrée doit avoir les clés attendues
    for entry in called_history:
        assert 'role' in entry
        assert 'nom' in entry
        assert 'statut' in entry
        assert 'date' in entry
        assert 'signature_path' in entry
        assert 'commentaire' in entry
