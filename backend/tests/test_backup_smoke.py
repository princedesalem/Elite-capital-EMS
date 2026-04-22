"""Smoke tests pour les scripts de backup PowerShell.

Tests statiques (grep textuel) car PowerShell n'est pas disponible dans le
conteneur linux backend-test. Si le répertoire racine du dépôt n'est pas
accessible (ex. backend/ monté isolément), les tests sont ignorés.
"""
from pathlib import Path
import pytest

# Dans le conteneur docker (backend monté seul à /app) les .ps1 sont introuvables.
# En local (pytest direct depuis extranet/) ils sont à parents[2].
_candidates = [
    Path(__file__).resolve().parents[2],  # extranet/ si backend/ est un sous-dossier
    Path('/workspace/extranet'),           # conteneur alternatif
]
REPO_ROOT = next((c for c in _candidates if (c / 'backup-db.ps1').exists()), None)
pytestmark = pytest.mark.skipif(
    REPO_ROOT is None,
    reason="backup-db.ps1 introuvable (probablement exécuté dans le conteneur où seul backend/ est monté)",
)


def test_backup_script_existe_et_contient_mysqldump():
    content = (REPO_ROOT / 'backup-db.ps1').read_text(encoding='utf-8', errors='replace')
    assert 'mysqldump' in content, "le script doit invoquer mysqldump"
    assert '--single-transaction' in content, "mysqldump doit utiliser --single-transaction"
    assert 'KeepLast' in content, "le script doit supporter la rotation -KeepLast"


def test_backup_script_a_log_et_rotation():
    content = (REPO_ROOT / 'backup-db.ps1').read_text(encoding='utf-8', errors='replace')
    assert 'backup.log' in content, "log fichier attendu"
    assert 'Sort-Object LastWriteTime' in content, "rotation par date attendue"
    assert 'Compress-Archive' in content, "compression optionnelle attendue"


def test_register_task_script_contient_register_scheduledtask():
    content = (REPO_ROOT / 'register-backup-task.ps1').read_text(encoding='utf-8', errors='replace')
    assert 'Register-ScheduledTask' in content
    assert 'Unregister-ScheduledTask' in content, "un switch -Unregister doit être présent"
    assert '-Daily' in content or '-At' in content, "trigger quotidien attendu"
