(function () {
  var nav = document.querySelector('.navbar');
  var toggle = document.querySelector('.mobile-toggle');
  if (!nav || !toggle) return;

  toggle.setAttribute('aria-expanded', 'false');

  toggle.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    var open = nav.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  nav.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () {
      nav.classList.remove('nav-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });

  document.addEventListener('click', function (ev) {
    if (!nav.classList.contains('nav-open')) return;
    if (nav.contains(ev.target)) return;
    nav.classList.remove('nav-open');
    toggle.setAttribute('aria-expanded', 'false');
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && nav.classList.contains('nav-open')) {
      nav.classList.remove('nav-open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
})();
