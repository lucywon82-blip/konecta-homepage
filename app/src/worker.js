// 코넥타 업무 프로그램 — 클라우드플레어 워커
// 화면(public/)은 정적 파일로 그대로 서빙하고, /api/* 요청만 이 코드가 처리한다.
// 노션 API 키(NOTION_TOKEN)는 여기서만 쓰이고 화면 코드에는 절대 노출되지 않는다.

const NOTION_VERSION = '2022-06-28';
const NOTION_API = 'https://api.notion.com/v1';

const DB = {
  personal: '668993c891f34611ae8c772b4753655d', // 개인 일정
  reservation: 'ff32c93e4361455dae8ac660581a8f24', // 예약
  sales: 'f2bb764de7d744779e0827253ea36388', // 매출
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

async function notionQuery(env, databaseId, filter) {
  const results = [];
  let cursor;
  do {
    const res = await fetch(`${NOTION_API}/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.NOTION_TOKEN}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter,
        start_cursor: cursor,
        page_size: 100,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`노션 조회 실패 (${res.status}): ${errText}`);
    }
    const data = await res.json();
    results.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return results;
}

function plainText(richTextArray) {
  if (!richTextArray || richTextArray.length === 0) return '';
  return richTextArray.map((t) => t.plain_text).join('');
}

function dateRangeFilter(property, start, end) {
  return {
    and: [
      { property, date: { on_or_after: start } },
      { property, date: { on_or_before: end } },
    ],
  };
}

function mapPersonalEvent(page) {
  const p = page.properties;
  return {
    id: page.id,
    source: 'personal',
    title: plainText(p['제목']?.title) || '(제목 없음)',
    category: p['종류']?.select?.name || '기타',
    start: p['시작일시']?.date?.start || null,
    end: p['종료일시']?.date?.start || p['시작일시']?.date?.end || null,
    allDay: !!p['종일여부']?.checkbox,
    location: plainText(p['장소']?.rich_text),
    memo: plainText(p['메모']?.rich_text),
    done: !!p['완료여부']?.checkbox,
  };
}

function mapReservationEvent(page) {
  const p = page.properties;
  return {
    id: page.id,
    source: 'reservation',
    title: plainText(p['고객명']?.title) || '(이름 없음)',
    category: p['서비스종류']?.select?.name || '기타',
    start: p['예약일시']?.date?.start || null,
    end: p['예약일시']?.date?.end || p['예약일시']?.date?.start || null,
    allDay: false,
    phone: p['연락처']?.phone_number || '',
    staff: p['담당자']?.select?.name || '',
    status: p['상태']?.select?.name || '신청됨',
    channel: p['접수경로']?.select?.name || '',
    memo: plainText(p['요청사항']?.rich_text),
  };
}

function mapSalesRow(page) {
  const p = page.properties;
  return {
    id: page.id,
    item: plainText(p['항목']?.title) || '(항목 없음)',
    date: p['날짜']?.date?.start || null,
    staff: p['담당자']?.select?.name || '',
    amount: p['금액']?.number ?? 0,
    customer: plainText(p['고객명']?.rich_text),
    payment: p['결제수단']?.select?.name || '',
    memo: plainText(p['메모']?.rich_text),
  };
}

async function handleEvents(env, url) {
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  if (!start || !end) return json({ error: 'start, end 파라미터가 필요합니다.' }, 400);

  const [personalPages, reservationPages] = await Promise.all([
    notionQuery(env, DB.personal, dateRangeFilter('시작일시', start, end)),
    notionQuery(env, DB.reservation, dateRangeFilter('예약일시', start, end)),
  ]);

  const events = [
    ...personalPages.map(mapPersonalEvent),
    ...reservationPages.map(mapReservationEvent),
  ].sort((a, b) => (a.start || '').localeCompare(b.start || ''));

  return json({ events });
}

async function handleSales(env, url) {
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  if (!start || !end) return json({ error: 'start, end 파라미터가 필요합니다.' }, 400);

  const pages = await notionQuery(env, DB.sales, dateRangeFilter('날짜', start, end));
  const rows = pages.map(mapSalesRow).sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const totalByStaff = {};
  let total = 0;
  for (const row of rows) {
    total += row.amount;
    totalByStaff[row.staff || '미지정'] = (totalByStaff[row.staff || '미지정'] || 0) + row.amount;
  }

  return json({ rows, total, totalByStaff });
}

async function handleCreateReservation(env, request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: '요청 형식이 올바르지 않습니다.' }, 400);
  }

  const { name, phone, datetime, service, memo } = body;
  if (!name || !datetime) {
    return json({ error: '이름과 예약일시는 필수입니다.' }, 400);
  }

  const res = await fetch(`${NOTION_API}/pages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.NOTION_TOKEN}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      parent: { database_id: DB.reservation },
      properties: {
        '고객명': { title: [{ text: { content: name } }] },
        '연락처': { phone_number: phone || '' },
        '예약일시': { date: { start: datetime } },
        '서비스종류': { select: { name: service || '기타' } },
        '상태': { select: { name: '신청됨' } },
        '접수경로': { select: { name: '홈페이지' } },
        '요청사항': { rich_text: [{ text: { content: memo || '' } }] },
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return json({ error: `예약 저장 실패: ${errText}` }, 502);
  }

  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      if (url.pathname === '/api/events' && request.method === 'GET') {
        return await handleEvents(env, url);
      }
      if (url.pathname === '/api/sales' && request.method === 'GET') {
        return await handleSales(env, url);
      }
      if (url.pathname === '/api/reservations' && request.method === 'POST') {
        return await handleCreateReservation(env, request);
      }
    } catch (err) {
      return json({ error: err.message || '서버 오류' }, 500);
    }

    // API가 아니면 정적 화면 파일을 그대로 서빙한다
    return env.ASSETS.fetch(request);
  },
};
