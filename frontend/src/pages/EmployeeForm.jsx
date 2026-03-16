import React, {useEffect, useState} from 'react'
import api from '../services/api'
import {useNavigate, useParams} from 'react-router-dom'

const FUNCTION_SUGGESTIONS = [
  'Administrateur Général',
  'PCA',
  'Directeur Audit Interne et Inspection Générale',
  'Inspecteur Générale(IG)',
  'Auditeur',
  "Représentants Résidents et responsables de la creation et relation d'affaires",
  'Directeur financier et Comptable(DFC)',
  'comptable et responsable contrôle et consolidation',
  'responsable Trésorerie et financement',
  'contrôleur de gestion',
  'comptable',
  'responsable des resources Humaines',
  'chargé des resources humaines',
  'responsable communication et relation publiques',
  'chargé community management accueil et courrier',
  'infographiste et déploiement',
  'Responsable affaires juridiques & fiscalité',
  'chargé de la fiscalité',
  'Directeur des Organisations et projets',
  "Responsable des systèmes d'information",
  'chargé des organisations et projets',
  'chargé marketing digital opérationnel',
  'chargé des moyens généraux',
  'Administrateur Directeur Général',
  'Directeur Général Adjoint',
  'Responsable conformité et contrôle interne',
  'Directeur Développement et investissement',
  'Responsable développement Pool Grande Entreprise & Fortunes',
  'Chargé développement Pool Grande Entreprise & Fortunes',
  'Responsable développement Pool Particuliers & PME',
  'Chargé développement Pool Particuliers & PMEs',
  'Responsable Middle & Back Office',
  'Responsable Trésorerie(ALM)',
  'Chargé de négociation',
  'Directeur Conseil et Financement structurés',
  'Responsable Financement et structuration',
  'Analyste Financement et structuration',
  'Responsable du Développement',
  'Chargé du développement portefeuille Grandes entreprise et Fortune',
  'Chargé du développement portefeuille particulier et PME',
  'Directeur Conformité et Contrôle interne',
  'Directeur Distribution',
  'Responsable Distribution Grandes Entreprises Institutions et Fortunes',
  'Responsable Distribution Particuliers et PME',
  'Responsable Gestion et Analyste de portefeuille',
  'chargé de Gestions de portefeuille',
  'chargé Analyste de portefeuille',
  'Responsable Middle & Back office',
  'chargé Back Office & operations'
]

export default function EmployeeForm(){
  const {id} = useParams()
  const nav = useNavigate()
  const [form,setForm]=useState({matricule:'',nom:'',prenom:'',date_naissance:'',sexe:'',telephone:'',email:'',departement:'',fonction:'',ville:'',contact_urgence:'',diplome:'',solde_conges:0,date_embauche:'',entite:'',role:'',direction:'',categorie:'',n1:'',annee_experience:0,statut_employe:'ACTIF'})
  const [err,setErr]=useState(null)
  const [options,setOptions]=useState({
    sexe:[],
    departement:[],
    fonction:[],
    diplome:[],
    entite:[],
    categorie:[],
    direction:[],
    roles:[]
  })

  const CONVENTION_CATEGORIES = (() => {
    const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
    const letters = ['A', 'B', 'C', 'D', 'E', 'F']
    const categories = []
    romans.forEach(roman => {
      letters.forEach(letter => {
        categories.push({ level: roman + letter, label: `Catégorie ${roman}${letter}` })
      })
    })
    return categories
  })()

  const age = React.useMemo(() => {
    if (!form.date_naissance) return ''
    const today = new Date()
    const dob = new Date(form.date_naissance)
    let years = today.getFullYear() - dob.getFullYear()
    const monthDiff = today.getMonth() - dob.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      years -= 1
    }
    return years >= 0 ? years : ''
  }, [form.date_naissance])

  const anciennete = React.useMemo(() => {
    if (!form.date_embauche) return ''
    const today = new Date()
    const dob = new Date(form.date_embauche)
    const diffTime = today - dob
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    const years = Math.floor(diffDays / 365.25)
    const months = Math.floor((diffDays % 365.25) / 30.44)
    if (years === 0) return `${months} mois`
    if (months === 0) return `${years} an${years > 1 ? 's' : ''}`
    return `${years} an${years > 1 ? 's' : ''} ${months} mois`
  }, [form.date_embauche])

  useEffect(()=>{
    if(id && id!=='new'){
      api.get(`/employees/${id}`).then(r=>setForm(r.data)).catch(()=>setErr('Impossible de charger'))
    }
  },[id])

  useEffect(()=>{
    async function loadOptions(){
      try{
        const [sx,dp,fc,di,en,rl,cat,dir] = await Promise.all([
          api.get('/employees/autocomplete/sexe').catch(()=>({data:[]})),
          api.get('/employees/autocomplete/departements').catch(()=>({data:[]})),
          api.get('/employees/autocomplete/fonctions').catch(()=>({data:[]})),
          api.get('/employees/autocomplete/diplomes').catch(()=>({data:[]})),
          api.get('/employees/autocomplete/entites').catch(()=>({data:[]})),
          api.get('/roles/').catch(()=>({data:[]})),
          api.get('/employees/autocomplete/categories').catch(()=>({data:[]})),
          api.get('/employees/autocomplete/directions').catch(()=>({data:[]}))
        ])

        const mergeUnique = (primary, secondary = []) => {
          const seen = new Set()
          const out = []
          ;[...primary, ...secondary].forEach((value) => {
            const v = String(value || '').trim()
            const key = v.toLowerCase()
            if (!v || seen.has(key)) return
            seen.add(key)
            out.push(v)
          })
          return out
        }

        setOptions({
          sexe: (sx.data || []).map(o=>o.label || o.value).filter(Boolean),
          departement: (dp.data || []).map(o=>o.label || o.value).filter(Boolean),
          fonction: mergeUnique(
            FUNCTION_SUGGESTIONS,
            (fc.data || []).map(o=>o.label || o.value).filter(Boolean)
          ),
          diplome: (di.data || []).map(o=>o.label || o.value).filter(Boolean),
          entite: (en.data || []).map(o=>o.label || o.value).filter(Boolean),
          roles: (rl.data || []).map(o=>o.name).filter(Boolean),
          categorie: (cat.data || []).map(o=>o.label || o.value).filter(Boolean),
          direction: (dir.data || []).map(o=>o.label || o.nom || o.value).filter(Boolean)
        })
      }catch(e){
        setOptions({sexe:[],departement:[],fonction:[],diplome:[],entite:[],roles:[],categorie:[],direction:[]})
      }
    }
    loadOptions()
  },[])

  async function submit(e){
    e.preventDefault(); setErr(null)
    try{
      const fonctionSaisie = String(form.fonction || '').trim()
      const fonctionsDisponibles = (options.fonction?.length ? options.fonction : FUNCTION_SUGGESTIONS)
        .map((v) => String(v || '').trim().toLowerCase())
        .filter(Boolean)
      if (!fonctionSaisie || !fonctionsDisponibles.includes(fonctionSaisie.toLowerCase())) {
        setErr("Veuillez choisir une fonction existante dans la liste d'autocompletion.")
        return
      }

      if(id && id!=='new') await api.put(`/employees/${id}`,form)
      else await api.post('/employees',form)
      nav('/employees')
    }catch(e){setErr('Erreur sauvegarde')}
  }

  function setField(k,v){setForm(s=>({...s,[k]:v}))}

  return (
    <div className="container">
      <div className="card" style={{maxWidth:700}}>
        <h2>{id && id!=='new' ? 'Éditer employé' : 'Nouveau employé'}</h2>
        <form onSubmit={submit} style={{display:'grid',gap:8}}>
          <div className="form-row">
            <input className="input" placeholder="Matricule" value={form.matricule} onChange={e=>setField('matricule',e.target.value)} />
            <input className="input" placeholder="Nom" value={form.nom} onChange={e=>setField('nom',e.target.value)} />
          </div>
          <div className="form-row">
            <input className="input" placeholder="Prénom" value={form.prenom} onChange={e=>setField('prenom',e.target.value)} />
            <input className="input" placeholder="Téléphone" value={form.telephone} onChange={e=>setField('telephone',e.target.value)} />
          </div>
          <div className="form-row">
            <input className="input" placeholder="Sexe" list="sexe-options" value={form.sexe} onChange={e=>setField('sexe',e.target.value)} />
            <datalist id="sexe-options">
              {options.sexe.map(v=><option key={v} value={v} />)}
            </datalist>
            <input className="input" placeholder="Ville" value={form.ville} onChange={e=>setField('ville',e.target.value)} />
          </div>
          <div className="form-row">
            <input className="input" placeholder="Contact d'urgence" value={form.contact_urgence} onChange={e=>setField('contact_urgence',e.target.value)} />
          </div>

          <div className="form-row">
            <div className="form-group" style={{flex: 1}}>
              <label>Date de naissance</label>
              <input className="input" type="date" value={form.date_naissance || ''} onChange={e=>setField('date_naissance',e.target.value)} />
            </div>
            <div className="form-group" style={{flex: 1}}>
              <label>Date d'embauche</label>
              <input className="input" type="date" value={form.date_embauche || ''} onChange={e=>setField('date_embauche',e.target.value)} />
            </div>
            <div className="form-group" style={{flex: 1}}>
              <label>Âge (automatique)</label>
              <input className="input" type="number" value={age} readOnly />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{flex: 1}}>
              <label>Ancienneté (automatique)</label>
              <input className="input" type="text" value={anciennete} readOnly />
            </div>
            <div className="form-group" style={{flex: 1}}>
              <input className="input" placeholder="Catégorie" list="categorie-options" value={form.categorie} onChange={e=>setField('categorie',e.target.value)} />
              <datalist id="categorie-options">
                {CONVENTION_CATEGORIES.map(c=><option key={c.level} value={c.level}>{c.level} - {c.label}</option>)}
              </datalist>
            </div>
          </div>

          <div className="form-row">
            <input className="input" type="number" placeholder="Années d'expérience" value={form.annee_experience || ''} onChange={e=>setField('annee_experience',e.target.value)} />
            <input className="input" type="number" placeholder="N1 (Supérieur hiérarchique)" value={form.n1 || ''} onChange={e=>setField('n1',e.target.value)} />
          </div>
          <div className="form-row">
            <input className="input" placeholder="Email" value={form.email} onChange={e=>setField('email',e.target.value)} />
          </div>
          <div className="form-row">
            <input className="input" placeholder="Diplôme" list="diplome-options" value={form.diplome} onChange={e=>setField('diplome',e.target.value)} />
            <datalist id="diplome-options">
              {options.diplome.map(v=><option key={v} value={v} />)}
            </datalist>
          </div>
          <div className="form-row">
            <input className="input" placeholder="Département" list="departement-options" value={form.departement} onChange={e=>setField('departement',e.target.value)} />
            <datalist id="departement-options">
              {options.departement.map(v=><option key={v} value={v} />)}
            </datalist>
            <input className="input" placeholder="Fonction" list="fonction-options" value={form.fonction} onChange={e=>setField('fonction',e.target.value)} required />
            <datalist id="fonction-options">
              {options.fonction.map(v=><option key={v} value={v} />)}
            </datalist>
          </div>
          <div className="small" style={{marginTop:'-4px', color:'#64748b'}}>
            Fonction: selection obligatoire depuis la liste d'autocompletion.
          </div>
          <div className="form-row">
            <input className="input" placeholder="Entité" list="entite-options" value={form.entite} onChange={e=>setField('entite',e.target.value)} />
            <datalist id="entite-options">
              {options.entite.map(v=><option key={v} value={v} />)}
            </datalist>
            <input className="input" placeholder="Direction" list="direction-options" value={form.direction} onChange={e=>setField('direction',e.target.value)} />
            <datalist id="direction-options">
              {options.direction.map(v=><option key={v} value={v} />)}
            </datalist>
            <input className="input" placeholder="Rôle" list="role-options" value={form.role} onChange={e=>setField('role',e.target.value)} />
            <datalist id="role-options">
              {options.roles.map(v=><option key={v} value={v} />)}
            </datalist>
          </div>
          <div className="form-row">
            <select className="input" value={form.statut_employe || 'ACTIF'} onChange={e=>setField('statut_employe',e.target.value)}>
              <option value="ACTIF">Actif</option>
              <option value="CONGEDIE">Congedié</option>
              <option value="SUSPENDU">Suspendu</option>
            </select>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',gap:12}}>
            <div className="small">{err}</div>
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
