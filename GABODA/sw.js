/* 서비스 워커: 앱 파일을 폰에 저장해 두고 인터넷 없이도 실행되게 함 */
const CACHE = 'ks-v1';   // 앱 파일 목록(SHELL)이 바뀌었을 때만 숫자를 올리세요
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png', 'icons/favicon-32.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 저장된 파일을 먼저 보여 주고, 뒤에서 새 버전을 받아 저장해 둠 → 다음 실행부터 새 버전
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    const update = fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    });
    if (hit) { e.waitUntil(update.catch(() => {})); return hit; }
    try { return await update; }
    catch (err) {   // 오프라인이고 저장된 파일도 없으면 앱 첫 화면으로
      if (req.mode === 'navigate') return (await cache.match('index.html')) || (await cache.match('./'));
      throw err;
    }
  })());
});
