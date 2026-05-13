import React, {useEffect, useState, useRef} from 'react'
import api from '../services/api'
import {useNavigate, useParams} from 'react-router-dom'
import AutocompleteInput from '../components/AutocompleteInput'
import { useAuth } from '../contexts/AuthContext'

/* ── Country dial codes with flag emojis ── */
const COUNTRY_CODES = [
  {code:'+93',country:'Afghanistan',flag:'🇦🇫'},{code:'+355',country:'Albanie',flag:'🇦🇱'},
  {code:'+213',country:'Algérie',flag:'🇩🇿'},{code:'+376',country:'Andorre',flag:'🇦🇩'},
  {code:'+244',country:'Angola',flag:'🇦🇴'},{code:'+54',country:'Argentine',flag:'🇦🇷'},
  {code:'+374',country:'Arménie',flag:'🇦🇲'},{code:'+61',country:'Australie',flag:'🇦🇺'},
  {code:'+43',country:'Autriche',flag:'🇦🇹'},{code:'+994',country:'Azerbaïdjan',flag:'🇦🇿'},
  {code:'+1-242',country:'Bahamas',flag:'🇧🇸'},{code:'+973',country:'Bahreïn',flag:'🇧🇭'},
  {code:'+880',country:'Bangladesh',flag:'🇧🇩'},{code:'+32',country:'Belgique',flag:'🇧🇪'},
  {code:'+229',country:'Bénin',flag:'🇧🇯'},{code:'+975',country:'Bhoutan',flag:'🇧🇹'},
  {code:'+591',country:'Bolivie',flag:'🇧🇴'},{code:'+387',country:'Bosnie',flag:'🇧🇦'},
  {code:'+267',country:'Botswana',flag:'🇧🇼'},{code:'+55',country:'Brésil',flag:'🇧🇷'},
  {code:'+226',country:'Burkina Faso',flag:'🇧🇫'},{code:'+257',country:'Burundi',flag:'🇧🇮'},
  {code:'+855',country:'Cambodge',flag:'🇰🇭'},{code:'+237',country:'Cameroun',flag:'🇨🇲'},
  {code:'+1',country:'Canada / USA',flag:'🇨🇦'},{code:'+238',country:'Cap-Vert',flag:'🇨🇻'},
  {code:'+236',country:'Centrafrique',flag:'🇨🇫'},{code:'+235',country:'Tchad',flag:'🇹🇩'},
  {code:'+56',country:'Chili',flag:'🇨🇱'},{code:'+86',country:'Chine',flag:'🇨🇳'},
  {code:'+57',country:'Colombie',flag:'🇨🇴'},{code:'+269',country:'Comores',flag:'🇰🇲'},
  {code:'+242',country:'Congo (Brazzaville)',flag:'🇨🇬'},{code:'+243',country:'Congo (RDC)',flag:'🇨🇩'},
  {code:'+506',country:'Costa Rica',flag:'🇨🇷'},{code:'+225',country:"Côte d'lvoire",flag:'🇨🇮'},
  {code:'+385',country:'Croatie',flag:'🇭🇷'},{code:'+53',country:'Cuba',flag:'🇨🇺'},
  {code:'+45',country:'Danemark',flag:'🇩🇰'},{code:'+253',country:'Djibouti',flag:'🇩🇯'},
  {code:'+20',country:'Égypte',flag:'🇪🇬'},{code:'+503',country:'El Salvador',flag:'🇸🇻'},
  {code:'+971',country:'Émirats',flag:'🇦🇪'},{code:'+593',country:'Équateur',flag:'🇪🇨'},
  {code:'+291',country:'Érythrée',flag:'🇪🇷'},{code:'+34',country:'Espagne',flag:'🇪🇸'},
  {code:'+372',country:'Estonie',flag:'🇪🇪'},{code:'+251',country:'Éthiopie',flag:'🇪🇹'},
  {code:'+679',country:'Fidji',flag:'🇫🇯'},{code:'+358',country:'Finlande',flag:'🇫🇮'},
  {code:'+33',country:'France',flag:'🇫🇷'},{code:'+241',country:'Gabon',flag:'🇬🇦'},
  {code:'+220',country:'Gambie',flag:'🇬🇲'},{code:'+995',country:'Géorgie',flag:'🇬🇪'},
  {code:'+233',country:'Ghana',flag:'🇬🇭'},{code:'+30',country:'Grèce',flag:'🇬🇷'},
  {code:'+502',country:'Guatemala',flag:'🇬🇹'},{code:'+224',country:'Guinée',flag:'🇬🇳'},
  {code:'+245',country:'Guinée-Bissau',flag:'🇬🇼'},{code:'+240',country:'Guinée Équatoriale',flag:'🇬🇶'},
  {code:'+509',country:'Haïti',flag:'🇭🇹'},{code:'+504',country:'Honduras',flag:'🇭🇳'},
  {code:'+36',country:'Hongrie',flag:'🇭🇺'},{code:'+91',country:'Inde',flag:'🇮🇳'},
  {code:'+62',country:'Indonésie',flag:'🇮🇩'},{code:'+98',country:'Iran',flag:'🇮🇷'},
  {code:'+964',country:'Irak',flag:'🇮🇶'},{code:'+353',country:'Irlande',flag:'🇮🇪'},
  {code:'+972',country:'Israël',flag:'🇮🇱'},{code:'+39',country:'Italie',flag:'🇮🇹'},
  {code:'+1-876',country:'Jamaïque',flag:'🇯🇲'},{code:'+81',country:'Japon',flag:'🇯🇵'},
  {code:'+962',country:'Jordanie',flag:'🇯🇴'},{code:'+7',country:'Kazakhstan',flag:'🇰🇿'},
  {code:'+254',country:'Kenya',flag:'🇰🇪'},{code:'+965',country:'Koweït',flag:'🇰🇼'},
  {code:'+996',country:'Kirghizstan',flag:'🇰🇬'},{code:'+856',country:'Laos',flag:'🇱🇦'},
  {code:'+371',country:'Lettonie',flag:'🇱🇻'},{code:'+961',country:'Liban',flag:'🇱🇧'},
  {code:'+266',country:'Lesotho',flag:'🇱🇸'},{code:'+231',country:'Libéria',flag:'🇱🇷'},
  {code:'+218',country:'Libye',flag:'🇱🇾'},{code:'+370',country:'Lituanie',flag:'🇱🇹'},
  {code:'+352',country:'Luxembourg',flag:'🇱🇺'},{code:'+261',country:'Madagascar',flag:'🇲🇬'},
  {code:'+265',country:'Malawi',flag:'🇲🇼'},{code:'+60',country:'Malaisie',flag:'🇲🇾'},
  {code:'+960',country:'Maldives',flag:'🇲🇻'},{code:'+223',country:'Mali',flag:'🇲🇱'},
  {code:'+356',country:'Malte',flag:'🇲🇹'},{code:'+222',country:'Mauritanie',flag:'🇲🇷'},
  {code:'+230',country:'Maurice',flag:'🇲🇺'},{code:'+52',country:'Mexique',flag:'🇲🇽'},
  {code:'+373',country:'Moldavie',flag:'🇲🇩'},{code:'+212',country:'Maroc',flag:'🇲🇦'},
  {code:'+258',country:'Mozambique',flag:'🇲🇿'},{code:'+264',country:'Namibie',flag:'🇳🇦'},
  {code:'+977',country:'Népal',flag:'🇳🇵'},{code:'+31',country:'Pays-Bas',flag:'🇳🇱'},
  {code:'+64',country:'Nouvelle-Zélande',flag:'🇳🇿'},{code:'+505',country:'Nicaragua',flag:'🇳🇮'},
  {code:'+227',country:'Niger',flag:'🇳🇪'},{code:'+234',country:'Nigéria',flag:'🇳🇬'},
  {code:'+47',country:'Norvège',flag:'🇳🇴'},{code:'+968',country:'Oman',flag:'🇴🇲'},
  {code:'+92',country:'Pakistan',flag:'🇵🇰'},{code:'+507',country:'Panama',flag:'🇵🇦'},
  {code:'+595',country:'Paraguay',flag:'🇵🇾'},{code:'+51',country:'Pérou',flag:'🇵🇪'},
  {code:'+63',country:'Philippines',flag:'🇵🇭'},{code:'+48',country:'Pologne',flag:'🇵🇱'},
  {code:'+351',country:'Portugal',flag:'🇵🇹'},{code:'+974',country:'Qatar',flag:'🇶🇦'},
  {code:'+40',country:'Roumanie',flag:'🇷🇴'},{code:'+7',country:'Russie',flag:'🇷🇺'},
  {code:'+250',country:'Rwanda',flag:'🇷🇼'},{code:'+966',country:'Arabie Saoudite',flag:'🇸🇦'},
  {code:'+221',country:'Sénégal',flag:'🇸🇳'},{code:'+381',country:'Serbie',flag:'🇷🇸'},
  {code:'+232',country:'Sierra Leone',flag:'🇸🇱'},{code:'+65',country:'Singapour',flag:'🇸🇬'},
  {code:'+421',country:'Slovaquie',flag:'🇸🇰'},{code:'+386',country:'Slovénie',flag:'🇸🇮'},
  {code:'+252',country:'Somalie',flag:'🇸🇴'},{code:'+27',country:'Afrique du Sud',flag:'🇿🇦'},
  {code:'+211',country:'Soudan du Sud',flag:'🇸🇸'},{code:'+34',country:'Espagne',flag:'🇪🇸'},
  {code:'+94',country:'Sri Lanka',flag:'🇱🇰'},{code:'+249',country:'Soudan',flag:'🇸🇩'},
  {code:'+46',country:'Suède',flag:'🇸🇪'},{code:'+41',country:'Suisse',flag:'🇨🇭'},
  {code:'+963',country:'Syrie',flag:'🇸🇾'},{code:'+886',country:'Taïwan',flag:'🇹🇼'},
  {code:'+255',country:'Tanzanie',flag:'🇹🇿'},{code:'+228',country:'Togo',flag:'🇹🇬'},
  {code:'+216',country:'Tunisie',flag:'🇹🇳'},{code:'+90',country:'Turquie',flag:'🇹🇷'},
  {code:'+256',country:'Ouganda',flag:'🇺🇬'},{code:'+380',country:'Ukraine',flag:'🇺🇦'},
  {code:'+44',country:'Royaume-Uni',flag:'🇬🇧'},{code:'+598',country:'Uruguay',flag:'🇺🇾'},
  {code:'+998',country:'Ouzbékistan',flag:'🇺🇿'},{code:'+58',country:'Venezuela',flag:'🇻🇪'},
  {code:'+84',country:'Viêt Nam',flag:'🇻🇳'},{code:'+967',country:'Yémen',flag:'🇾🇪'},
  {code:'+260',country:'Zambie',flag:'🇿🇲'},{code:'+263',country:'Zimbabwe',flag:'🇿🇼'},
]

/* ── Parse existing telephone value into code + number ── */
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

/* ── PhoneInput component ── */
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
  const selectedLabel = `${getCountryIsoFromFlag(selected.flag)} (${selected.code})`

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
            style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 1000, width: 240, maxHeight: 240, overflowY: 'auto', background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
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

/* ── Valid DB enum categories ── */
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
  const { user } = useAuth() || {}
  const isPrivilegedForSalaire = ['RH', 'ADMIN', 'PCA', 'AG', 'DG', 'DRH'].includes(String(user?.role || '').toUpperCase())
  // L'accès au formulaire de création/édition d'employé est déjà restreint à des rôles
  // habilités côté liste (canCreateEmployee). On affiche donc le champ Salaire pour
  // tout utilisateur ayant atteint ce formulaire.
  const showSalaireField = true
  const [form,setForm]=useState({
    matricule:'',nom:'',prenom:'',date_naissance:'',sexe:'',telephone:'+237',email:'',
    departement:'',fonction:'',ville:'',id_localisation:'',contact_urgence:'+237',diplome:'',solde_conges:0,
    date_embauche:'',entite:'',role:'',direction:'',categorie:'',n1_fonction:'',
    annee_experience:0,statut_employe:'ACTIF',statut_matrimonial:'',nombre_enfants:'',
    salaire_brut:'',salaire_devise:'XAF',nouvelle_recrue:false,
    type_contrat:'CDI',date_debut_contrat:'',date_fin_contrat:''
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
      api.get(`/employees/${id}`).then(r=>{
        // Coerce every null/undefined to '' for string fields to avoid React controlled→uncontrolled warnings
        const defaults = {
          matricule:'',nom:'',prenom:'',date_naissance:'',sexe:'',telephone:'+237',email:'',
          departement:'',fonction:'',ville:'',id_localisation:'',contact_urgence:'+237',diplome:'',solde_conges:0,
          date_embauche:'',entite:'',role:'',direction:'',categorie:'',n1_fonction:'',
          annee_experience:0,statut_employe:'ACTIF',statut_matrimonial:'',nombre_enfants:'',nouvelle_recrue:false,
          type_contrat:'CDI',date_debut_contrat:'',date_fin_contrat:''
        }
        const merged = {}
        for (const key of Object.keys(defaults)) {
          const v = r.data[key]
          merged[key] = (v === null || v === undefined) ? defaults[key] : v
        }
        merged.sexe = normalizeSexValue(merged.sexe)
        if (!merged.telephone || merged.telephone === '') merged.telephone = '+237'
        if (!merged.contact_urgence || merged.contact_urgence === '') merged.contact_urgence = '+237'
        setForm(merged)
      }).catch(()=>setErr('Impossible de charger'))
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
    api.get('/employees/autocomplete/fonctions', {params: deptOption ? {dept_id:deptOption._id} : {}}).catch(()=>({data:[]}))
      .then(res => {
        const seen = new Set()
        const merged = [...FUNCTION_SUGGESTIONS, ...(res.data||[]).map(o=>o.label||o.value).filter(Boolean)]
          .filter(v => { const k = String(v||'').trim().toLowerCase(); if (!k||seen.has(k)) return false; seen.add(k); return true })
        setOptions(prev=>({...prev, fonction:merged.map(v=>({value:v,label:v}))}))
      })
  }, [form.departement, options.departement])

  async function submit(e){
    e.preventDefault(); setErr(null)
    const isStagiaire = /stagiaire/i.test(String(form.fonction || '')) || /stagiaire/i.test(String(form.categorie || ''))
    if (!isStagiaire && age !== '' && Number(age) < 18) {
      setErr("L'employé doit avoir au moins 18 ans")
      return
    }
    if (!form.entite) { setErr("L'entité est obligatoire"); return }
    if (!form.date_embauche) { setErr("La date d'embauche est obligatoire"); return }
    try{
      const toInt = (v) => (v === '' || v === null || v === undefined) ? null : Number(v)
      const toFloat = (v) => (v === '' || v === null || v === undefined) ? null : Number(v)
      const toDate = (v) => (v === '' || v === null || v === undefined) ? null : v
      const payload = {
        ...form,
        id_localisation: toInt(form.id_localisation),
        nombre_enfants: toInt(form.nombre_enfants),
        annee_experience: toInt(form.annee_experience),
        solde_conges: form.solde_conges !== '' && form.solde_conges !== null ? Number(form.solde_conges) : 0,
        salaire_brut: toFloat(form.salaire_brut),
        date_naissance: toDate(form.date_naissance),
        date_embauche: toDate(form.date_embauche),
      }
      if(id && id!=='new') await api.put(`/employees/${id}`, payload)
      else await api.post('/employees/', payload)
      window.dispatchEvent(new CustomEvent('ems:dataChanged'))
      nav('/employees')
    }catch(e){
      const detail = e?.response?.data?.detail
      // Traduction des messages Pydantic courants en français
      const PYDANTIC_FR = {
        'Input should be a valid date': 'Date invalide',
        'Input should be a valid number': 'Nombre invalide',
        'Input should be a valid integer': 'Nombre entier invalide',
        'Field required': 'Champ obligatoire',
        'String should have at most': 'Texte trop long',
        'String should have at least': 'Texte trop court',
        'Value error': 'Valeur incorrecte',
      }
      const translateMsg = (msg) => {
        if (!msg) return msg
        for (const [en, fr] of Object.entries(PYDANTIC_FR)) {
          if (msg.includes(en)) return fr
        }
        return msg
      }
      const FIELD_FR = {
        date_naissance: 'Date de naissance',
        date_embauche: "Date d'embauche",
        salaire_brut: 'Salaire brut',
        matricule: 'Matricule',
        nom: 'Nom',
        prenom: 'Prénom',
        email: 'E-mail',
        telephone: 'Téléphone',
        n1: 'N+1',
      }
      let msg
      if (typeof detail === 'string') msg = detail
      else if (Array.isArray(detail)) msg = detail.map(d => {
        const field = FIELD_FR[d?.loc?.[d?.loc?.length - 1]] || d?.loc?.[d?.loc?.length - 1] || ''
        const translated = translateMsg(d?.msg)
        return field ? `${field} : ${translated}` : translated
      }).join(' | ')
      else msg = 'Erreur lors de la sauvegarde'
      setErr(msg)
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
        <h2>{id && id!=='new' ? "Modifier l'employé" : "Nouvel employé"}</h2>
        <form onSubmit={submit} style={{display:'grid',gap:8}}>
          <div className="form-row">
            <input className="input" placeholder="Matricule" pattern="[A-Za-z0-9\-]+" title="Lettres, chiffres et tirets uniquement" value={form.matricule} onChange={e=>setField('matricule',e.target.value)} required />
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
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
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
              <label>Âge</label>
              <input className="input" type="number" value={age} readOnly />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group" style={{flex:1}}>
              <label>Ancienneté</label>
              <input className="input" type="text" value={anciennete} readOnly />
            </div>
            <div className="form-group" style={{flex:1}}>
              <label>Catégorie</label>
              <AutocompleteInput placeholder="Catégorie" value={form.categorie} onChange={v=>setField('categorie',v)} options={CATEGORIES_DB} />
            </div>
          </div>
          {/* Nouvelle recrue — déplacé en bas du formulaire pour meilleure visibilité */}
          <div className="form-row">
            <div className="form-group" style={{flex:1}}>
              <label>Statut matrimonial</label>
              <select className="input" value={form.statut_matrimonial||''} onChange={e=>setField('statut_matrimonial',e.target.value)}>
                <option value="">-- Sélectionner --</option>
                <option value="Celibataire">Célibataire</option>
                <option value="Marie">Marié(e)</option>
              </select>
            </div>
            <div className="form-group" style={{flex:1}}>
              <label>Nombre d'enfants</label>
              <input className="input" type="number" min="0" placeholder="0" value={form.nombre_enfants ?? ''} onChange={e=>setField('nombre_enfants',e.target.value)} />
            </div>
          </div>
          {showSalaireField && (
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
          )}
          <div className="form-row">
            <input className="input" type="number" placeholder="Années d'expérience" value={form.annee_experience||''} onChange={e=>setField('annee_experience',e.target.value)} />
            <select className="input" value={form.n1_fonction||''} onChange={e=>setField('n1_fonction',e.target.value)}>
              <option value="">— N+1 (Manager) —</option>
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
            <AutocompleteInput placeholder="Direction" value={form.direction} onChange={v=>setFieldWithHierarchy('direction',v)} options={options.direction} disabled={!form.entite} />
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
          {/* Type de contrat */}
          <div style={{padding:'14px 16px',background:'#f8fafc',border:'1.5px solid #e2e8f0',borderRadius:10,marginTop:4}}>
            <div style={{fontWeight:700,fontSize:'0.88rem',color:'#021630',marginBottom:10}}>Type de contrat</div>
            <div style={{display:'flex',gap:16,flexWrap:'wrap',marginBottom:8}}>
              {['CDI','CDD','Stagiaire'].map(tc=>(
                <label key={tc} style={{display:'flex',alignItems:'center',gap:7,cursor:'pointer',fontWeight:form.type_contrat===tc?700:400,color:form.type_contrat===tc?'#021630':'#64748b'}}>
                  <input type="radio" name="type_contrat" value={tc} checked={form.type_contrat===tc} onChange={()=>setField('type_contrat',tc)} style={{accentColor:'#021630'}} />
                  {tc}
                  {tc==='CDI'&&<span style={{fontSize:'0.72rem',color:'#64748b',fontWeight:400}}>(permanent)</span>}
                  {tc==='CDD'&&<span style={{fontSize:'0.72rem',color:'#64748b',fontWeight:400}}>(durée déterminée)</span>}
                  {tc==='Stagiaire'&&<span style={{fontSize:'0.72rem',color:'#64748b',fontWeight:400}}>(période de formation)</span>}
                </label>
              ))}
            </div>
            {(form.type_contrat==='CDD'||form.type_contrat==='Stagiaire')&&(
              <>
              <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:4}}>
                <div style={{flex:'1 1 180px'}}>
                  <label style={{fontSize:'0.78rem',color:'#64748b',display:'block',marginBottom:3}}>Date de début</label>
                  <input className="input" type="date" value={form.date_debut_contrat||''} onChange={e=>setField('date_debut_contrat',e.target.value)} />
                </div>
                <div style={{flex:'1 1 180px'}}>
                  <label style={{fontSize:'0.78rem',color:'#64748b',display:'block',marginBottom:3}}>Date de fin *</label>
                  <input className="input" type="date" value={form.date_fin_contrat||''} onChange={e=>setField('date_fin_contrat',e.target.value)} required={form.type_contrat!=='CDI'} />
                </div>
              </div>
              {(()=>{
                if(!form.date_debut_contrat||!form.date_fin_contrat) return null
                const d1=new Date(form.date_debut_contrat), d2=new Date(form.date_fin_contrat)
                const days=Math.round((d2-d1)/86400000)
                if(isNaN(days)||days<=0) return (
                  <div style={{marginTop:6,padding:'8px 14px',background:'#fff1f2',border:'1.5px solid #fca5a5',borderRadius:8,fontSize:'0.82rem',color:'#b91c1c',fontWeight:600}}>
                    ⚠ La date de fin doit être après la date de début
                  </div>
                )
                const months=Math.floor(days/30.4375)
                const remDays=days-Math.round(months*30.4375)
                let label=''
                if(months>=12){const y=Math.floor(months/12),m=months%12;label=m>0?`${y} an${y>1?'s':''} et ${m} mois`:`${y} an${y>1?'s':''}`}
                else if(months>=1) label=remDays>0?`${months} mois et ${remDays} jours`:`${months} mois`
                else label=`${days} jours`
                return (
                  <div style={{marginTop:6,display:'flex',alignItems:'center',gap:10,padding:'10px 16px',background:'#eff6ff',border:'1.5px solid #93c5fd',borderRadius:8}}>
                    <span style={{fontSize:'1.1rem'}}>⏱</span>
                    <div>
                      <div style={{fontSize:'0.74rem',color:'#64748b',fontWeight:500}}>Durée du contrat</div>
                      <div style={{fontSize:'1rem',fontWeight:800,color:'#021630'}}>{label}</div>
                    </div>
                    <span style={{marginLeft:'auto',fontSize:'0.75rem',color:'#3b82f6',background:'#dbeafe',padding:'3px 10px',borderRadius:12,fontWeight:700}}>{days} jours au total</span>
                  </div>
                )
              })()}
              </>
            )}
          </div>
          {/* Nouvelle recrue — juste avant enregistrer, bien visible */}
          {isPrivilegedForSalaire && (
            <label style={{display:'flex',alignItems:'center',gap:12,cursor:'pointer',userSelect:'none',padding:'12px 16px',background:'#f0fdf4',border:'2px solid #86efac',borderRadius:10,marginTop:4}}>
              <input
                type="checkbox"
                checked={!!form.nouvelle_recrue}
                onChange={e=>setField('nouvelle_recrue',e.target.checked)}
                disabled={!!form.nouvelle_recrue}
                style={{width:18,height:18,accentColor:'#16a34a',cursor:form.nouvelle_recrue?'not-allowed':'pointer',flexShrink:0,opacity:form.nouvelle_recrue?0.7:1}}
              />
              <div>
                <div style={{fontWeight:700,fontSize:'0.9rem',color:'#15803d'}}>Nouvelle recrue</div>
                <div style={{fontSize:'0.75rem',color:'#4ade80',marginTop:1}}>Cocher si c&apos;est une nouvelle embauche — comptabilisé dans les statistiques de recrutement{form.nouvelle_recrue&&<span style={{color:'#86efac',marginLeft:6}}>(se réinitialise automatiquement 1 an après la date d&apos;embauche)</span>}</div>
              </div>
              <span style={{marginLeft:'auto',fontSize:'0.74rem',color:'#15803d',background:'#dcfce7',padding:'3px 10px',borderRadius:12,fontWeight:700,flexShrink:0}}>Recrutement</span>
            </label>
          )}
          <div style={{display:'flex',justifyContent:'space-between',gap:12,marginTop:8}}>
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
