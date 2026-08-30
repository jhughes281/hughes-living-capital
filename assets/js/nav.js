/* Mobile navigation toggle.
   Visibility is decided entirely in CSS: the nav is display:none under 900px
   unless the masthead carries data-menu="open", and always visible above it.
   JS only flips that attribute, so nothing can fall out of sync on resize. */
(function () {
  var head = document.querySelector('.masthead');
  var btn = document.querySelector('[data-nav-toggle]');
  var nav = document.querySelector('[data-nav]');
  if (!head || !btn || !nav) return;

  function setOpen(open) {
    if (open) head.setAttribute('data-menu', 'open');
    else head.removeAttribute('data-menu');
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? 'Close' : 'Menu';
  }

  btn.addEventListener('click', function () {
    setOpen(head.getAttribute('data-menu') !== 'open');
  });

  nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && head.getAttribute('data-menu') === 'open') {
      setOpen(false);
      btn.focus();
    }
  });

  setOpen(false);
})();
