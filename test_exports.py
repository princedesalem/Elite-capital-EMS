import urllib.request, urllib.parse, json

# Login
data = urllib.parse.urlencode({'matricule': '9999', 'password': 'ChangeMe123!@#'}).encode()
req = urllib.request.Request('http://localhost:8000/auth/login', data=data, method='POST')
resp = urllib.request.urlopen(req)
token = json.loads(resp.read())['access_token']
print('Login OK')

# Test export-excel (global RH)
req2 = urllib.request.Request(
    'http://localhost:8000/api/analytics/export-excel',
    headers={'Authorization': f'Bearer {token}'}
)
try:
    resp2 = urllib.request.urlopen(req2)
    body = resp2.read()
    ct = resp2.headers.get('Content-Type', '')
    print(f'export-excel: {resp2.status} OK, {len(body)} bytes, content-type: {ct}')
except urllib.error.HTTPError as e:
    print(f'export-excel: {e.code} {e.reason}')
    print(e.read().decode()[:800])

# Test export-dashboard/9999
req3 = urllib.request.Request(
    'http://localhost:8000/api/analytics/export-dashboard/9999',
    headers={'Authorization': f'Bearer {token}'}
)
try:
    resp3 = urllib.request.urlopen(req3)
    body3 = resp3.read()
    print(f'export-dashboard/9999: {resp3.status} OK, {len(body3)} bytes')
except urllib.error.HTTPError as e:
    print(f'export-dashboard/9999: {e.code} {e.reason}')
    print(e.read().decode()[:800])
