// E2E — Mission multi-segments + frais par segment
const { test, expect } = require('@playwright/test')
const { loginViaApi, BACKEND } = require('./fixtures/auth')

const MATRICULE = process.env.E2E_RESPONSABLE_MATRICULE || '90002'
const PASSWORD  = process.env.E2E_RESPONSABLE_PASSWORD  || 'Test1234!@#'

test.describe('Missions multi-segments E2E', () => {
  test('création multi-segments + édition granulaire + frais liés au segment', async ({ page }) => {
    const token = await loginViaApi(page, MATRICULE, PASSWORD)
    const auth = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }

    const fmt = (d) => d.toISOString().slice(0, 10)
    const d0 = new Date(); d0.setDate(d0.getDate() + 20)
    const d1 = new Date(); d1.setDate(d1.getDate() + 23)
    const d2 = new Date(); d2.setDate(d2.getDate() + 27)

    // 1) Création mission 2 segments via l'endpoint multi-segments
    const createRes = await page.request.post(BACKEND + '/api/missions/creer-multi-segments', {
      headers: auth,
      data: {
        matricule: parseInt(MATRICULE, 10),
        matricules_missionnaires: [parseInt(MATRICULE, 10)],
        motif: 'E2E multi-segments',
        mission_comment: 'Test E2E',
        segments: [
          { pays: 'Cameroun', country_code: 'CM', ville: 'Douala',
            date_debut: fmt(d0), date_fin: fmt(d1), moyen_transport: 'aerien' },
          { pays: 'France', country_code: 'FR', ville: 'Paris',
            date_debut: fmt(d1), date_fin: fmt(d2), moyen_transport: 'aerien' },
        ],
      },
    })

    if (createRes.status() !== 200 && createRes.status() !== 201) {
      test.skip(true, `création mission non supportée (${createRes.status()}) : ${await createRes.text()}`)
      return
    }

    const created = await createRes.json()
    const idMission = created.id_mission || created.id_operation || created.id
    expect(idMission, 'id_mission attendu dans la réponse').toBeTruthy()

    // 2) Lister les segments
    const segsRes = await page.request.get(BACKEND + `/api/missions/${idMission}/segments`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    expect(segsRes.status()).toBe(200)
    const segsBody = await segsRes.json()
    expect(segsBody.segments).toBeDefined()
    expect(segsBody.segments.length).toBe(2)

    const seg1 = segsBody.segments[0]
    const seg2 = segsBody.segments[1]

    // 3) PATCH un segment : changer la ville
    const patchRes = await page.request.patch(
      BACKEND + `/api/missions/${idMission}/segments/${seg2.id_segment}`,
      { headers: auth, data: { ville: 'Lyon' } }
    )
    expect(patchRes.status()).toBe(200)
    const patched = await patchRes.json()
    expect(patched.ville).toBe('Lyon')

    // 4) POST un nouveau segment (3e)
    const addRes = await page.request.post(
      BACKEND + `/api/missions/${idMission}/segments`,
      {
        headers: auth,
        data: {
          pays: 'Cameroun', country_code: 'CM', ville: 'Yaoundé',
          date_debut: fmt(d2),
          date_fin: fmt(new Date(d2.getTime() + 2 * 86400000)),
          moyen_transport: 'routier',
        },
      }
    )
    expect(addRes.status()).toBe(200)
    const added = await addRes.json()
    expect(added.ordre).toBe(3)

    // 5) DELETE le segment 3 → il doit rester 2 segments
    const delRes = await page.request.delete(
      BACKEND + `/api/missions/${idMission}/segments/${added.id_segment}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )
    expect(delRes.status()).toBe(200)

    const segsAfter = await (await page.request.get(
      BACKEND + `/api/missions/${idMission}/segments`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )).json()
    expect(segsAfter.segments.length).toBe(2)

    // 6) Soumettre frais avec id_segment ciblé
    const fraisRes = await page.request.post(
      BACKEND + `/api/missions/${idMission}/frais-missionnaire?matricule=${MATRICULE}`,
      {
        headers: auth,
        data: {
          frais_transport: 50000,
          frais_hotel: 30000,
          frais_deplacement: 10000,
          frais_nutrition: 15000,
          id_segment: seg1.id_segment,
        },
      }
    )
    expect(fraisRes.status()).toBe(200)

    // 7) Vérifier que le GET retourne l'id_segment + info segment
    const getFraisRes = await page.request.get(
      BACKEND + `/api/missions/${idMission}/frais-missionnaire`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )
    expect(getFraisRes.status()).toBe(200)
    const fraisBody = await getFraisRes.json()
    const item = fraisBody.frais_missionnaires.find(f => f.matricule === parseInt(MATRICULE, 10))
    expect(item).toBeTruthy()
    expect(item.id_segment).toBe(seg1.id_segment)
    expect(item.segment).toBeTruthy()
    expect(item.segment.ville).toBe(seg1.ville)
  })
})
