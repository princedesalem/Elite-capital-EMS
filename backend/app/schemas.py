from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional
from datetime import date, datetime
import re as _re

_MATRICULE_RE = _re.compile(r'^[A-Za-z0-9-]+$')


def _validate_matricule_value(v):
    if v is None or v == '':
        return v
    s = str(v).strip()
    if not _MATRICULE_RE.match(s):
        raise ValueError("Le matricule doit être alphanumérique (lettres, chiffres et '-')")
    return s.upper()


class RoleOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    model_config = ConfigDict(from_attributes=True)


class EmployeBase(BaseModel):
    matricule: str
    nom: str
    prenom: str
    date_naissance: Optional[date] = None
    sexe: Optional[str] = None
    telephone: Optional[str] = None
    email: Optional[str] = None
    departement: Optional[str] = None
    fonction: Optional[str] = None
    ville: Optional[str] = None
    pays: Optional[str] = None
    id_pays: Optional[int] = None
    id_localisation: Optional[int] = None
    contact_urgence: Optional[str] = None
    diplome: Optional[str] = None
    solde_conges: Optional[int] = 0
    date_embauche: Optional[date] = None
    entite: Optional[str] = None
    role: Optional[str] = None
    annee_experience: Optional[int] = None
    categorie: Optional[str] = None
    statut_matrimonial: Optional[str] = None
    nombre_enfants: Optional[int] = None
    salaire_brut: Optional[float] = None
    salaire_devise: Optional[str] = None
    direction: Optional[str] = None
    anciennete: Optional[str] = None
    n1: Optional[str] = None
    n1_fonction: Optional[str] = None
    statut_employe: Optional[str] = None
    photo_url: Optional[str] = None
    signature_url: Optional[str] = None
    id_entite: Optional[int] = None
    id_direction: Optional[int] = None
    dept_id: Optional[int] = None
    nouvelle_recrue: Optional[bool] = None

    @field_validator('matricule', mode='before')
    @classmethod
    def _validate_matricule(cls, v):
        return _validate_matricule_value(v)

    @field_validator('n1', mode='before')
    @classmethod
    def _validate_n1(cls, v):
        if v is None or v == '':
            return None
        return _validate_matricule_value(v)
    model_config = ConfigDict(from_attributes=True)


class EmployeUpdate(EmployeBase):
    """Schéma pour PUT (mise à jour partielle) — matricule, nom, prénom deviennent optionnels."""
    matricule: Optional[str] = None
    nom: Optional[str] = None
    prenom: Optional[str] = None


class EmployeOut(EmployeBase):
    n1_nom: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class UtilisateurCreate(BaseModel):
    matricule: Optional[str]
    password: str
    email: Optional[str]


class EmailRequest(BaseModel):
    email: str


class Token(BaseModel):
    access_token: str
    token_type: str = 'bearer'


class CongeCreate(BaseModel):
    matricule: str
    date_debut: date
    date_fin: date
    type: str
    justification: Optional[str]

class CongeOut(CongeCreate):
    id_conge: int
    statut: str
    duree: int
    date_demande: datetime
    model_config = ConfigDict(from_attributes=True)

class PaysCreate(BaseModel):
    nom_pays: str
    code_pays: str


class VilleCreate(BaseModel):
    nom: str
    id_pays: int


class FonctionReferenceCreate(BaseModel):
    libelle: str = Field(min_length=2, max_length=200)
    id_direction: Optional[int] = None
    dept_id: Optional[int] = None


class ParcoursEmployeOut(BaseModel):
    id_parcours: int
    matricule: str
    type_action: str
    champ_modifie: Optional[str] = None
    ancienne_valeur: Optional[str] = None
    nouvelle_valeur: Optional[str] = None
    libelle: Optional[str] = None
    actor: Optional[str] = None
    date_action: date
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class RemplacantCommentaireUpdate(BaseModel):
    commentaire: Optional[str] = Field(default=None, max_length=2000)


class OperationVueOut(BaseModel):
    matricule_observateur: str
    nom_observateur: Optional[str] = None
    role_observateur: Optional[str] = None
    date_vue: datetime
    model_config = ConfigDict(from_attributes=True)

