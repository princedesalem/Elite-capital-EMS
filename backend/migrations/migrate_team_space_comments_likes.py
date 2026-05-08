"""
Idempotent migration: create team_space_post_like and team_space_comment tables.
Run:  python migrations/migrate_team_space_comments_likes.py
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import text
from app.db import engine


def run():
    with engine.connect() as conn:
        # --- team_space_post_like ---
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS team_space_post_like (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                post_id     INT NOT NULL,
                matricule   VARCHAR(32) NOT NULL,
                created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_like_post_user UNIQUE (post_id, matricule),
                CONSTRAINT fk_like_post FOREIGN KEY (post_id)
                    REFERENCES TEAM_SPACE_POST(id_post) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """))

        # --- team_space_comment ---
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS team_space_comment (
                id                INT AUTO_INCREMENT PRIMARY KEY,
                post_id           INT NOT NULL,
                parent_id         INT NULL,
                auteur_matricule  VARCHAR(32) NULL,
                auteur_nom        VARCHAR(150) NOT NULL,
                contenu           TEXT NOT NULL,
                created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_comment_post FOREIGN KEY (post_id)
                    REFERENCES TEAM_SPACE_POST(id_post) ON DELETE CASCADE,
                CONSTRAINT fk_comment_parent FOREIGN KEY (parent_id)
                    REFERENCES team_space_comment(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """))

        conn.commit()
    print("Migration terminée : team_space_post_like + team_space_comment créées (ou déjà existantes).")


if __name__ == '__main__':
    run()
