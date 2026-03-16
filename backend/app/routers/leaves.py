from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from .. import crud, models
from datetime import datetime
import os

router = APIRouter(prefix='/leaves', tags=['leaves'])


@router.get('/')
def list_leaves(db: Session = Depends(get_db)):
    return db.query(models.Conge).all()


@router.post('/')
def create_leave(matricule: str = Form(...), date_debut: str = Form(...), date_fin: str = Form(...), type: str = Form(...), justification: str = Form(None), preuve: UploadFile | None = File(None), db: Session = Depends(get_db)):
    # basic parsing
    d0 = datetime.fromisoformat(date_debut).date()
    d1 = datetime.fromisoformat(date_fin).date()
    data = { 'matricule': matricule, 'date_debut': d0, 'date_fin': d1, 'type': type, 'justification': justification }
    if preuve:
        upath = os.path.join('uploads', preuve.filename)
        os.makedirs('uploads', exist_ok=True)
        with open(upath, 'wb') as f:
            f.write(proof := preuve.file.read())
        data['preuve'] = upath
    c = crud.create_conge(db, data)
    return c


@router.post('/{id}/action')
def action_on_leave(id: int, actor: str = Form(...), action: str = Form(...), comment: str = Form(None), db: Session = Depends(get_db)):
    c, err = crud.advance_conge(db, id, actor, action, comment)
    if err:
        raise HTTPException(status_code=400, detail=err)
    return c
