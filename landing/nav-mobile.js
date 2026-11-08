(function () {
  var nav = document.querySelector('.navbar');
  var toggle = document.querySelector('.mobile-toggle');
  if (!nav || !toggle) return;

  function setMenuOpen(open) {
    nav.classList.toggle('nav-open', open);
    document.body.classList.toggle('nav-menu-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  toggle.setAttribute('aria-expanded', 'false');

  toggle.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(!nav.classList.contains('nav-open'));
  });

  nav.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () {
      setMenuOpen(false);
    });
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && nav.classList.contains('nav-open')) {
      setMenuOpen(false);
    }
  });
})();
