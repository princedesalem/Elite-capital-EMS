"""Test pour le champ 'commentaire' sur Remplacant_propose."""
from app import models


def test_patch_commentaire_remplacant(db_session, seed_reference_data, client, auth_headers):
    op = seed_reference_data['operation']
    target = seed_reference_data['responsable']
    prop = models.RemplacantPropose(
        id_operation=op.id_operation,
        matricule_remplacant=target.matricule,
        ordre_proposition=1,
        est_accepte=False,
        demande_envoyee=False,
    )
    db_session.add(prop)
    db_session.commit()
    db_session.refresh(prop)

    rh = seed_reference_data['rh']
    headers = auth_headers(rh.matricule, 'RH')

    res = client.patch(
        f'/api/remplacants/propositions/{prop.id_remplacant_propose}/commentaire',
        json={'commentaire': 'Contact préalable effectué'},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()['commentaire'] == 'Contact préalable effectué'

    # Clearing with empty string
    res2 = client.patch(
        f'/api/remplacants/propositions/{prop.id_remplacant_propose}/commentaire',
        json={'commentaire': ''},
        headers=headers,
    )
    assert res2.status_code == 200
    assert res2.json()['commentaire'] == ''

    # listing inclut la clé
    emp = seed_reference_data['employe']
    listing = client.get(f'/api/remplacants/propositions/{op.id_operation}', headers=headers)
    assert listing.status_code == 200
    body = listing.json()
    assert body and 'commentaire' in body[0]
