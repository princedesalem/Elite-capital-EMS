/**
 * Health check script — vérifie que le site est opérationnel.
 * Usage: node health-check.js [FRONTEND_URL] [BACKEND_URL]
 */
const http = require('http')
const https = require('https')

const FRONTEND = process.env.FRONTEND_URL || process.argv[2] || 'http://frontend:5173'
const BACKEND  = process.env.BACKEND_URL  || process.argv[3] || 'http://backend:8000'

let passed = 0
let failed = 0

function fetch(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    const req = lib.get(url, { timeout: 8000 }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
  })
}

function post(url, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload)
    const parsed = new URL(url)
    const options = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      method: 'POST',
      timeout: 8000,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }
    const lib = url.startsWith('https') ? https : http
    const req = lib.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.write(body)
    req.end()
  })
}

async function check(name, fn) {
  process.stdout.write(`  ${name} ... `)
  try {
    await fn()
    console.log('\x1b[32m✓ PASS\x1b[0m')
    passed++
  } catch (err) {
    console.log(`\x1b[31m✗ FAIL — ${err.message}\x1b[0m`)
    failed++
  }
}

;(async () => {
  console.log('\n\x1b[1mHealth checks — site running\x1b[0m')
  console.log(`  Frontend : ${FRONTEND}`)
  console.log(`  Backend  : ${BACKEND}\n`)

  await check('Frontend répond HTTP 200', async () => {
    const r = await fetch(FRONTEND)
    if (r.status !== 200) throw new Error(`HTTP ${r.status}`)
  })

  await check('Frontend retourne du HTML', async () => {
    const r = await fetch(FRONTEND)
    if (!r.body.includes('<')) throw new Error('pas de HTML dans la réponse')
  })

  await check('Backend GET / → "Backend running"', async () => {
    const r = await fetch(BACKEND + '/')
    if (r.status !== 200) throw new Error(`HTTP ${r.status}`)
    const json = JSON.parse(r.body)
    if (json.message !== 'Backend running') throw new Error(`message inattendu: ${json.message}`)
  })

  await check('Backend GET /health → status ok', async () => {
    const r = await fetch(BACKEND + '/health')
    if (r.status !== 200) throw new Error(`HTTP ${r.status}`)
    const json = JSON.parse(r.body)
    if (json.status !== 'ok') throw new Error(`status inattendu: ${json.status}`)
  })

  await check('Backend POST /auth/login → endpoint présent (200/401/422)', async () => {
    const r = await post(BACKEND + '/auth/login', {})
    if (![200, 401, 422].includes(r.status)) throw new Error(`HTTP ${r.status} inattendu`)
  })

  const total = passed + failed
  console.log(`\n\x1b[1m${passed}/${total} checks passed\x1b[0m`)
  if (failed > 0) {
    console.log(`\x1b[31m${failed} check(s) échoué(s)\x1b[0m`)
    process.exit(1)
  }
})()
