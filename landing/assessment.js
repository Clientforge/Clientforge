(function () {
  var form = document.getElementById('assessment-form');
  var errorEl = document.getElementById('form-error');
  var submitBtn = document.getElementById('submit-btn');
  var stickyCta = document.getElementById('sticky-cta');
  var nav = document.querySelector('.assess-nav');
  var toggle = document.querySelector('.assess-nav-toggle');

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.add('visible');
  }

  function clearError() {
    errorEl.textContent = '';
    errorEl.classList.remove('visible');
  }

  function captureUtmParams() {
    var params = new URLSearchParams(window.location.search);
    var fields = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
    fields.forEach(function (key) {
      var el = document.getElementById(key);
      if (el) el.value = params.get(key) || '';
    });
    var refEl = document.getElementById('referrer');
    if (refEl) refEl.value = document.referrer || '';
  }

  captureUtmParams();

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('nav-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  if (stickyCta) {
    var hero = document.querySelector('.assess-hero');
    if (hero && 'IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          stickyCta.classList.toggle('visible', !entry.isIntersecting);
        });
      }, { threshold: 0 });
      observer.observe(hero);
    }
  }

  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearError();

    var payload = {
      practiceName: document.getElementById('practiceName').value.trim(),
      website: document.getElementById('website').value.trim(),
      patientCountRange: document.getElementById('patientCountRange').value,
      followUpProcess: document.getElementById('followUpProcess').value,
      growthChallenge: document.getElementById('growthChallenge').value.trim(),
      firstName: document.getElementById('firstName').value.trim(),
      lastName: document.getElementById('lastName').value.trim(),
      email: document.getElementById('email').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      utmSource: document.getElementById('utm_source').value,
      utmMedium: document.getElementById('utm_medium').value,
      utmCampaign: document.getElementById('utm_campaign').value,
      utmContent: document.getElementById('utm_content').value,
      referrer: document.getElementById('referrer').value,
    };

    if (!payload.practiceName) { showError('Practice name is required.'); return; }
    if (!payload.firstName) { showError('First name is required.'); return; }
    if (!payload.lastName) { showError('Last name is required.'); return; }
    if (!payload.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      showError('Enter a valid work email address.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';

    fetch('/api/v1/public/revenue-assessment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || 'Something went wrong.');
          window.location.href = '/assessment/thanks';
        });
      })
      .catch(function (err) {
        showError(err.message || 'Could not submit. Please try again.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Get My Free Revenue Recovery Assessment &rarr;';
      });
  });
})();
