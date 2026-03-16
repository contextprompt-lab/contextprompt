export function initSupportModal() {
  const link = document.getElementById('support-link');
  const backdrop = document.getElementById('support-modal');
  const closeBtn = document.getElementById('support-modal-close');
  const form = document.getElementById('support-form');
  const submitBtn = document.getElementById('support-submit');
  const feedback = document.getElementById('support-feedback');

  if (!link || !backdrop || !form) return;

  function open(e) {
    e.preventDefault();
    backdrop.setAttribute('aria-hidden', 'false');
  }

  function close() {
    backdrop.setAttribute('aria-hidden', 'true');
    feedback.textContent = '';
    feedback.className = 'support-feedback';
  }

  link.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && backdrop.getAttribute('aria-hidden') === 'false') close();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const message = form.message.value.trim();

    if (!email || !message) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    feedback.textContent = '';
    feedback.className = 'support-feedback';

    try {
      const res = await fetch('/api/support/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      feedback.textContent = 'Message sent! We\'ll get back to you soon.';
      feedback.className = 'support-feedback support-feedback--success';
      form.reset();
    } catch (err) {
      feedback.textContent = err.message || 'Something went wrong. Please try again.';
      feedback.className = 'support-feedback support-feedback--error';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send message';
    }
  });
}
