(function () {
  var fmt = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

  function num(id) {
    var el = document.getElementById(id);
    if (!el) return 0;
    var v = parseFloat(String(el.value).replace(/,/g, ''));
    return Number.isFinite(v) ? v : 0;
  }

  function bind(ids, fn) {
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', fn);
        el.addEventListener('change', fn);
      }
    });
    fn();
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  var auto = document.querySelector('[data-calculator="auto-deferred"]');
  if (auto) {
    bind(['calc-deferred-count', 'calc-deferred-avg', 'calc-deferred-pct'], function () {
      var count = num('calc-deferred-count');
      var avg = num('calc-deferred-avg');
      var pct = num('calc-deferred-pct');
      var monthly = count * avg * (pct / 100);
      setText('calc-deferred-result', fmt.format(monthly));
    });
  }

  var reactivate = document.querySelector('[data-calculator="medspa-reactivation"]');
  if (reactivate) {
    bind(['calc-inactive-count', 'calc-inactive-avg', 'calc-inactive-pct'], function () {
      var count = num('calc-inactive-count');
      var avg = num('calc-inactive-avg');
      var pct = num('calc-inactive-pct');
      var monthly = count * avg * (pct / 100);
      setText('calc-inactive-result', fmt.format(monthly));
    });
  }

  var leads = document.querySelector('[data-calculator="medspa-leads"]');
  if (leads) {
    bind(
      ['calc-leads-count', 'calc-leads-current', 'calc-leads-target', 'calc-leads-avg'],
      function () {
        var count = num('calc-leads-count');
        var current = num('calc-leads-current');
        var target = num('calc-leads-target');
        var avg = num('calc-leads-avg');
        var lift = Math.max(0, target - current);
        var extraAppts = count * (lift / 100);
        var extraRev = extraAppts * avg;
        setText('calc-leads-appts', extraAppts.toFixed(1).replace(/\.0$/, ''));
        setText('calc-leads-result', fmt.format(extraRev));
      },
    );
  }
})();