/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { defineConfig, type Plugin } from 'vite'

/**
 * 오프라인 지원 (PRD F20): 빌드 산출물 전체를 미리 캐시하는 서비스 워커를 만든다.
 * 외부 의존성 없이, 번들 파일 목록과 그 해시를 sw.js에 넣는다.
 */
function offlineServiceWorker(): Plugin {
  return {
    name: 'offline-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'))
      const precache = ['./', './index.html', './favicon.svg', './manifest.webmanifest', ...files.filter((f) => f !== 'index.html').map((f) => `./${f}`)]
      const version = createHash('sha256').update(files.sort().join('|')).digest('hex').slice(0, 12)
      const source = `// 자동 생성 파일 — vite.config.ts의 offlineServiceWorker 참고
const CACHE = 'interval-lab-${version}'
const PRECACHE = ${JSON.stringify(precache)}

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('interval-lab-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  if (req.mode === 'navigate') {
    // 페이지: 네트워크 우선, 실패하면 캐시한 index.html
    e.respondWith(fetch(req).catch(() => caches.match('./index.html', { ignoreSearch: true, ignoreVary: true })))
    return
  }
  // 정적 파일(해시 이름): 캐시 우선. crossorigin 스크립트는 Origin 헤더가 붙어
  // 'Vary: Origin' 응답과 어긋나므로 ignoreVary로 맞춘다
  e.respondWith(
    caches.match(req, { ignoreSearch: true, ignoreVary: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        }),
    ),
  )
})
`
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

// 정적 호스팅(GitHub Pages 하위 경로 포함)을 위해 상대 경로로 빌드한다.
export default defineConfig({
  base: './',
  plugins: [react(), offlineServiceWorker()],
  // Vitest는 단위 테스트만, Playwright(e2e/)는 따로 돌린다
  test: { exclude: ['e2e/**', 'node_modules/**', 'dist/**'] },
})
