(function(){
// Track tel: link clicks
document.addEventListener('click', function(e) {
  var link = e.target.closest('a[href^="tel:"]');
  if (link && typeof gtag === 'function') {
    gtag('event', 'phone_click', {
      event_category: 'engagement',
      event_label: link.href.replace('tel:', ''),
      value: 25.0,
      currency: 'USD'
    });
    gtag('event', 'conversion', {'send_to': 'AW-18030544849/j_t9CJ-o468cENGP0ZVD'});
  }
});

// Track WhatsApp link clicks (inline links, not the floating button)
document.addEventListener('click', function(e) {
  var link = e.target.closest('a[href*="wa.me"]');
  if (link && typeof gtag === 'function') {
    gtag('event', 'whatsapp_click', {
      event_category: 'engagement',
      event_label: link.closest('section,div')?.id || 'inline',
      value: 25.0,
      currency: 'USD'
    });
    gtag('event', 'conversion', {'send_to': 'AW-18030544849/woG9CJyo468cENGP0ZVD'});
  }
});

// Track playbook download clicks
document.addEventListener('click', function(e) {
  var link = e.target.closest('a[href*="playbook"]');
  if (link && typeof gtag === 'function') {
    var text = (link.textContent || '').trim().toLowerCase();
    if (text.includes('download') || text.includes('playbook')) {
      gtag('event', 'playbook_download', {
        event_category: 'engagement',
        event_label: link.href,
        value: 5.0,
        currency: 'USD'
      });
      gtag('event', 'conversion', {'send_to': 'AW-18030544849/i4w3CJqp468cENGP0ZVD'});
    }
  }
});

// Track mailto clicks (GA4 only — not a Google Ads conversion)
document.addEventListener('click', function(e) {
  var link = e.target.closest('a[href^="mailto:"]');
  if (link && typeof gtag === 'function') {
    gtag('event', 'email_click', {
      event_category: 'engagement',
      event_label: link.href.replace('mailto:', ''),
      value: 1.0
    });
  }
});
})();
