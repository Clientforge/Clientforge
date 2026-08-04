(function () {
  var params = new URLSearchParams(window.location.search);
  var firstName = (params.get('firstName') || '').trim();
  var practice = (params.get('practice') || '').trim();
  var email = (params.get('email') || '').trim();
  var ref = (params.get('ref') || '').trim();

  var heading = document.getElementById('book-heading');
  var lead = document.getElementById('book-lead');
  var confirmedLink = document.getElementById('confirmed-link');

  if (firstName && heading) {
    heading.textContent = firstName + ', pick a time that works for you';
  }

  if (practice && lead) {
    lead.textContent =
      'Click below to open our calendar and choose a slot for your free 20-minute strategy call. We\u2019ll use what you shared about '
      + practice
      + ' to personalize the conversation.';
  }

  if (confirmedLink) {
    var nextParams = new URLSearchParams();
    if (firstName) nextParams.set('firstName', firstName);
    if (practice) nextParams.set('practice', practice);
    if (email) nextParams.set('email', email);
    if (ref) nextParams.set('ref', ref);
    var qs = nextParams.toString();
    confirmedLink.href = '/assessment/confirmed' + (qs ? '?' + qs : '');
  }
})();
