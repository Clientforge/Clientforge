/**
 * Load Instagram embed.js when testimonials scroll into view (avoids blocking initial paint).
 */
(function () {
  var section = document.querySelector('.testimonials-section');
  if (!section) return;

  var loaded = false;

  function loadEmbeds() {
    if (loaded) return;
    loaded = true;
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.instagram.com/embed.js';
    script.onload = function () {
      if (window.instgrm && window.instgrm.Embeds) {
        window.instgrm.Embeds.process();
      }
    };
    document.body.appendChild(script);
  }

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        if (entries.some(function (e) { return e.isIntersecting; })) {
          loadEmbeds();
          observer.disconnect();
        }
      },
      { rootMargin: '240px' },
    );
    observer.observe(section);
  } else {
    loadEmbeds();
  }
})();