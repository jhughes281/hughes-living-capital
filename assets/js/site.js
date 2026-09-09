/* Forms: build a pre-filled mailto: so they work on GitHub Pages with no backend.
   <form data-deal-form="you@example.com" data-subject="Deal"> — each field's <span> label becomes the line label. */
document.querySelectorAll('[data-deal-form]').forEach(function (form) {
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var lines = [];
    form.querySelectorAll('input[name], select[name], textarea[name]').forEach(function (el) {
      var lab = el.closest('label'); var k = lab && lab.querySelector('span') ? lab.querySelector('span').textContent.trim() : el.name;
      lines.push(k + ': ' + (el.value || '').trim());
    });
    var first = form.querySelector('input[name]');
    var subject = (form.dataset.subject || 'Deal') + ': ' + ((first && first.value.trim()) || '');
    window.location.href = 'mailto:' + form.dataset.dealForm +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(lines.join('\n'));
  });
});
