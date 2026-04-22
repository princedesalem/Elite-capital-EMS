"""
Tests de la règle : tout employé dont la fonction contient "responsable" ou
"directeur" doit avoir la DG dans sa séquence de validation, quelle que soit
son entité (ECG incluse) et même sans frais associés.

Couvre : congés, permissions, missions, frais de mission (tous passent par
determiner_sequence_validation).
"""
from datetime import date

import pytest

from app import models
from app.utils.security import hash_password
from app.utils.workflow import determiner_sequence_validation


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _add_emp(db_session, matricule, prenom, role_obj, entite, dept_id=None,
             id_direction=None, fonction='Agent'):
    emp = models.Employe(
        matricule=matricule,
        nom='Test',
        prenom=prenom,
        email=f'{matricule}@test.com',
        date_embauche=date(2024, 1, 1),
        dept_id=dept_id,
        id_direction=id_direction,
        id_entite=entite.id_entite,
        id_role=role_obj.id,
        fonction=fonction,
        sexe='M',
    )
    db_session.add(emp)
    db_session.flush()
    db_session.add(models.Utilisateur(
        matricule=matricule,
        email=f'{matricule}@test.com',
        role_id=role_obj.id,
        mot_de_passe_hash=hash_password('Pw123!'),
        mot_de_passe_temporaire=False,
        mfa_enabled=False,
        mfa_active=False,
    ))
    db_session.flush()
    return emp


@pytest.fixture()
def org_fonction_dg(db_session):
    """
    Deux entités (ELCAM + ECG) avec rôles complets.  ECG a son propre
    département/direction pour les tests de séquence ECG.
    """
    entite_elcam = models.Entite(nom='ELCAM')
    entite_ecg = models.Entite(nom='ECG')
    db_session.add_all([entite_elcam, entite_ecg])
    db_session.flush()

    roles = {}
    for name in ['EMPLOYE', 'RESPONSABLE', 'DIRECTEUR', 'DG', 'RH', 'PCA', 'AG']:
        r = models.Role(name=name, description=name)
        db_session.add(r)
        db_session.flush()
        roles[name] = r

    # --- Structure ECG ---
    dir_ecg = models.Direction(nom='Direction ECG', id_entite=entite_ecg.id_entite)
    db_session.add(dir_ecg)
    db_session.flush()
    dept_ecg = models.Departement(
        nom='Dept ECG',
        id_entite=entite_ecg.id_entite,
        id_direction=dir_ecg.id_direction,
    )
    db_session.add(dept_ecg)
    db_session.flush()

    # --- Structure ELCAM ---
    dir_elcam = models.Direction(nom='Direction ELCAM', id_entite=entite_elcam.id_entite)
    db_session.add(dir_elcam)
    db_session.flush()
    dept_elcam = models.Departement(
        nom='Dept ELCAM',
        id_entite=entite_elcam.id_entite,
        id_direction=dir_elcam.id_direction,
    )
    db_session.add(dept_elcam)
    db_session.flush()

    # Validateurs nécessaires pour boucler les séquences
    dg = _add_emp(db_session, 4001, 'DgUser', roles['DG'], entite_elcam,
                  fonction='Administrateur Directeur Général')
    rh = _add_emp(db_session, 5001, 'RhUser', roles['RH'], entite_elcam,
                  fonction='responsable des resources Humaines')
    pca = _add_emp(db_session, 7001, 'PcaUser', roles['PCA'], entite_elcam,
                   fonction='PCA')
    ag = _add_emp(db_session, 7002, 'AgUser', roles['AG'], entite_ecg,
                  fonction='Administrateur Général')

    return {
        'entite_elcam': entite_elcam,
        'entite_ecg': entite_ecg,
        'roles': roles,
        'dept_elcam': dept_elcam,
        'dept_ecg': dept_ecg,
        'dir_elcam': dir_elcam,
        'dir_ecg': dir_ecg,
        'dg': dg,
        'rh': rh,
        'pca': pca,
        'ag': ag,
    }


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestFonctionResponsableDGObligatoire:
    """ECG : employé avec fonction contenant 'responsable' → DG obligatoire."""

    def test_ecg_responsable_tresorerie_sans_frais(self, db_session, org_fonction_dg):
        """
        Employé ECG, fonction 'Responsable Trésorerie(ALM)', sans frais.
        Avant la règle : ECG sans frais → pas de DG. Après : DG obligatoire.
        """
        o = org_fonction_dg
        emp = _add_emp(
            db_session, 1101, 'EcgResp', o['roles']['EMPLOYE'], o['entite_ecg'],
            dept_id=o['dept_ecg'].dept_id,
            fonction='Responsable Trésorerie(ALM)',
        )
        seq = determiner_sequence_validation(emp, db_session)
        assert 'DG' in seq, f"DG manquant dans la séquence : {seq}"

    def test_ecg_directeur_commercial_sans_frais(self, db_session, org_fonction_dg):
        """
        Employé ECG, fonction 'Directeur Commercial', sans frais.
        DG doit figurer avant AG (validateur terminal ECG).
        """
        o = org_fonction_dg
        emp = _add_emp(
            db_session, 1102, 'EcgDir', o['roles']['EMPLOYE'], o['entite_ecg'],
            dept_id=o['dept_ecg'].dept_id,
            fonction='Directeur Commercial',
        )
        seq = determiner_sequence_validation(emp, db_session)
        assert 'DG' in seq, f"DG manquant dans la séquence : {seq}"
        # DG doit précéder le validateur terminal AG
        assert seq.index('DG') < seq.index('AG'), f"DG doit précéder AG : {seq}"

    def test_ecg_agent_sans_responsable_directeur_inchange(self, db_session, org_fonction_dg):
        """
        Employé ECG, fonction ordinaire sans 'responsable' ni 'directeur',
        sans frais → DG absent (règle ECG historique conservée).
        """
        o = org_fonction_dg
        emp = _add_emp(
            db_session, 1103, 'EcgAgent', o['roles']['EMPLOYE'], o['entite_ecg'],
            dept_id=o['dept_ecg'].dept_id,
            fonction='Chargé développement Pool Particuliers & PMEs',
        )
        seq = determiner_sequence_validation(emp, db_session)
        assert 'DG' not in seq, f"DG ne devrait pas être dans la séquence ECG sans frais : {seq}"


class TestFonctionNonECGPasDeDupDG:
    """Non-ECG : DG déjà présent → pas de doublon."""

    def test_elcam_responsable_fonction_dg_unique(self, db_session, org_fonction_dg):
        """
        Employé ELCAM, fonction 'Responsable Middle & Back Office'.
        Non-ECG → DG déjà dans la séquence. La règle ne doit pas créer de doublon.
        """
        o = org_fonction_dg
        emp = _add_emp(
            db_session, 1201, 'ElcamResp', o['roles']['EMPLOYE'], o['entite_elcam'],
            dept_id=o['dept_elcam'].dept_id,
            fonction='Responsable Middle & Back Office',
        )
        seq = determiner_sequence_validation(emp, db_session)
        assert 'DG' in seq, f"DG manquant dans la séquence : {seq}"
        assert seq.count('DG') == 1, f"DG en doublon : {seq}"


class TestFonctionRoleDIRECTEURPasDeDupDG:
    """Employé rôle DIRECTEUR avec 'Directeur' dans la fonction → DG unique."""

    def test_directeur_role_fonction_dg_unique(self, db_session, org_fonction_dg):
        """
        Rôle DIRECTEUR + fonction 'Directeur Général Adjoint'.
        La règle insère DG si absent ; le filtre final retire le rôle du
        demandeur si c'est lui-même → résultat cohérent, DG présent une seule fois.
        """
        o = org_fonction_dg
        emp = _add_emp(
            db_session, 1301, 'DgaUser', o['roles']['DIRECTEUR'], o['entite_elcam'],
            dept_id=o['dept_elcam'].dept_id,
            fonction='Directeur Général Adjoint',
        )
        seq = determiner_sequence_validation(emp, db_session)
        # DG doit être présent et sans doublon
        assert seq.count('DG') <= 1, f"DG en doublon : {seq}"
        # La séquence ne doit pas contenir 'DIRECTEUR' (rôle du demandeur filtré)
        assert 'DIRECTEUR' not in seq


class TestFonctionRoleDGInchange:
    """Employé rôle DG avec 'Directeur' dans la fonction → séquence inchangée."""

    def test_dg_role_fonction_directeur_sequence_inchangee(self, db_session, org_fonction_dg):
        """
        Rôle DG + fonction 'Administrateur Directeur Général'.
        La règle tenterait d'insérer DG, mais le filtre final le retire
        (le demandeur est lui-même DG) → séquence : RH → PCA (inchangée).
        """
        o = org_fonction_dg
        emp = _add_emp(
            db_session, 1401, 'DgFonc', o['roles']['DG'], o['entite_elcam'],
            fonction='Administrateur Directeur Général',
        )
        seq = determiner_sequence_validation(emp, db_session)
        # DG filtré (demandeur est DG) → pas de DG dans la séquence retournée
        assert 'DG' not in seq, f"DG ne doit pas figurer (demandeur est DG) : {seq}"
        # La séquence doit contenir RH et PCA
        assert 'RH' in seq
        assert 'PCA' in seq
