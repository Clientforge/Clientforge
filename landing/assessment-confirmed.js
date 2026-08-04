(function () {
  var params = new URLSearchParams(window.location.search);
  var firstName = (params.get('firstName') || '').trim();

  var heading = document.getElementById('confirmed-heading');
  var lead = document.getElementById('confirmed-lead');

  if (firstName && heading) {
    heading.textContent = 'You\u2019re all set, ' + firstName;
  }

  if (firstName && lead) {
    lead.textContent =
      firstName + ', check your email for a calendar invite with the date, time, and details for your 20-minute strategy call.';
  }
})();
