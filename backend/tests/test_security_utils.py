"""
Tests pour app/utils/security.py
(hash_password, verify_password, JWT, MFA, validate_password_policy)
"""
import pytest
import time
from app.utils.security import (
    hash_password,
    verify_password,
    create_access_token,
    verify_token,
    generate_mfa_secret,
    verify_totp,
    validate_password_policy,
)


# ── Passwords ─────────────────────────────────────────────────────────────────

def test_hash_password_returns_string():
    h = hash_password('MyPassword1!')
    assert isinstance(h, str)
    assert h != 'MyPassword1!'


def test_verify_password_correct():
    h = hash_password('TestPass14!')
    assert verify_password('TestPass14!', h) is True


def test_verify_password_wrong():
    h = hash_password('TestPass14!')
    assert verify_password('WrongPass14!', h) is False


def test_verify_password_empty_returns_false():
    h = hash_password('TestPass14!')
    assert verify_password('', h) is False


def test_verify_password_bad_hash_returns_false():
    assert verify_password('anything', 'not-a-hash') is False


# ── JWT ───────────────────────────────────────────────────────────────────────

def test_create_and_verify_token():
    token = create_access_token({'matricule': 1001, 'role': 'RH'})
    payload = verify_token(token)
    assert payload is not None
    assert payload['matricule'] == 1001
    assert payload['role'] == 'RH'


def test_verify_token_invalid_returns_none():
    assert verify_token('not.a.token') is None


def test_verify_token_empty_returns_none():
    assert verify_token('') is None


def test_token_expiry():
    token = create_access_token({'sub': 'test'}, expires_minutes=-1)
    assert verify_token(token) is None


# ── MFA / TOTP ────────────────────────────────────────────────────────────────

def test_generate_mfa_secret_not_empty():
    secret = generate_mfa_secret()
    assert isinstance(secret, str)
    assert len(secret) > 0


def test_verify_totp_valid_code():
    import pyotp
    secret = generate_mfa_secret()
    code = pyotp.TOTP(secret).now()
    assert verify_totp(secret, code) is True


def test_verify_totp_wrong_code():
    secret = generate_mfa_secret()
    assert verify_totp(secret, '000000') is False


def test_verify_totp_empty_inputs():
    assert verify_totp('', '123456') is False
    assert verify_totp('SECRET', '') is False


# ── Password policy ───────────────────────────────────────────────────────────

@pytest.mark.parametrize('pw,expected_ok', [
    ('Short1!', False),                          # trop court
    ('alllowercaselong14!', False),              # pas de majuscule
    ('ALLUPPERCASELONG14!', False),              # pas de minuscule
    ('NoDigitsHereXXXX!', False),               # pas de chiffre
    ('NoSpecialChar1234AA', False),              # pas de spécial
    ('ValidPass14!Secure', True),               # valide
    ('Another#GoodPass1x', True),               # valide
])
def test_password_policy(pw, expected_ok):
    ok, msg = validate_password_policy(pw)
    assert ok == expected_ok


def test_password_policy_empty():
    ok, msg = validate_password_policy('')
    assert ok is False
    assert '14' in msg
