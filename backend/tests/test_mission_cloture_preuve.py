"""Phase F — B2 : clôture mission bloquée si preuve de frais manquante."""
import pytest
from app import models
from app.utils.activation_cloture import verifier_preuves_frais


def test_cloture_ok_sans_frais(db_session):
    op = models.Operation(matricule='TST001', type_demande='Mission',
                          titre='Mission', statut='en attente', duree_jours=1)
    db_session.add(op); db_session.commit(); db_session.refresh(op)
    ok, msg = verifier_preuves_frais(op.id_operation, db_session)
    assert ok is True
    assert msg == ''


def test_cloture_bloquee_si_frais_sans_justificatif(db_session):
    op = models.Operation(matricule='TST001', type_demande='Mission',
                          titre='Mission', statut='en attente', duree_jours=1)
    db_session.add(op); db_session.commit(); db_session.refresh(op)
    f = models.Frais(id_operation=op.id_operation, frais_hotel=10000, justificatif_de_frais=None)
    db_session.add(f); db_session.commit()
    ok, msg = verifier_preuves_frais(op.id_operation, db_session)
    assert ok is False
    assert 'preuve' in msg.lower()


def test_cloture_ok_si_justificatif_present(db_session):
    op = models.Operation(matricule='TST001', type_demande='Mission',
                          titre='Mission', statut='en attente', duree_jours=1)
    db_session.add(op); db_session.commit(); db_session.refresh(op)
    f = models.Frais(id_operation=op.id_operation, frais_hotel=10000,
                     justificatif_de_frais='/uploads/recu.pdf')
    db_session.add(f); db_session.commit()
    ok, msg = verifier_preuves_frais(op.id_operation, db_session)
    assert ok is True


def test_cloture_bloquee_si_justificatif_vide(db_session):
    op = models.Operation(matricule='TST001', type_demande='Mission',
                          titre='Mission', statut='en attente', duree_jours=1)
    db_session.add(op); db_session.commit(); db_session.refresh(op)
    f = models.Frais(id_operation=op.id_operation, frais_hotel=10000,
                     justificatif_de_frais='   ')
    db_session.add(f); db_session.commit()
    ok, msg = verifier_preuves_frais(op.id_operation, db_session)
    assert ok is False
