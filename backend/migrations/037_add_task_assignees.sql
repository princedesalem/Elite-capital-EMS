-- Migration 037: Table TASK_ASSIGNEE pour support multi-assignees sur les tâches
-- Permet d'assigner une tâche à plusieurs employés simultanément

CREATE TABLE IF NOT EXISTS TASK_ASSIGNEE (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    id_task       INT NOT NULL,
    matricule_employe INT NOT NULL,
    UNIQUE KEY uq_task_employe (id_task, matricule_employe),
    CONSTRAINT fk_task_assignee_task FOREIGN KEY (id_task) REFERENCES TASK(id_task) ON DELETE CASCADE,
    CONSTRAINT fk_task_assignee_employe FOREIGN KEY (matricule_employe) REFERENCES EMPLOYE(matricule) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migrer les assignations existantes dans la nouvelle table
INSERT IGNORE INTO TASK_ASSIGNEE (id_task, matricule_employe)
SELECT id_task, assigne_a FROM TASK WHERE assigne_a IS NOT NULL;
