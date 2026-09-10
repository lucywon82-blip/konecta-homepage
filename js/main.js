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

// 1:1 피부 상담 예약 폼 — 코넥타 업무 프로그램(/app)의 워커 API로 전송됩니다.
// 노션 API 키는 여기 없고, 워커 쪽 서버 환경변수에만 있습니다.
const bookingForm = document.getElementById('bookingForm');
if (bookingForm) {
  const t = (path, fallback) => {
    const data = window.konectaI18nData;
    const val = data && window.konectaI18n ? window.konectaI18n.getByPath(data, path) : undefined;
    return typeof val === 'string' ? val : fallback;
  };

  bookingForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const statusEl = document.getElementById('bookingStatus');
    const btn = bookingForm.querySelector('.booking-submit');
    const payload = {
      name: bookingForm.name.value.trim(),
      phone: bookingForm.contact.value.trim(),
      datetime: bookingForm.datetime.value ? `${bookingForm.datetime.value}:00` : '',
      service: '상담',
      memo: bookingForm.memo.value.trim(),
    };

    btn.disabled = true;
    statusEl.className = 'booking-status';
    statusEl.textContent = t('home.booking.submitting', '예약 접수 중...');

    fetch('/app/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) throw new Error('reservation request failed');
        return res.json();
      })
      .then(() => {
        statusEl.className = 'booking-status ok';
        statusEl.textContent = t('home.booking.success', '예약 신청이 접수되었어요. 곧 연락드릴게요!');
        bookingForm.reset();
      })
      .catch(() => {
        statusEl.className = 'booking-status err';
        statusEl.textContent = t('home.booking.error', '예약 접수에 실패했어요. 잠시 후 다시 시도해주세요.');
      })
      .finally(() => {
        btn.disabled = false;
      });
  });
}
