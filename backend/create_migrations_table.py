import os, sys
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv('.env')
from sqlalchemy import create_engine, text

engine = create_engine(os.environ['DATABASE_URL'])
with engine.connect() as conn:
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS `_migrations_appliquees` (
            `nom` VARCHAR(255) NOT NULL PRIMARY KEY,
            `appliquee_le` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """))
    conn.commit()
    r = conn.execute(text("SHOW TABLES LIKE '_migrations_appliquees'")).fetchall()
    print("Table créée OK:", r)
