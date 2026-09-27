'use strict';
(() => {
  const status = document.getElementById('pwaStatus');
  const updateButton = document.getElementById('pwaUpdate');
  let registration, ready = false, applying = false;
  const showStatus = () => {
    status.textContent = ready
      ? (navigator.onLine ? '오프라인 계산 준비 완료' : '오프라인 · 수동 계산 가능')
      : '오프라인 파일 준비 중…';
  };
  if (!('serviceWorker' in navigator) || !window.isSecureContext || location.protocol === 'file:') {
    status.textContent = 'PWA 설치는 HTTPS 주소에서 열어 주세요.';
    return;
  }
  const watchUpdate = reg => {
    if (reg.waiting && navigator.serviceWorker.controller) updateButton.hidden = false;
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) updateButton.hidden = false;
      });
    });
  };
  updateButton.addEventListener('click', () => {
    if (!registration?.waiting) return;
    applying = true;
    updateButton.disabled = true;
    updateButton.textContent = '업데이트 적용 중…';
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (applying) location.reload();
  });
  navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' })
    .then(reg => {
      registration = reg;
      watchUpdate(reg);
      return navigator.serviceWorker.ready;
    })
    .then(() => { ready = true; showStatus(); })
    .catch(() => { status.textContent = '오프라인 준비 실패 · 온라인에서 다시 열어 주세요.'; });
  window.addEventListener('online', showStatus);
  window.addEventListener('offline', showStatus);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && registration && navigator.onLine) registration.update().catch(() => {});
  });
})();
