/* Product pages only need the shared navigation behaviour. */
(() => {
  const nav = document.querySelector('#nav');
  const button = nav.querySelector('.nav__burger');
  const close = () => {
    nav.classList.remove('is-open');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', 'Open menu');
  };
  button.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  nav.querySelectorAll('.nav__links a').forEach(link => link.addEventListener('click', close));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) {
      close();
      button.focus();
    }
  });
  const update = () => nav.classList.toggle('is-scrolled', scrollY > 40);
  addEventListener('scroll', update, { passive: true });
  update();
})();
