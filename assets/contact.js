/* Compose locally. Nothing is sent until the visitor sends in their email app. */
(() => {
  'use strict';
  const form = document.querySelector('[data-contact-form]');
  if (!form) return;
  const recipient = form.dataset.recipient;
  const from = form.querySelector('[name="from"]');
  const message = form.querySelector('[name="message"]');
  const status = document.querySelector('[data-contact-status]');
  const copy = document.querySelector('[data-copy-email]');
  const fallback = document.querySelector('[data-copy-fallback]');
  const address = document.querySelector('[data-copy-address]');
  const updateDraft = () => {
    const subject = 'Message from your portfolio';
    const body = `${message.value.trim()}\r\n\r\nReply to: ${from.value.trim()}`;
    form.action = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    message.setCustomValidity(message.value && !message.value.trim() ? 'Please write a message.' : '');
  };
  form.addEventListener('input', () => {updateDraft();status.textContent = '';});
  form.addEventListener('submit', event => {
    event.preventDefault();
    updateDraft();
    if (!form.reportValidity()) return;
    status.textContent = 'Continue in your email app to send. If it did not open, copy the address above.';
    window.location.href = form.action;
  });
  copy.hidden = false;
  copy.addEventListener('click', async () => {
    if (copy.disabled) return;
    copy.disabled = true;
    copy.setAttribute('aria-busy','true');
    copy.textContent = 'Copying…';
    status.textContent = 'Copying email address…';
    try {
      await navigator.clipboard.writeText(recipient);
      fallback.hidden = true;
      status.textContent = 'Email address copied.';
    } catch (_) {
      fallback.hidden = false;
      address.value = recipient;
      address.focus();
      address.select();
      status.textContent = 'Automatic copy was unavailable. The address is selected for manual copying.';
    } finally {
      copy.disabled = false;
      copy.removeAttribute('aria-busy');
      copy.textContent = 'Copy';
    }
  });
  try {
    const previous = new URL(document.referrer);
    if (previous.origin === location.origin && previous.pathname !== location.pathname &&
      !/\/contact\/(?:index\.html)?$/.test(previous.pathname)) {
      document.querySelectorAll('[data-contact-back]').forEach(link => {link.href = previous.href;});
    }
  } catch (_) { /* Direct visits keep the ordinary link back to the portfolio. */ }
  updateDraft();
  form.hidden = false;
})();
