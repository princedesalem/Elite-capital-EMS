"""Helpers de formatage pour les exports (PDF, Excel, ...)."""
from decimal import Decimal


NBSP = '\u00a0'  # espace insécable (séparateur milliers)


def fmt_fcfa(value) -> str:
    """Formate un montant en franc CFA : ``20 000 000 FCFA``.

    - Séparateur de milliers : espace insécable.
    - Aucune décimale (arrondi à l'entier le plus proche).
    - Valeurs nulles ou invalides → ``"0 FCFA"``.
    """
    if value is None:
        return f"0{NBSP}FCFA"
    try:
        number = Decimal(str(value))
    except Exception:
        return f"0{NBSP}FCFA"
    sign = '-' if number < 0 else ''
    number = abs(number)
    # Arrondi standard (ROUND_HALF_EVEN) sur 0 décimale
    rounded = int(number.to_integral_value())
    formatted = f"{rounded:,}".replace(',', NBSP)
    return f"{sign}{formatted}{NBSP}FCFA"
