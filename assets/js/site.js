/* Deal form: builds a mailto: so it works on GitHub Pages with no backend */
var form = document.querySelector('[data-deal-form]');
if (form) {
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = new FormData(form);
    var addr = (f.get('address') || '').trim();
    var lines = [
      'Address:   ' + addr,
      'Asking:    ' + (f.get('price') || '').trim(),
      'Condition: ' + (f.get('condition') || '').trim(),
      'Occupancy: ' + (f.get('occupancy') || '').trim(),
      'Access:    ' + (f.get('access') || '').trim(),
      '',
      'From: ' + (f.get('from') || '').trim()
    ];
    var subject = 'Deal: ' + (addr || 'address');
    window.location.href = 'mailto:' + form.dataset.dealForm +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(lines.join('\n'));
  });
}
