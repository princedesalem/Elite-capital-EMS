from datetime import datetime, timedelta
from jose import jwt
import os
import pyotp
import re
import bcrypt

SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret')
ALGORITHM = 'HS256'

def hash_password(password: str) -> str:
    password_bytes = password.encode('utf-8')[:72]
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode('utf-8')

def verify_password(plain: str, hashed: str) -> bool:
    try:
        plain_bytes = plain.encode('utf-8')[:72]
        hashed_bytes = hashed.encode('utf-8')
        return bcrypt.checkpw(plain_bytes, hashed_bytes)
    except Exception:
        return False

def create_access_token(data: dict, expires_minutes: int = 60):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes)
    to_encode.update({"exp": expire})
    encoded = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded


def verify_token(token: str):
    """Decode and verify a JWT token. Returns payload or None if invalid."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except Exception:
        return None


def generate_mfa_secret():
    return pyotp.random_base32()


def verify_totp(secret: str, code: str) -> bool:
    if not secret or not code:
        return False
    try:
        totp = pyotp.TOTP(secret)
        return totp.verify(code, valid_window=1)
    except Exception:
        return False


def validate_password_policy(password: str) -> tuple[bool,str]:
    if not password or len(password) < 14:
        return False, 'Mot de passe: au moins 14 caractères.'
    if not re.search(r'[A-Z]', password):
        return False, 'Doit contenir une majuscule.'
    if not re.search(r'[a-z]', password):
        return False, 'Doit contenir une minuscule.'
    if not re.search(r'\d', password):
        return False, 'Doit contenir un chiffre.'
    if not re.search(r'[!@#$%^&*()_+\-=[\]{};:\"\\|,.<>/?]', password):
        return False, 'Doit contenir un caractère spécial.'
    return True, ''
