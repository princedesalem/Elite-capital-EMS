import React, {useEffect, useState, useRef} from 'react'
import api from '../services/api'
import {useNavigate, useParams} from 'react-router-dom'
import AutocompleteInput from '../components/AutocompleteInput'

/* -- Country dial codes with flag emojis -- */
const COUNTRY_CODES = [
  {code:'+93',country:'Afghanistan',iso:'AF'},{code:'+355',country:'Albanie',iso:'AL'},
  {code:'+213',country:'Algérie',iso:'DZ'},{code:'+376',country:'Andorre',iso:'AD'},
  {code:'+244',country:'Angola',iso:'AO'},{code:'+54',country:'Argentine',iso:'AR'},
  {code:'+374',country:'Arménie',iso:'AM'},{code:'+61',country:'Australie',iso:'AU'},
  {code:'+43',country:'Autriche',iso:'AT'},{code:'+994',country:'Azerbaïdjan',iso:'AZ'},
  {code:'+1-242',country:'Bahamas',iso:'BS'},{code:'+973',country:'Bahreïn',iso:'BH'},
  {code:'+880',country:'Bangladesh',iso:'BD'},{code:'+32',country:'Belgique',iso:'BE'},
  {code:'+229',country:'Bénin',iso:'BJ'},{code:'+975',country:'Bhoutan',iso:'BT'},
  {code:'+591',country:'Bolivie',iso:'BO'},{code:'+387',country:'Bosnie',iso:'BA'},
  {code:'+267',country:'Botswana',iso:'BW'},{code:'+55',country:'Brésil',iso:'BR'},
  {code:'+226',country:'Burkina Faso',iso:'BF'},{code:'+257',country:'Burundi',iso:'BI'},
  {code:'+855',country:'Cambodge',iso:'KH'},{code:'+237',country:'Cameroun',iso:'CM'},
  {code:'+1',country:'Canada / USA',iso:'CA'},{code:'+238',country:'Cap-Vert',iso:'CV'},
  {code:'+236',country:'Centrafrique',iso:'CF'},{code:'+235',country:'Tchad',iso:'TD'},
  {code:'+56',country:'Chili',iso:'CL'},{code:'+86',country:'Chine',iso:'CN'},
  {code:'+57',country:'Colombie',iso:'CO'},{code:'+269',country:'Comores',iso:'KM'},
  {code:'+242',country:'Congo (Brazzaville)',iso:'CG'},{code:'+243',country:'Congo (RDC)',iso:'CD'},
  {code:'+506',country:'Costa Rica',iso:'CR'},{code:'+225',country:"Côte d'lvoire",flag:'????'},
  {code:'+385',country:'Croatie',iso:'HR'},{code:'+53',country:'Cuba',iso:'CU'},
  {code:'+45',country:'Danemark',iso:'DK'},{code:'+253',country:'Djibouti',iso:'DJ'},
  {code:'+20',country:'Égypte',iso:'EG'},{code:'+503',country:'El Salvador',iso:'SV'},
  {code:'+971',country:'Émirats',iso:'AE'},{code:'+593',country:'Équateur',iso:'EC'},
  {code:'+291',country:'Érythrée',iso:'ER'},{code:'+34',country:'Espagne',iso:'ES'},
  {code:'+372',country:'Estonie',iso:'EE'},{code:'+251',country:'Éthiopie',iso:'ET'},
  {code:'+679',country:'Fidji',iso:'FJ'},{code:'+358',country:'Finlande',iso:'FI'},
  {code:'+33',country:'France',iso:'FR'},{code:'+241',country:'Gabon',iso:'GA'},
  {code:'+220',country:'Gambie',iso:'GM'},{code:'+995',country:'Géorgie',iso:'GE'},
  {code:'+233',country:'Ghana',iso:'GH'},{code:'+30',country:'Grèce',iso:'GR'},
  {code:'+502',country:'Guatemala',iso:'GT'},{code:'+224',country:'Guinée',iso:'GN'},
  {code:'+245',country:'Guinée-Bissau',iso:'GW'},{code:'+240',country:'Guinée Équatoriale',iso:'GQ'},
  {code:'+509',country:'Haïti',iso:'HT'},{code:'+504',country:'Honduras',iso:'HN'},
  {code:'+36',country:'Hongrie',iso:'HU'},{code:'+91',country:'Inde',iso:'IN'},
  {code:'+62',country:'Indonésie',iso:'ID'},{code:'+98',country:'Iran',iso:'IR'},
  {code:'+964',country:'Irak',iso:'IQ'},{code:'+353',country:'Irlande',iso:'IE'},
  {code:'+972',country:'Israël',iso:'IL'},{code:'+39',country:'Italie',iso:'IT'},
  {code:'+1-876',country:'Jamaïque',iso:'JM'},{code:'+81',country:'Japon',iso:'JP'},
  {code:'+962',country:'Jordanie',iso:'JO'},{code:'+7',country:'Kazakhstan',iso:'KZ'},
  {code:'+254',country:'Kenya',iso:'KE'},{code:'+965',country:'Koweït',iso:'KW'},
  {code:'+996',country:'Kirghizstan',iso:'KG'},{code:'+856',country:'Laos',iso:'LA'},
  {code:'+371',country:'Lettonie',iso:'LV'},{code:'+961',country:'Liban',iso:'LB'},
  {code:'+266',country:'Lesotho',iso:'LS'},{code:'+231',country:'Libéria',iso:'LR'},
  {code:'+218',country:'Libye',iso:'LY'},{code:'+370',country:'Lituanie',iso:'LT'},
  {code:'+352',country:'Luxembourg',iso:'LU'},{code:'+261',country:'Madagascar',iso:'MG'},
  {code:'+265',country:'Malawi',iso:'MW'},{code:'+60',country:'Malaisie',iso:'MY'},
  {code:'+960',country:'Maldives',iso:'MV'},{code:'+223',country:'Mali',iso:'ML'},
  {code:'+356',country:'Malte',iso:'MT'},{code:'+222',country:'Mauritanie',iso:'MR'},
  {code:'+230',country:'Maurice',iso:'MU'},{code:'+52',country:'Mexique',iso:'MX'},
  {code:'+373',country:'Moldavie',iso:'MD'},{code:'+212',country:'Maroc',iso:'MA'},
  {code:'+258',country:'Mozambique',iso:'MZ'},{code:'+264',country:'Namibie',iso:'NA'},
  {code:'+977',country:'Népal',iso:'NP'},{code:'+31',country:'Pays-Bas',iso:'NL'},
  {code:'+64',country:'Nouvelle-Zélande',iso:'NZ'},{code:'+505',country:'Nicaragua',iso:'NI'},
  {code:'+227',country:'Niger',iso:'NE'},{code:'+234',country:'Nigéria',iso:'NG'},
  {code:'+47',country:'Norvège',iso:'NO'},{code:'+968',country:'Oman',iso:'OM'},
  {code:'+92',country:'Pakistan',iso:'PK'},{code:'+507',country:'Panama',iso:'PA'},
  {code:'+595',country:'Paraguay',iso:'PY'},{code:'+51',country:'Pérou',iso:'PE'},
  {code:'+63',country:'Philippines',iso:'PH'},{code:'+48',country:'Pologne',iso:'PL'},
  {code:'+351',country:'Portugal',iso:'PT'},{code:'+974',country:'Qatar',iso:'QA'},
  {code:'+40',country:'Roumanie',iso:'RO'},{code:'+7',country:'Russie',iso:'RU'},
  {code:'+250',country:'Rwanda',iso:'RW'},{code:'+966',country:'Arabie Saoudite',iso:'SA'},
  {code:'+221',country:'Sénégal',iso:'SN'},{code:'+381',country:'Serbie',iso:'RS'},
  {code:'+232',country:'Sierra Leone',iso:'SL'},{code:'+65',country:'Singapour',iso:'SG'},
  {code:'+421',country:'Slovaquie',iso:'SK'},{code:'+386',country:'Slovénie',iso:'SI'},
  {code:'+252',country:'Somalie',iso:'SO'},{code:'+27',country:'Afrique du Sud',iso:'ZA'},
  {code:'+211',country:'Soudan du Sud',iso:'SS'},{code:'+34',country:'Espagne',iso:'ES'},
  {code:'+94',country:'Sri Lanka',iso:'LK'},{code:'+249',country:'Soudan',iso:'SD'},
  {code:'+46',country:'Suède',iso:'SE'},{code:'+41',country:'Suisse',iso:'CH'},
  {code:'+963',country:'Syrie',iso:'SY'},{code:'+886',country:'Taïwan',iso:'TW'},
  {code:'+255',country:'Tanzanie',iso:'TZ'},{code:'+228',country:'Togo',iso:'TG'},
  {code:'+216',country:'Tunisie',iso:'TN'},{code:'+90',country:'Turquie',iso:'TR'},
  {code:'+256',country:'Ouganda',iso:'UG'},{code:'+380',country:'Ukraine',iso:'UA'},
  {code:'+44',country:'Royaume-Uni',iso:'GB'},{code:'+598',country:'Uruguay',iso:'UY'},
  {code:'+998',country:'Ouzbékistan',iso:'UZ'},{code:'+58',country:'Venezuela',iso:'VE'},
  {code:'+84',country:'Viêt Nam',iso:'VN'},{code:'+967',country:'Yémen',iso:'YE'},
  {code:'+260',country:'Zambie',iso:'ZM'},{code:'+263',country:'Zimbabwe',iso:'ZW'},
]

/* -- Parse existing telephone value into code + number -- */
function parseTelephone(val) {
  if (!val) return { dialCode: '+237', localNumber: '' }
  const ordered = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length)
  const match = ordered.find(c => val.startsWith(c.code))
  if (match) return { dialCode: match.code, localNumber: val.slice(match.code.length).trimStart() }
  return { dialCode: '+237', localNumber: val }
}

function getCountryIsoFromFlag(flag) {
  const chars = Array.from(String(flag || ''))
  const letters = chars
    .map(char => char.codePointAt(0))
    .filter(code => code >= 127462 && code <= 127487)
    .map(code => String.fromCharCode(code - 127397))
  return letters.join('') || 'XX'
}

/* -- PhoneInput component -- */
function PhoneInput({ value, onChange, placeholder = 'Numéro de téléphone' }) {
  const parsed = parseTelephone(value)
  const [dialCode, setDialCode] = useState(parsed.dialCode)
  const [localNumber, setLocalNumber] = useState(parsed.localNumber)
  const [open, setOpen] = useState(false)
  const dropRef = useRef(null)
  const optionRefs = useRef([])

  useEffect(() => {
    const p = parseTelephone(value)
    setDialCode(p.dialCode)
    setLocalNumber(p.localNumber)
  }, [value])

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleDialCode(code) {
    setDialCode(code)
    setOpen(false)
    onChange(localNumber ? code + ' ' + localNumber : code)
  }

  function handleNumber(e) {
    const n = e.target.value.replace(/[^\d\s\-().]/g, '')
    setLocalNumber(n)
    onChange(n ? dialCode + ' ' + n : dialCode)
  }

  function jumpToCountryByLetter(letter) {
    const normalized = String(letter || '').toLowerCase()
    if (!normalized) return
    const idx = COUNTRY_CODES.findIndex(c => String(c.country || '').toLowerCase().startsWith(normalized))
    if (idx < 0) return
    const target = optionRefs.current[idx]
    if (target) {
      target.focus()
      if (typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'nearest' })
    }
  }

  function handleDropdownKeyDown(e) {
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (e.key && e.key.length === 1 && /[a-z]/i.test(e.key)) {
      e.preventDefault()
      jumpToCountryByLetter(e.key)
    }
  }

  function handleToggleButtonKeyDown(e) {
    if (!open) return
    handleDropdownKeyDown(e)
  }

  const selected = COUNTRY_CODES.find(c => c.code === dialCode) || COUNTRY_CODES[0]
  const selectedLabel = `${selected.iso || getCountryIsoFromFlag(selected.flag)} (${selected.code})`

  return (
    <div className="input" style={{ padding: 0, display: 'flex', alignItems: 'stretch', overflow: 'visible', width: '100%' }}>
      <div ref={dropRef} style={{ position: 'relative', width: 124, minWidth: 124, maxWidth: 124, flex: '0 0 124px' }}>
        <button
          type="button"
          aria-label="Choisir le code pays"
          title="Choisir le code pays"
          onClick={() => setOpen(prev => !prev)}
          onKeyDown={handleToggleButtonKeyDown}
          style={{ width: '100%', height: '100%', minHeight: 35, padding: '0 8px', background: 'var(--bg)', border: 'none', borderRight: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '0.82rem', outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedLabel}</span>
          <span style={{ display: 'inline-block', width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '4px solid currentColor', opacity: 0.7, flexShrink: 0 }} />
        </button>
        {open && (
          <div
            onKeyDown={handleDropdownKeyDown}
            style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 1000, width: 240, maxHeight: 240, overflowY: 'auto', background: 'var(--card)', border: '1px solid #d1d5db', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
          >
            {COUNTRY_CODES.map((c, i) => (
              <button
                key={`${c.code}-${c.country}-${i}`}
                type="button"
                ref={el => {
                  optionRefs.current[i] = el
                }}
                onClick={() => handleDialCode(c.code)}
                style={{ width: '100%', border: 'none', background: c.code === dialCode ? '#eef2ff' : '#fff', padding: '8px 10px', textAlign: 'left', cursor: 'pointer', fontSize: '0.82rem', borderBottom: i === COUNTRY_CODES.length - 1 ? 'none' : '1px solid #f1f5f9' }}
              >
                {c.flag} {c.country} ({c.code})
              </button>
            ))}
          </div>
        )}
      </div>
      <input
        type="tel"
        placeholder={placeholder}
        value={localNumber}
        onChange={handleNumber}
        style={{ border: 'none', outline: 'none', flex: '1 1 auto', width: 0, minWidth: 140, padding: '0 10px', fontSize: '0.9rem', background: 'transparent' }}
      />
    </div>
  )
}

/* -- Valid DB enum categories -- */
const CATEGORIES_DB = [
  {value:'Cadre supérieur',label:'Cadre supérieur'},
  {value:'Cadre moyen',label:'Cadre moyen'},
  {value:'Agent de maîtrise',label:'Agent de maîtrise'},
  {value:'Agent qualifié',label:'Agent qualifié'},
  {value:'Agent non qualifié',label:'Agent non qualifié'},
  {value:'Apprenti',label:'Apprenti'},
  {value:'Stagiaire',label:'Stagiaire'},
]

const SEX_OPTIONS = [
  { value: 'M', label: 'Masculin' },
  { value: 'F', label: 'Féminin' },
]

function normalizeSexValue(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (['m', 'masculin', 'homme'].includes(raw)) return 'M'
  if (['f', 'féminin', 'feminin', 'femme'].includes(raw)) return 'F'
  return ''
}

const FUNCTION_SUGGESTIONS = [
  'Administrateur Général','PCA','Directeur Audit Interne et Inspection Générale',
  'Inspecteur Générale(IG)','Auditeur',
  "Représentants Résidents et responsables de la création et relation d'affaires",
  'Directeur financier et Comptable(DFC)','comptable et responsable contrôle et consolidation',
  'responsable Trésorerie et financement','contrôleur de gestion','comptable',
  'responsable des ressources Humaines','chargé des ressources humaines',
  'responsable communication et relation publiques',
  'chargé community management accueil et courrier','infographiste et déploiement',
  'Responsable affaires juridiques & fiscalité','chargé de la fiscalité',
  'Directeur des Organisations et projets',"Responsable des systèmes d'information",
  'chargé des organisations et projets','chargé marketing digital opérationnel',
  'chargé des moyens généraux','Administrateur Directeur Général','Directeur Général Adjoint',
  'Responsable conformité et contrôle interne','Directeur Développement et investissement',
  'Responsable développement Pool Grande Entreprise & Fortunes',
  'Chargé développement Pool Grande Entreprise & Fortunes',
  'Responsable développement Pool Particuliers & PME','Chargé développement Pool Particuliers & PMEs',
  'Responsable Middle & Back Office','Responsable Trésorerie(ALM)','Chargé de négociation',
  'Directeur Conseil et Financement structurés','Responsable Financement et structuration',
  'Analyste Financement et structuration','Responsable du Développement',
  'Chargé du développement portefeuille Grandes entreprise et Fortune',
  'Chargé du développement portefeuille particulier et PME',
  'Directeur Conformité et Contrôle interne','Directeur Distribution',
  'Responsable Distribution Grandes Entreprises Institutions et Fortunes',
  'Responsable Distribution Particuliers et PME',
  'Responsable Gestion et Analyste de portefeuille','chargé de Gestions de portefeuille',
  'chargé Analyste de portefeuille','Responsable Middle & Back office','chargé Back Office & operations',
  'Stagiaire professionnel','Stagiaire académique'
]

export default function EmployeeForm(){
  const {id} = useParams()
  const nav = useNavigate()
  const [form,setForm]=useState({
    matricule:'',nom:'',prenom:'',date_naissance:'',sexe:'',telephone:'+237',email:'',
    departement:'',fonction:'',ville:'',id_localisation:'',contact_urgence:'+237',diplome:'',solde_conges:0,
    date_embauche:'',entite:'',role:'',direction:'',categorie:'',n1_fonction:'',
    annee_experience:0,statut_employe:'ACTIF',statut_matrimonial:'',nombre_enfants:'',
    salaire_brut:'',salaire_devise:'XAF',
    salaire_brut:'',salaire_devise:'XAF'
  })
  const [err,setErr]=useState(null)
  const [n1Fonctions, setN1Fonctions] = useState([])
  const [villeOptions, setVilleOptions] = useState([])
  const [options,setOptions]=useState({
    sexe:[],departement:[],fonction:[],diplome:[],entite:[],direction:[],roles:[]
  })

  const normalizeChoice = (item) => ({
    _id: item?.value,
    value: String(item?.label ?? item?.nom ?? item?.value ?? '').trim(),
    label: String(item?.label ?? item?.nom ?? item?.value ?? '').trim(),
    id_entite: item?.id_entite,
    id_direction: item?.id_direction,
  })

  const findOptionByInput = (list, input) => {
    const raw = String(input || '').trim()
    if (!raw) return null
    return list.find((opt) => String(opt.value) === raw || String(opt.label).toLowerCase() === raw.toLowerCase()) || null
  }

  const age = React.useMemo(() => {
    if (!form.date_naissance) return ''
    const today = new Date(); const dob = new Date(form.date_naissance)
    let y = today.getFullYear() - dob.getFullYear()
    const m = today.getMonth() - dob.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) y--
    return y >= 0 ? y : ''
  }, [form.date_naissance])

  const anciennete = React.useMemo(() => {
    if (!form.date_embauche) return ''
    const today = new Date(); const dob = new Date(form.date_embauche)
    const diffDays = Math.floor((today - dob) / (1000 * 60 * 60 * 24))
    const years = Math.floor(diffDays / 365.25)
    const months = Math.floor((diffDays % 365.25) / 30.44)
    if (years === 0) return `${months} mois`
    if (months === 0) return `${years} an${years > 1 ? 's' : ''}`
    return `${years} an${years > 1 ? 's' : ''} ${months} mois`
  }, [form.date_embauche])

  useEffect(()=>{
    if(id && id!=='new'){
      api.get(`/employees/${id}`).then(r=>setForm({...r.data, sexe: normalizeSexValue(r.data.sexe), telephone: r.data.telephone || '+237', contact_urgence: r.data.contact_urgence || '+237', id_localisation: r.data.id_localisation || ''})).catch(()=>setErr('Impossible de charger'))
    }
  },[id])

  useEffect(()=>{
    async function loadStaticOptions(){
      try{
        const [di,en,rl] = await Promise.all([
          api.get('/employees/autocomplete/diplomes').catch(()=>({data:[]})),
          api.get('/employees/autocomplete/entites').catch(()=>({data:[]})),
          api.get('/roles/').catch(()=>({data:[]})),
        ])
        setOptions(prev => ({
          ...prev,
          diplome: (di.data||[]).map(normalizeChoice).filter(o=>o.label),
          entite: (en.data||[]).map(normalizeChoice).filter(o=>o.label),
          roles: (rl.data||[]).map(o=>({value:o.name,label:o.name})).filter(o=>o.label),
        }))
      }catch(e){}
    }
    loadStaticOptions()
  },[])

  useEffect(() => {
    api.get('/employees/autocomplete/n1-fonctions').then(r => setN1Fonctions(r.data || [])).catch(() => {})
  }, [])

  /* Load city autocomplete from DB with debounce */
  useEffect(() => {
    const q = form.ville || ''
    if (!q.trim()) { setVilleOptions([]); return }
    const timer = setTimeout(async () => {
      const res = await api.get('/employees/autocomplete/villes', {params:{q}}).catch(()=>({data:[]}))
      setVilleOptions((res.data||[]).map(v=>({value:v.value,label:v.label,id_localisation:v.id_localisation,id_pays:v.id_pays})))
    }, 300)
    return () => clearTimeout(timer)
  }, [form.ville])

  useEffect(() => {
    const entiteOption = findOptionByInput(options.entite, form.entite)
    if (!entiteOption) { setOptions(prev => ({...prev, direction:[], departement:[], fonction:[]})); return }
    api.get('/employees/autocomplete/directions', {params:{id_entite:entiteOption._id}}).catch(()=>({data:[]}))
      .then(res => setOptions(prev => ({...prev, direction:(res.data||[]).map(normalizeChoice).filter(o=>o.label)})))
  }, [form.entite, options.entite])

  useEffect(() => {
    const dirOption = findOptionByInput(options.direction, form.direction)
    const entOption = findOptionByInput(options.entite, form.entite)
    if (!dirOption && !entOption) { setOptions(prev=>({...prev, departement:[], fonction:[]})); return }
    const params = dirOption ? {id_direction:dirOption._id} : {id_entite:entOption._id}
    api.get('/employees/autocomplete/departements', {params}).catch(()=>({data:[]}))
      .then(res => setOptions(prev=>({...prev, departement:(res.data||[]).map(normalizeChoice).filter(o=>o.label), fonction:[]})))
  }, [form.direction, options.direction, form.entite, options.entite])

  useEffect(() => {
    const deptOption = findOptionByInput(options.departement, form.departement)
    const params = deptOption ? {dept_id:deptOption._id} : {}
    Promise.all([
      api.get('/employees/autocomplete/fonctions', {params}).catch(()=>({data:[]})),
      api.get('/employees/admin/fonctions-reference').catch(()=>({data:[]})),
    ]).then(([autoRes, refRes]) => {
      const autoLabels = (autoRes.data||[]).map(o=>o.label||o.value).filter(Boolean)
      const refLabels = (refRes.data||[]).map(o=>o.libelle||o.label||o.value).filter(Boolean)
      const seen = new Set()
      const merged = [...FUNCTION_SUGGESTIONS, ...refLabels, ...autoLabels]
        .filter(v => { const k = String(v||'').trim().toLowerCase(); if (!k||seen.has(k)) return false; seen.add(k); return true })
      setOptions(prev=>({...prev, fonction:merged.map(v=>({value:v,label:v}))}))
    })
  }, [form.departement, options.departement])

  async function submit(e){
    e.preventDefault(); setErr(null)
    const isStagiaire = /stagiaire/i.test(String(form.fonction || '')) || /stagiaire/i.test(String(form.categorie || ''))
    if (!isStagiaire && age !== '' && Number(age) < 18) {
      setErr("L'âge minimum est 18 ans (sauf stagiaires).")
      return
    }
    if (!form.entite) { setErr("L'entité est obligatoire."); return }
    if (!form.date_embauche) { setErr("La date d'embauche est obligatoire."); return }
    try{
      const toInt = (v) => (v === '' || v === null || v === undefined) ? null : Number(v)
      const payload = {
        ...form,
        id_localisation: toInt(form.id_localisation),
        nombre_enfants: toInt(form.nombre_enfants),
        salaire_brut: form.salaire_brut === '' || form.salaire_brut == null ? null : Number(form.salaire_brut),
        salaire_devise: form.salaire_devise || 'XAF',
        annee_experience: toInt(form.annee_experience),
        solde_conges: form.solde_conges !== '' && form.solde_conges !== null ? Number(form.solde_conges) : 0,
      }
      if(id && id!=='new') await api.put(`/employees/${id}`, payload)
      else await api.post('/employees/', payload)
      nav('/employees')
    }catch(e){
      const detail = e?.response?.data?.detail
      setErr(typeof detail === 'string' ? detail : 'Erreur de sauvegarde')
    }
  }

  function setField(k,v){setForm(s=>({...s,[k]:v}))}
  function setFieldWithHierarchy(k,v){
    if(k==='entite'){setForm(s=>({...s,entite:v,direction:'',departement:'',fonction:''}));return}
    if(k==='direction'){setForm(s=>({...s,direction:v,departement:'',fonction:''}));return}
    if(k==='departement'){setForm(s=>({...s,departement:v,fonction:''}));return}
    setField(k,v)
  }

  return (
    <div className="container">
      <div className="card" style={{maxWidth:700}}>
        <h2>{id && id!=='new' ? 'Éditer employé' : 'Nouvel employé'}</h2>
        <form onSubmit={submit} style={{display:'grid',gap:8}}>
          <div className="form-row">
            <input className="input" placeholder="Matricule" value={form.matricule} onChange={e=>setField('matricule',e.target.value)} required />
            <input className="input" placeholder="Nom" value={form.nom} onChange={e=>setField('nom',e.target.value)} required />
          </div>
          <div className="form-row">
            <input className="input" placeholder="Prénom" value={form.prenom} onChange={e=>setField('prenom',e.target.value)} required />
          </div>
          {/* Email + Phone */}
          <div className="form-row">
            <input className="input" type="email" placeholder="Email" value={form.email||''} onChange={e=>setField('email',e.target.value)} />
          </div>
          <div className="form-group">
            <label style={{fontSize:'0.82rem',color:'#64748b',marginBottom:4}}>Téléphone</label>
            <PhoneInput value={form.telephone} onChange={v=>setField('telephone',v)} />
          </div>
          {/* Sex + Ville */}
          <div className="form-row">
            <select className="input" aria-label="Sexe" value={form.sexe || ''} onChange={e=>setField('sexe',e.target.value)}>
              <option value="">Sexe</option>
              {SEX_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <AutocompleteInput
              placeholder="Ville"
              value={form.ville}
              onChange={v=>setField('ville',v)}
              options={villeOptions}
              strictSelection
              onInputChange={() => setField('id_localisation', '')}
              onSelectOption={(opt) => {
                if (!opt) {
                  setField('id_localisation', '')
                  return
                }
                setForm((s) => ({ ...s, ville: opt.label || opt.value || '', id_localisation: opt.id_localisation || '' }))
              }}
            />
          </div>
          <div className="form-row">
            <div className="form-group" style={{width:'100%'}}>
              <label style={{fontSize:'0.82rem',color:'#64748b',marginBottom:4}}>Contact d'urgence</label>
              <PhoneInput value={form.contact_urgence || '+237'} onChange={v=>setField('contact_urgence',v)} />
            </div>
          </div>
          {/* Dates */}
          <div className="form-row">
            <div className="form-group" style={{flex:1}}>
              <label>Date de naissance</label>
              <input className="input" type="date" value={form.date_naissance||''} onChange={e=>setField('date_naissance',e.target.value)} />
            </div>
            <div className="form-group" style={{flex:1}}>
              <label>Date d'embauche *</label>
              <input className="input" type="date" value={form.date_embauche||''} onChange={e=>setField('date_embauche',e.target.value)} required />
            </div>
            <div className="form-group" style={{flex:1}}>
              <label>Âge (auto)</label>
              <input className="input" type="number" value={age} readOnly />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group" style={{flex:1}}>
              <label>Ancienneté (auto)</label>
              <input className="input" type="text" value={anciennete} readOnly />
            </div>
            <div className="form-group" style={{flex:1}}>
              <label>Catégorie</label>
              <AutocompleteInput placeholder="Catégorie" value={form.categorie} onChange={v=>setField('categorie',v)} options={CATEGORIES_DB} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group" style={{flex:1}}>
              <label>Statut matrimonial</label>
              <select className="input" value={form.statut_matrimonial||''} onChange={e=>setField('statut_matrimonial',e.target.value)}>
                <option value="">-- Sélectionner --</option>
                <option value="Celibataire">Célibataire</option>
                <option value="Marie">Marié</option>
              </select>
            </div>
            <div className="form-group" style={{flex:1}}>
              <label>Nombre d'enfants</label>
              <input className="input" type="number" min="0" placeholder="0" value={form.nombre_enfants ?? ''} onChange={e=>setField('nombre_enfants',e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group" style={{flex:2}}>
              <label>Salaire brut <span style={{color:'#94a3b8',fontSize:'0.7rem'}}>(confidentiel — RH/Direction uniquement)</span></label>
              <input className="input" type="number" min="0" step="0.01" placeholder="0" value={form.salaire_brut ?? ''} onChange={e=>setField('salaire_brut',e.target.value)} />
            </div>
            <div className="form-group" style={{flex:1}}>
              <label>Devise</label>
              <select className="input" value={form.salaire_devise||'XAF'} onChange={e=>setField('salaire_devise',e.target.value)}>
                <option value="XAF">XAF</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="XOF">XOF</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <input className="input" type="number" placeholder="Années d'expérience" value={form.annee_experience||''} onChange={e=>setField('annee_experience',e.target.value)} />
            <select className="input" value={form.n1_fonction||''} onChange={e=>setField('n1_fonction',e.target.value)}>
              <option value="">— N+1 Supérieur hiérarchique (optionnel) —</option>
              {n1Fonctions.map(f => (
                <option key={f.fonction} value={f.fonction}>
                  {f.fonction}{f.prenom || f.nom ? ` — ${[f.prenom, f.nom].filter(Boolean).join(' ')}` : ''}
                </option>
              ))}
            </select>
          </div>
          {/* Diplôme */}
          <div className="form-row">
            <AutocompleteInput placeholder="Diplôme" value={form.diplome} onChange={v=>setField('diplome',v)} options={options.diplome} />
            {(!id || id === 'new') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Solde initial de congés (jours)</label>
                <input className="input" type="number" min={0} placeholder="Solde initial de congés (jours)" value={form.solde_conges ?? 0} onChange={e=>setField('solde_conges', e.target.value)} />
              </div>
            )}
          </div>
          {/* Org hierarchy */}
          <div className="form-row">
            <AutocompleteInput placeholder="Entité *" value={form.entite} onChange={v=>setFieldWithHierarchy('entite',v)} options={options.entite} />
            <AutocompleteInput placeholder="Direction (optionnelle)" value={form.direction} onChange={v=>setFieldWithHierarchy('direction',v)} options={options.direction} disabled={!form.entite} />
            <AutocompleteInput placeholder="Département" value={form.departement} onChange={v=>setFieldWithHierarchy('departement',v)} options={options.departement} disabled={!form.entite} />
          </div>
          <div className="form-row">
            <AutocompleteInput placeholder="Rôle" value={form.role} onChange={v=>setField('role',v)} options={options.roles} />
            <AutocompleteInput placeholder="Fonction *" value={form.fonction} onChange={v=>setField('fonction',v)} options={options.fonction} required={true} disabled={!form.entite} />
          </div>
          <div className="small" style={{marginTop:'-4px',color:'#64748b'}}>
            Ordre: Entité {'>'} Département {'>'} Fonction. La Direction est optionnelle.
          </div>
          {/* Statut */}
          <div className="form-row">
            <select className="input" value={form.statut_employe||'ACTIF'} onChange={e=>setField('statut_employe',e.target.value)}>
              <option value="ACTIF">Actif</option>
              <option value="CONGEDIE">Congédié</option>
              <option value="SUSPENDU">Suspendu</option>
            </select>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',gap:12}}>
            <div className="small" style={{color:'#ef4444'}}>{err}</div>
            <div style={{display:'flex',gap:12}}>
              <button className="button" style={{background:'#e5e7eb',color:'#1f2937'}} type="button" onClick={()=>nav('/employees')}>Annuler</button>
              <button className="button" type="submit">Enregistrer</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
