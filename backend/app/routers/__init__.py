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
    tasks_router,
    remplacants_router,
    notifications_router,
    evaluations_router,
    workflow_router,
    commentaires_mission_router,
    team_space_router,
    module_store_router
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
    'tasks_router',
    'remplacants_router',
    'notifications_router',
    'evaluations_router',
    'workflow_router',
    'team_space_router',
    'module_store_router'
]
