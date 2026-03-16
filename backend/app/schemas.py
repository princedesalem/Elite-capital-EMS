from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime


class RoleOut(BaseModel):
    id: int
    name: str
    description: Optional[str]

    class Config:
        from_attributes = True


class EmployeBase(BaseModel):
    matricule: int | str
    nom: str
    prenom: str
    date_naissance: Optional[date] = None
    sexe: Optional[str] = None
    telephone: Optional[str] = None
    email: Optional[str] = None
    departement: Optional[str] = None
    fonction: Optional[str] = None
    ville: Optional[str] = None
    contact_urgence: Optional[str] = None
    diplome: Optional[str] = None
    solde_conges: Optional[int] = 0
    date_embauche: Optional[date] = None
    entite: Optional[str] = None
    role: Optional[str] = None
    annee_experience: Optional[int] = None
    categorie: Optional[str] = None
    direction: Optional[str] = None
    anciennete: Optional[str] = None
    n1: Optional[int | str] = None


class EmployeOut(EmployeBase):
    class Config:
        from_attributes = True


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

    class Config:
        from_attributes = True

class PaysCreate(BaseModel):
    nom_pays: str
    code_pays: str


class VilleCreate(BaseModel):
    nom: str
    id_pays: int


class FonctionReferenceCreate(BaseModel):
    libelle: str = Field(min_length=2, max_length=200)