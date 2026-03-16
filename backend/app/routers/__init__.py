"""
Routers package - Initialize all API routers
"""
from . import (
    auth,
    organisation,
    employees,
    leaves,
    roles,
    dashboard,
    operations,
    conges,
    permissions_router,
    missions_router,
    remplacants_router,
    notifications_router,
    evaluations_router,
    workflow_router,
    commentaires_mission_router
)

__all__ = [
    'auth',
    'organisation',
    'employees',
    'leaves',
    'roles',
    'dashboard',
    'operations',
    'conges',
    'permissions_router',
    'missions_router',
    'remplacants_router',
    'notifications_router',
    'evaluations_router',
    'workflow_router'
]
