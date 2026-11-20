"""
Impostazioni del programma Ruolino.

Tutti i dati sensibili (database, chiave segreta, backup, file Excel importati)
stanno nella cartella ``dati/`` che NON viene mai caricata sul repository.
"""
import os
import secrets
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Cartella dei dati locali (esclusa da git). Si puo' spostare con la variabile
# d'ambiente RUOLINO_DATI, ad esempio su un disco di rete o su una cartella protetta.
DATI_DIR = Path(os.environ.get("RUOLINO_DATI", BASE_DIR / "dati"))
DATI_DIR.mkdir(parents=True, exist_ok=True)
BACKUP_DIR = DATI_DIR / "backup"


def _chiave_segreta():
    """Legge (o genera al primo avvio) la chiave segreta locale."""
    file_chiave = DATI_DIR / "secret_key.txt"
    if not file_chiave.exists():
        file_chiave.write_text(secrets.token_urlsafe(50), encoding="utf-8")
    return file_chiave.read_text(encoding="utf-8").strip()


SECRET_KEY = os.environ.get("RUOLINO_SECRET_KEY") or _chiave_segreta()

# In uso normale il debug e' spento. Per sviluppo: RUOLINO_DEBUG=1
DEBUG = os.environ.get("RUOLINO_DEBUG") == "1"

# Il programma gira solo su rete interna: per default accetta qualunque nome
# host. Si puo' restringere con RUOLINO_HOSTS="pc-ufficio,192.168.1.10"
ALLOWED_HOSTS = [
    h.strip() for h in os.environ.get("RUOLINO_HOSTS", "*").split(",") if h.strip()
]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "personale",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "ruolino.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "ruolino.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": DATI_DIR / "ruolino.sqlite3",
        "OPTIONS": {
            # Piu' utenti contemporanei: attende invece di dare subito errore
            "timeout": 20,
            "init_command": "PRAGMA journal_mode=WAL;",
        },
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "it"
TIME_ZONE = "Europe/Rome"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = DATI_DIR / "static"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}
WHITENOISE_USE_FINDERS = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LOGIN_URL = "login"
LOGIN_REDIRECT_URL = "home"
LOGOUT_REDIRECT_URL = "login"

# Sessione: si chiude dopo 8 ore o alla chiusura del browser
SESSION_COOKIE_AGE = 8 * 60 * 60
SESSION_EXPIRE_AT_BROWSER_CLOSE = True
