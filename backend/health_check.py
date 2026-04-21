import urllib.request, urllib.error, json, sys

BACKEND  = "http://localhost:8000"
FRONTEND = "http://frontend:5173"

results = []

def check(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    print(f"  {status}  {name}{(' -> ' + detail) if detail else ''}")
    results.append(ok)

# 1. Backend GET /
try:
    r = urllib.request.urlopen(BACKEND + "/", timeout=5)
    data = json.loads(r.read())
    check("Backend GET /", data.get("message") == "Backend running", str(data))
except Exception as e:
    check("Backend GET /", False, str(e))

# 2. Backend GET /health
try:
    r = urllib.request.urlopen(BACKEND + "/health", timeout=5)
    data = json.loads(r.read())
    check("Backend GET /health", data.get("status") == "ok", str(data))
except Exception as e:
    check("Backend GET /health", False, str(e))

# 3. Backend POST /auth/login
try:
    req = urllib.request.Request(
        BACKEND + "/auth/login",
        data=b"{}",
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    r = urllib.request.urlopen(req, timeout=5)
    code = r.getcode()
except urllib.error.HTTPError as e:
    code = e.code
except Exception as e:
    code = 0
check("Backend POST /auth/login (200/401/422)", code in (200, 401, 422), f"HTTP {code}")

# 4. Frontend (via service name in Docker network)
# Vite dev server repond 403 si Host != localhost (securite Vite 5) — tout code != timeout = serveur actif
try:
    r = urllib.request.urlopen(FRONTEND, timeout=5)
    code = r.getcode()
except urllib.error.HTTPError as e:
    code = e.code
except Exception as e:
    code = 0
check("Frontend repond (serveur actif)", code != 0, f"HTTP {code} ({'OK' if code == 200 else 'Vite host-check = serveur OK' if code == 403 else 'ERREUR'})")

# Summary
passed = sum(results)
total = len(results)
print(f"\n{passed}/{total} checks PASSES")
if passed < total:
    sys.exit(1)
