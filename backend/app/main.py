"""
Point d'entrée principal du backend FastAPI d'Extranet ELITE CAPITAL.

Configure :
- Le lifespan (scheduler APScheduler au démarrage)
- Le middleware CORS (liste blanche contrôlée par CORS_ALLOW_ORIGINS)
- Un middleware d'audit qui journalise les appels réussis dans audit.log
- Toutes les routes en les incluant depuis les modules routers/*
"""
from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from .db import Base, engine
from .routers import (
    auth, organisation, employees, leaves, roles, dashboard, operations,
    conges, permissions_router, missions_router, remplacants_router,
    notifications_router, evaluations_router, workflow_router, tasks_router,
    commentaires_mission_router, sorties_router, team_space_router, module_store_router,
    events_router, reviews360_router, talent_router, workforce_router, clubs_router,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
from . import models
from .db import SessionLocal
from .utils import security
import logging
import json

# configure file audit logger
audit_logger = logging.getLogger('audit')
audit_logger.setLevel(logging.INFO)
fh = logging.FileHandler('audit.log')
fh.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s %(message)s')
fh.setFormatter(formatter)
if not audit_logger.handlers:
    audit_logger.addHandler(fh)
@asynccontextmanager
async def lifespan(_: FastAPI):
    """Configure startup jobs using lifespan to avoid deprecated startup events."""
    if not os.getenv('TESTING'):
        # Auto-migrations : applique les fichiers SQL manquants avant tout
        try:
            from .utils.auto_migrate import run_migrations
            run_migrations(engine)
        except Exception as e:
            logging.error(f"Erreur auto_migrate au démarrage: {e}")
        # Scheduler
        try:
            from .scheduler import configurer_scheduler

            configurer_scheduler()
            logging.info("Scheduler configuré et démarré avec succès")
        except Exception as e:
            logging.error(f"Erreur lors de la configuration du scheduler: {e}")
    yield


app = FastAPI(title="Extranet ELITE CAPITAL - Backend", lifespan=lifespan)

default_origins = [
    "https://elitecapitalems.netlify.app",
    "https://69b81a2f94cfe526a986b71e--elitecapitalems.netlify.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
configured_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOW_ORIGINS", "").split(",")
    if origin.strip()
]
allow_origins = configured_origins or default_origins

# Add CORS middleware FIRST, before other middlewares.
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Audit middleware (après CORS)
@app.middleware('http')
async def audit_middleware(request: Request, call_next):
    resp = await call_next(request)
    try:
        db = SessionLocal()
        actor = None
        auth = request.headers.get('authorization')
        if auth and auth.lower().startswith('bearer '):
            token = auth.split(None,1)[1]
            try:
                payload = security.jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
                actor = payload.get('matricule')
            except Exception:
                pass
        action = f"{request.method} {request.url.path}"
        ip = request.client.host if request.client else None
        audit_logger.info(json.dumps({"actor": actor, "action": action, "ip": ip}))
        try:
            db.add(models.AuditLog(actor=actor, action=action, entity='request', entity_id=None, detail=None, ip=ip, request_body=None))
            db.commit()
        except:
            pass
        finally:
            db.close()
    except Exception:
        pass
    return resp


Base.metadata.create_all(bind=engine)

from fastapi.staticfiles import StaticFiles
os.makedirs('/app/uploads', exist_ok=True)
app.mount('/uploads', StaticFiles(directory='/app/uploads'), name='uploads')

# Routers existants
app.include_router(auth.router)
app.include_router(organisation.router)  # Include organisation router first (specific routes before generic /{matricule})
app.include_router(employees.router)
app.include_router(leaves.router)
app.include_router(roles.router)
app.include_router(dashboard.router)
app.include_router(operations.router)

# Nouveaux routers
app.include_router(conges.router)
app.include_router(permissions_router.router)
app.include_router(missions_router.router)
app.include_router(remplacants_router.router)
app.include_router(notifications_router.router)
app.include_router(evaluations_router.router)
app.include_router(workflow_router.router)
app.include_router(commentaires_mission_router.router)
app.include_router(sorties_router.router)
app.include_router(tasks_router.router)
app.include_router(team_space_router.router)
app.include_router(module_store_router.router)
app.include_router(events_router.router)
app.include_router(reviews360_router.router)
app.include_router(talent_router.router)
app.include_router(workforce_router.router)
app.include_router(clubs_router.router)


@app.get('/')
def root():
    return {"message": "Backend running"}
