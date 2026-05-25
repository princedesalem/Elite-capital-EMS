from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
import pathlib
from dotenv import load_dotenv

# Charge le .env depuis backend/ (fonctionne en Docker et en natif)
_db_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_db_dir, '..', '.env'))

DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///./extranet.db')

# Répertoire uploads portable : UPLOADS_DIR env > backend/uploads/
# En Docker  : /app/uploads  (volume monté)
# En natif   : C:\EMS\backend\uploads
_BACKEND_ROOT = pathlib.Path(__file__).parent.parent  # extranet/backend/
UPLOADS_ROOT = pathlib.Path(os.environ.get('UPLOADS_DIR') or str(_BACKEND_ROOT / 'uploads'))

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if DATABASE_URL.startswith('sqlite') else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
