(() => {
  'use strict';

  const DESKTOP_BREAKPOINT = 768;
  const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

  const state = {
    mode: window.innerWidth >= DESKTOP_BREAKPOINT ? 'month' : 'month',
    anchor: new Date(),
    tab: 'calendar',
    events: [],
    sales: { rows: [], total: 0, totalByStaff: {} },
  };

  // ---------- 날짜 유틸 ----------
  function pad(n) { return String(n).padStart(2, '0'); }
  function toISODate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function sameDay(a, b) { return toISODate(a) === toISODate(b); }
  function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

  function startOfWeek(d) { return addDays(d, -d.getDay()); }
  function endOfWeek(d) { return addDays(startOfWeek(d), 6); }

  function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function endOfMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }

  function monthGridRange(d) {
    return { start: startOfWeek(startOfMonth(d)), end: endOfWeek(endOfMonth(d)) };
  }

  function currentRange() {
    if (state.mode === 'week') {
      return { start: startOfWeek(state.anchor), end: endOfWeek(state.anchor) };
    }
    return { start: startOfMonth(state.anchor), end: endOfMonth(state.anchor) };
  }

  function currentGridRange() {
    if (state.mode === 'week') {
      return { start: startOfWeek(state.anchor), end: endOfWeek(state.anchor) };
    }
    return monthGridRange(state.anchor);
  }

  // ---------- API ----------
  async function fetchEvents(start, end) {
    const res = await fetch(`/api/events?start=${toISODate(start)}&end=${toISODate(end)}`);
    if (!res.ok) throw new Error('일정을 불러오지 못했습니다.');
    const data = await res.json();
    return data.events || [];
  }

  async function fetchSales(start, end) {
    const res = await fetch(`/api/sales?start=${toISODate(start)}&end=${toISODate(end)}`);
    if (!res.ok) throw new Error('매출을 불러오지 못했습니다.');
    return res.json();
  }

  // ---------- 렌더: 상단 라벨 ----------
  function renderPeriodLabel() {
    const label = document.getElementById('periodLabel');
    if (state.mode === 'week') {
      const s = startOfWeek(state.anchor);
      const e = endOfWeek(state.anchor);
      label.textContent = `${s.getMonth() + 1}월 ${s.getDate()}일 ~ ${e.getMonth() + 1}월 ${e.getDate()}일`;
    } else {
      label.textContent = `${state.anchor.getFullYear()}년 ${state.anchor.getMonth() + 1}월`;
    }
  }

  // ---------- 렌더: 캘린더 ----------
  function eventCategoryClass(ev) {
    if (ev.source === 'reservation') return '예약';
    return ev.category || '기타';
  }

  function eventsByDate(events) {
    const map = {};
    for (const ev of events) {
      if (!ev.start) continue;
      const key = ev.start.slice(0, 10);
      (map[key] = map[key] || []).push(ev);
    }
    return map;
  }

  function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    grid.className = `calendar-grid ${state.mode}`;
    grid.innerHTML = '';

    const { start, end } = currentGridRange();
    const byDate = eventsByDate(state.events);
    const today = new Date();
    const monthOfAnchor = state.anchor.getMonth();

    let cursor = new Date(start);
    while (cursor <= end) {
      const key = toISODate(cursor);
      const dayEvents = (byDate[key] || []).sort((a, b) => (a.start || '').localeCompare(b.start || ''));

      const cell = document.createElement('div');
      cell.className = 'day-cell';
      if (state.mode === 'month' && cursor.getMonth() !== monthOfAnchor) cell.classList.add('other-month');
      if (sameDay(cursor, today)) cell.classList.add('today');

      const num = document.createElement('div');
      num.className = 'day-num';
      num.textContent = cursor.getDate();
      cell.appendChild(num);

      const rowWrap = document.createElement('div');
      rowWrap.className = 'event-dot-row';
      const maxShow = state.mode === 'week' ? 8 : 3;
      dayEvents.slice(0, maxShow).forEach((ev) => {
        const chip = document.createElement('div');
        chip.className = 'event-chip';
        chip.style.background = `var(--cat-${eventCategoryClass(ev)}, var(--cat-기타))`;
        chip.textContent = ev.title;
        rowWrap.appendChild(chip);
      });
      if (dayEvents.length > maxShow) {
        const more = document.createElement('div');
        more.className = 'event-more';
        more.textContent = `+${dayEvents.length - maxShow}`;
        rowWrap.appendChild(more);
      }
      cell.appendChild(rowWrap);

      cell.addEventListener('click', () => openDayPanel(new Date(cursor), dayEvents));
      grid.appendChild(cell);

      cursor = addDays(cursor, 1);
    }
  }

  // ---------- 하루 상세 패널 ----------
  function formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime()) || iso.length <= 10) return '종일';
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function openDayPanel(date, events) {
    const panel = document.getElementById('dayPanel');
    const backdrop = document.getElementById('dayPanelBackdrop');
    const list = document.getElementById('dayPanelList');
    document.getElementById('dayPanelDate').textContent =
      `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAY_LABELS[date.getDay()]})`;

    list.innerHTML = '';
    if (events.length === 0) {
      list.innerHTML = '<li class="empty-state">이 날은 등록된 일정이 없어요.</li>';
    } else {
      for (const ev of events) {
        const li = document.createElement('li');
        li.className = `event-item cat-${eventCategoryClass(ev)}`;
        const badge = ev.source === 'reservation' ? `<span class="badge">${ev.status || '예약'}</span>` : '';
        const metaParts = [formatTime(ev.start)];
        if (ev.location) metaParts.push(ev.location);
        if (ev.source === 'reservation' && ev.phone) metaParts.push(ev.phone);
        li.innerHTML = `
          <div class="bar"></div>
          <div class="info">
            <div class="title">${ev.title}${badge}</div>
            <div class="meta">${metaParts.filter(Boolean).join(' · ')}</div>
          </div>`;
        list.appendChild(li);
      }
    }

    panel.hidden = false;
    backdrop.hidden = false;
  }

  function closeDayPanel() {
    document.getElementById('dayPanel').hidden = true;
    document.getElementById('dayPanelBackdrop').hidden = true;
  }

  // ---------- 렌더: 매출 ----------
  function formatWon(n) { return `${n.toLocaleString('ko-KR')}원`; }

  function renderSales() {
    document.getElementById('salesTotal').textContent = formatWon(state.sales.total || 0);

    const staffList = document.getElementById('salesByStaff');
    staffList.innerHTML = '';
    const entries = Object.entries(state.sales.totalByStaff || {});
    if (entries.length === 0) {
      staffList.innerHTML = '<li>등록된 담당자 매출이 없어요</li>';
    } else {
      for (const [staff, amount] of entries) {
        const li = document.createElement('li');
        li.textContent = `${staff} · ${formatWon(amount)}`;
        staffList.appendChild(li);
      }
    }

    const list = document.getElementById('salesList');
    list.innerHTML = '';
    const rows = state.sales.rows || [];
    if (rows.length === 0) {
      list.innerHTML = '<li class="empty-state">이 기간 매출 기록이 없어요.</li>';
      return;
    }
    for (const row of rows) {
      const li = document.createElement('li');
      const dateLabel = row.date ? row.date.slice(5, 10).replace('-', '/') : '';
      li.innerHTML = `
        <div>
          <div class="s-item">${row.item}</div>
          <div class="s-meta">${dateLabel} · ${row.staff || '미지정'} · ${row.payment || ''}</div>
        </div>
        <div class="s-amount">${formatWon(row.amount)}</div>`;
      list.appendChild(li);
    }
  }

  // ---------- 데이터 로드 ----------
  async function loadCalendarData() {
    const grid = currentGridRange();
    try {
      state.events = await fetchEvents(grid.start, grid.end);
    } catch (e) {
      console.error(e);
      state.events = [];
    }
    renderCalendar();
  }

  async function loadSalesData() {
    const range = currentRange();
    try {
      state.sales = await fetchSales(range.start, range.end);
    } catch (e) {
      console.error(e);
      state.sales = { rows: [], total: 0, totalByStaff: {} };
    }
    renderSales();
  }

  async function refreshAll() {
    renderPeriodLabel();
    await Promise.all([loadCalendarData(), loadSalesData()]);
  }

  // ---------- 이벤트 바인딩 ----------
  function bindNav() {
    document.getElementById('prevBtn').addEventListener('click', () => {
      state.anchor = state.mode === 'week' ? addDays(state.anchor, -7) : new Date(state.anchor.getFullYear(), state.anchor.getMonth() - 1, 1);
      refreshAll();
    });
    document.getElementById('nextBtn').addEventListener('click', () => {
      state.anchor = state.mode === 'week' ? addDays(state.anchor, 7) : new Date(state.anchor.getFullYear(), state.anchor.getMonth() + 1, 1);
      refreshAll();
    });
    document.getElementById('todayBtn').addEventListener('click', () => {
      state.anchor = new Date();
      refreshAll();
    });
  }

  function bindViewToggle() {
    const buttons = document.querySelectorAll('#viewToggle .toggle-btn');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (window.innerWidth >= DESKTOP_BREAKPOINT) return;
        state.mode = btn.dataset.mode;
        buttons.forEach((b) => b.classList.toggle('active', b === btn));
        refreshAll();
      });
    });
  }

  function bindTabs() {
    const tabs = document.querySelectorAll('.bottom-tabs .tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        state.tab = tab.dataset.tab;
        tabs.forEach((t) => t.classList.toggle('active', t === tab));
        document.getElementById('calendarView').classList.toggle('active', state.tab === 'calendar');
        document.getElementById('salesView').classList.toggle('active', state.tab === 'sales');
      });
    });
  }

  function bindDayPanel() {
    document.getElementById('dayPanelClose').addEventListener('click', closeDayPanel);
    document.getElementById('dayPanelBackdrop').addEventListener('click', closeDayPanel);
  }

  function bindResize() {
    let wasDesktop = window.innerWidth >= DESKTOP_BREAKPOINT;
    window.addEventListener('resize', () => {
      const isDesktop = window.innerWidth >= DESKTOP_BREAKPOINT;
      if (isDesktop && !wasDesktop && state.mode === 'week') {
        state.mode = 'month';
        document.querySelectorAll('#viewToggle .toggle-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === 'month'));
        refreshAll();
      }
      wasDesktop = isDesktop;
    });
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch((e) => console.warn('서비스워커 등록 실패', e));
    }
  }

  function init() {
    bindNav();
    bindViewToggle();
    bindTabs();
    bindDayPanel();
    bindResize();
    registerServiceWorker();
    refreshAll();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
