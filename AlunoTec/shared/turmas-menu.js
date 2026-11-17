document.addEventListener('DOMContentLoaded', () => {
  const button = document.getElementById('turmasMenuButton');
  const sidebar = document.querySelector('.sidebar');
  if (!button || !sidebar) return;
  const setOpen = (open) => {
    document.body.classList.toggle('alunotec-menu-open', open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  };
  button.addEventListener('click', () => setOpen(!document.body.classList.contains('alunotec-menu-open')));
  document.addEventListener('click', (event) => {
    if (document.body.classList.contains('alunotec-menu-open') && !sidebar.contains(event.target) && !button.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setOpen(false); });
  sidebar.addEventListener('click', (event) => { if (event.target.closest('a')) setOpen(false); });
  window.addEventListener('resize', () => { if (window.innerWidth > 850) setOpen(false); });
});
