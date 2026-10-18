(() => {
  const destination = '/dashboard/overview';
  const started = Date.now();
  const status = document.querySelector('.loading-card .muted');
  const minVisibleMs = 850;
  const go = () => window.location.replace(destination);
  window.addEventListener('load', () => {
    const remaining = Math.max(0, minVisibleMs - (Date.now() - started));
    window.setTimeout(go, remaining);
  }, { once: true });
  window.setTimeout(() => { if (status) status.textContent = 'يتم فتح لوحة التحكم…'; }, 350);
  window.setTimeout(go, 3500);
})();
