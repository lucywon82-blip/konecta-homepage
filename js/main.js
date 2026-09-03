document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// scroll reveal
const revealItems = document.querySelectorAll('.reveal');
if (revealItems.length) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
  revealItems.forEach(el => io.observe(el));
}

// number count-up
const counters = document.querySelectorAll('[data-count]');
if (counters.length) {
  const format = (el, val) => {
    const suffix = el.dataset.suffix || '';
    el.textContent = val + suffix;
  };
  const animate = (el) => {
    const target = parseFloat(el.dataset.count);
    const duration = 1100;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      format(el, Math.round(target * eased));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io2 = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animate(entry.target);
        io2.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(el => io2.observe(el));
}

// header hide/show on scroll direction
let lastY = window.scrollY;
const header = document.querySelector('.header');
if (header) {
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (y > lastY && y > 120) {
      header.classList.add('header-hidden');
    } else {
      header.classList.remove('header-hidden');
    }
    lastY = y;
  }, { passive: true });
}

// scroll parallax on hero/page-hero background media
const parallaxMedia = document.querySelectorAll('.hero-media');
if (parallaxMedia.length) {
  const applyParallax = () => {
    parallaxMedia.forEach(el => {
      const rect = el.parentElement.getBoundingClientRect();
      const speed = 0.28;
      const maxOffset = rect.height * 0.1;
      const offset = Math.max(-maxOffset, Math.min(maxOffset, rect.top * speed));
      el.style.transform = `translateY(${offset}px)`;
    });
  };
  applyParallax();
  window.addEventListener('scroll', () => requestAnimationFrame(applyParallax), { passive: true });
}

// subtle mouse parallax on hero media (applied to a wrapper so it doesn't
// fight the CSS kenburns animation running on the img itself)
document.querySelectorAll('[data-parallax]').forEach(el => {
  const inner = el.querySelector('.hero-media-inner');
  if (!inner) return;
  el.addEventListener('mousemove', (e) => {
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    inner.style.transform = `translate(${x * -18}px, ${y * -12}px)`;
  });
  el.addEventListener('mouseleave', () => {
    inner.style.transform = '';
  });
});
