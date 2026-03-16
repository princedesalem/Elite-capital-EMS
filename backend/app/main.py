from fastapi import FastAPI
from .db import Base, engine
from .routers import (
    auth, organisation, employees, leaves, roles, dashboard, operations,
    conges, permissions_router, missions_router, remplacants_router,
    notifications_router, evaluations_router, workflow_router,
    commentaires_mission_router, sorties_router,
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
app = FastAPI(title="Extranet ELITE CAPITAL - Backend")

# Add CORS middleware FIRST, before audit middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://elitecapitalems.netlify.app",
        "https://69b81a2f94cfe526a986b71e--elitecapitalems.netlify.app",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Middleware global CORS (force header sur toutes les réponses)
@app.middleware('http')
async def global_cors_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = '*'
    response.headers['Access-Control-Allow-Headers'] = '*'
    return response

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

# Configurer le scheduler pour les tâches automatiques
@app.on_event("startup")
async def startup_event():
    """Démarrer le scheduler pour les tâches automatiques"""
    try:
        from .scheduler import configurer_scheduler
        scheduler = configurer_scheduler()
        logging.info("Scheduler configuré et démarré avec succès")
    except Exception as e:
        logging.error(f"Erreur lors de la configuration du scheduler: {e}")

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


@app.get('/')
def root():
    return {"message": "Backend running"}
