// Khởi tạo Supabase client
const db = supabase.createClient(
  'https://gojpmogjretoxplydjvg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvanBtb2dqcmV0b3hwbHlkanZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0Nzg4ODEsImV4cCI6MjA5MzA1NDg4MX0.iLCNd2VRMiZoFp6_KclZlFsOenUNoM041tl1fobHKDA'
);

// ---- Giải mã link AES-GCM ----
const _ENC_KEY = 'DHDTCT-LMS-2025-SECURE-KEY-32BYT';
async function _getKey() {
  const raw = new TextEncoder().encode(_ENC_KEY.slice(0,32).padEnd(32,'0'));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt','decrypt']);
}
async function decryptUrl(enc) {
  if (!enc || !enc.startsWith('ENC:')) return enc;
  try {
    const key = await _getKey();
    const combined = Uint8Array.from(atob(enc.slice(4)), c => c.charCodeAt(0));
    const iv = combined.slice(0,12), data = combined.slice(12);
    const dec = await crypto.subtle.decrypt({ name:'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(dec);
  } catch { return enc; }
}

// Auth guard
if (sessionStorage.getItem('dh_role') !== 'student') location.href = 'index.html';

// ── Xác thực session token với DB ngay khi load ──
(async () => {
  const username = sessionStorage.getItem('dh_user');
  const token    = sessionStorage.getItem('dh_token');
  if (!username || !token) { sessionStorage.clear(); location.href = 'index.html'; return; }
  try {
    const { data: s } = await db.from('students').select('session_token,active').eq('username', username).single();
    if (!s || s.session_token !== token || s.active === false) {
      sessionStorage.clear();
      location.href = 'index.html';
    }
  } catch(e) { /* network error — cho qua */ }
})();

// Kiểm tra bảo trì
(async () => {
  try {
    const { data } = await db.from('app_settings').select('value').eq('key', 'maintenance').maybeSingle();
    if (data?.value === 'true') {
      if (typeof _wmDestroyed !== 'undefined') _wmDestroyed = true;
      document.body.style.cssText = 'margin:0;padding:0;overflow:hidden';
      document.body.innerHTML = `
        <div style="min-height:100vh;width:100vw;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1e1b4b,#312e81);padding:2rem;box-sizing:border-box">
          <div style="background:#fff;border-radius:20px;padding:2.5rem 2rem;text-align:center;max-width:420px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,.3)">
            <img src="btht.png" alt="Bảo trì" style="width:100%;border-radius:12px;margin-bottom:1.25rem"/>
            <div style="font-size:1.3rem;font-weight:800;color:#1e1b4b;margin-bottom:.75rem">Hệ thống đang bảo trì</div>
            <div style="font-size:.9rem;color:#64748b;line-height:1.7;margin-bottom:1.5rem">
              Chúng tôi đang nâng cấp hệ thống để phục vụ bạn tốt hơn.<br/>
              Vui lòng quay lại sau ít phút.
            </div>
            <div style="font-size:.82rem;color:#94a3b8">Liên hệ trợ lý nếu cần hỗ trợ gấp.</div>
          </div>
        </div>`;
    }
  } catch(e) { /* Bảng chưa tạo hoặc lỗi — bỏ qua */ }
})();

const currentUser = sessionStorage.getItem('dh_user');
const currentName = sessionStorage.getItem('dh_name') || currentUser;

document.getElementById('studentName').textContent  = currentName;
document.getElementById('welcomeTitle').textContent = `Xin chào, ${currentName}! 👋`;
document.getElementById('profileName').textContent  = currentName;

let myClass = '';
let myClasses = []; // Hỗ trợ nhiều lớp — load từ student_classes

// Debounce helper
function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

async function loadMe() {
  const { data } = await db.from('students').select('id, class_name, student_code, expiry_date, created_at, username, active').eq('username', currentUser).single();
  myClass = data?.class_name || '';
  // Load tất cả lớp từ student_classes
  if (data?.id) {
    const { data: scData } = await db.from('student_classes').select('class_name').eq('student_id', data.id);
    myClasses = (scData||[]).length > 0
      ? (scData||[]).map(sc => sc.class_name).filter(Boolean)
      : [myClass].filter(Boolean);
  } else {
    myClasses = [myClass].filter(Boolean);
  }
  sessionStorage.setItem('dh_code', data?.student_code || '');

  const today = new Date(); today.setHours(0,0,0,0);
  const WARN_DAYS = 7;
  const fmt = d => d ? new Date(d).toLocaleDateString('vi-VN') : '—';

  // Điền hồ sơ cơ bản
  const av = document.getElementById('profileAvatar');
  if (av) av.textContent = (currentName||'?')[0].toUpperCase();
  const el = id => document.getElementById(id);
  if (el('profileClass'))    el('profileClass').textContent    = myClasses.length ? `🎓 Lớp: ${myClasses.join(', ')}` : '';
  if (el('profileCode'))     el('profileCode').textContent     = data?.student_code ? `Mã HV: ${data.student_code}` : '';
  if (el('profileUsername')) el('profileUsername').textContent = data?.username || '—';
  if (el('profileCreated'))  el('profileCreated').textContent  = data?.created_at ? fmt(data.created_at) : '—';

  // Lấy thông tin tất cả lớp học
  let clsData = null;
  let allClsData = [];
  if (myClasses.length) {
    const { data: clsList } = await db.from('classes').select('name,start_date,end_date').in('name', myClasses);
    allClsData = clsList || [];
    // Lấy lớp đầu tiên để hiển thị profile (hoặc lớp sắp hết hạn nhất)
    clsData = allClsData[0] || null;
  }

  if (el('profileStartDate')) el('profileStartDate').textContent = clsData?.start_date ? fmt(clsData.start_date) : '—';
  if (el('profileEndDate')) {
    if (clsData?.end_date) {
      const end = new Date(clsData.end_date); end.setHours(0,0,0,0);
      const daysLeft = Math.round((end - today) / 86400000);
      let badge = '';
      if (daysLeft < 0)        badge = `<span style="margin-left:.4rem;font-size:.72rem;background:#fee2e2;color:#991b1b;padding:.15rem .5rem;border-radius:6px;font-weight:700">Đã kết thúc</span>`;
      else if (daysLeft === 0) badge = `<span style="margin-left:.4rem;font-size:.72rem;background:#fef3c7;color:#92400e;padding:.15rem .5rem;border-radius:6px;font-weight:700">Hôm nay</span>`;
      else if (daysLeft <= 7)  badge = `<span style="margin-left:.4rem;font-size:.72rem;background:#fef3c7;color:#92400e;padding:.15rem .5rem;border-radius:6px;font-weight:700">Còn ${daysLeft} ngày</span>`;
      else                     badge = `<span style="margin-left:.4rem;font-size:.72rem;background:#d1fae5;color:#065f46;padding:.15rem .5rem;border-radius:6px;font-weight:700">Còn ${daysLeft} ngày</span>`;
      el('profileEndDate').innerHTML = `${fmt(clsData.end_date)}${badge}`;
    } else {
      el('profileEndDate').textContent = '—';
    }
  }

  // Kiểm tra hết hạn và tự khóa
  const banner = document.getElementById('expiryBanner');
  let locked = false;

  function showExpiryBanner(daysLeft, dateStr, type) {
    banner.style.display = 'block';
    const isUrgent = daysLeft <= 3;
    const color = daysLeft === 0 ? '#dc2626' : isUrgent ? '#d97706' : '#2563eb';
    const bg    = daysLeft === 0 ? '#fee2e2' : isUrgent ? '#fef3c7' : '#eff6ff';
    const icon  = daysLeft === 0 ? '🔴' : isUrgent ? '⚠️' : '📅';
    const msg   = daysLeft === 0
      ? `Tài khoản hết hạn <b>hôm nay</b>! Liên hệ ngay để gia hạn.`
      : daysLeft < 0
      ? `Tài khoản đã hết hạn vào <b>${dateStr}</b>.`
      : `${type === 'class' ? `Khóa học <b>${myClass}</b>` : 'Tài khoản'} sẽ hết hạn vào <b>${dateStr}</b> — còn <b>${daysLeft} ngày</b>. Liên hệ trợ lý để gia hạn.`;
    banner.style.cssText = `display:block;background:${bg};border-left:4px solid ${color};border-radius:10px;padding:.75rem 1rem;margin-bottom:1rem;font-size:.88rem;color:${color};font-weight:600`;
    banner.innerHTML = `${icon} ${msg}`;
  }

  // Hết hạn tài khoản cá nhân
  if (data?.expiry_date) {
    const exp = new Date(data.expiry_date); exp.setHours(0,0,0,0);
    const daysLeft = Math.round((exp - today) / 86400000);
    if (daysLeft < 0) {
      await db.from('students').update({ active: false }).eq('username', currentUser);
      locked = true;
    } else if (daysLeft <= WARN_DAYS) {
      showExpiryBanner(daysLeft, exp.toLocaleDateString('vi-VN'), 'account');
    }
  }

  // Hết hạn lớp học — kiểm tra tất cả lớp
  if (!locked) {
    for (const cls of allClsData) {
      if (!cls.end_date) continue;
      const end = new Date(cls.end_date); end.setHours(0,0,0,0);
      const daysLeft = Math.round((end - today) / 86400000);
      if (daysLeft < 0) {
        // Chỉ khóa nếu TẤT CẢ lớp đã hết hạn
        const allExpired = allClsData.every(c => !c.end_date || new Date(c.end_date) < today);
        if (allExpired) {
          await db.from('students').update({ active: false }).eq('username', currentUser);
          locked = true;
        }
        break;
      } else if (daysLeft <= WARN_DAYS) {
        showExpiryBanner(daysLeft, end.toLocaleDateString('vi-VN'), 'class');
        break;
      }
    }
  }

  // Nếu bị khóa → đăng xuất ngay
  if (locked) {
    alert('Khóa học của bạn đã kết thúc. Tài khoản đã bị khóa. Vui lòng liên hệ trợ lý.');
    sessionStorage.clear();
    location.href = 'index.html';
    return;
  }

  // Trạng thái
  if (el('profileStatus')) {
    const endDate = clsData?.end_date ? new Date(clsData.end_date) : null;
    const daysLeft = endDate ? Math.round((endDate - today) / 86400000) : null;
    if (daysLeft !== null && daysLeft <= 7 && daysLeft >= 0) {
      el('profileStatus').innerHTML = `<span style="color:var(--warning);font-weight:700">⚠️ Sắp kết thúc (${daysLeft} ngày)</span>`;
    } else {
      el('profileStatus').innerHTML = `<span style="color:var(--success);font-weight:700">✅ Đang hoạt động</span>`;
    }
  }
}

async function setOffline() {
  await db.from('students').update({ is_online: false, last_seen: new Date().toISOString() }).eq('username', currentUser);
}

document.getElementById('logoutBtn').addEventListener('click', async e => {
  e.preventDefault();
  await setOffline();
  sessionStorage.clear();
  location.href = 'index.html';
});

// Set offline khi đóng tab/thoát
window.addEventListener('beforeunload', () => {
  db.from('students').update({ is_online: false, last_seen: new Date().toISOString() }).eq('username', currentUser);
});
// Mobile: ẩn tab cũng set offline
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    db.from('students').update({ is_online: false, last_seen: new Date().toISOString() }).eq('username', currentUser);
  } else {
    db.from('students').update({ is_online: true, last_seen: new Date().toISOString() }).eq('username', currentUser);
  }
});

// Heartbeat mỗi 20s để giữ trạng thái online
db.from('students').update({ is_online: true, last_seen: new Date().toISOString() }).eq('username', currentUser);
setInterval(() => {
  if (document.visibilityState !== 'hidden') {
    db.from('students').update({ is_online: true, last_seen: new Date().toISOString() }).eq('username', currentUser);
  }
}, 20000);
document.getElementById('menuToggle').addEventListener('click', () => {
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarBackdrop').classList.toggle('show');
  } else {
    document.body.classList.remove('sidebar-collapsed');
  }
});
document.getElementById('sidebarBackdrop').addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarBackdrop').classList.remove('show');
});
document.getElementById('sidebarClose').addEventListener('click', () => {
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarBackdrop').classList.remove('show');
  } else {
    const isMini = document.body.classList.toggle('sidebar-mini');
    sessionStorage.setItem('st_sidebar_mini', isMini ? '1' : '');
  }
});
// Khôi phục trạng thái mini
if (sessionStorage.getItem('st_sidebar_mini') === '1') document.body.classList.add('sidebar-mini');

// Nút ▶ mở lại sidebar (chỉ bind nút trong sidebar-mini-reopen)
document.querySelector('.sidebar-mini-reopen button')?.addEventListener('click', () => {
  document.body.classList.remove('sidebar-mini');
  sessionStorage.setItem('st_sidebar_mini', '');
});

// ---- Sidebar nav ----
let currentSection = 'home';
function showPage(pg) {
  currentSection = pg;
  sessionStorage.setItem('st_page', pg);
  sessionStorage.removeItem('st_lesson_id'); // reset bài khi chuyển trang
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.slink').forEach(l => l.classList.remove('active'));
  const map = { home:'Home', lessons:'Lessons', profile:'Profile', guide:'Guide', notifications:'Notifications' };
  const el = document.getElementById('page' + (map[pg] || pg.charAt(0).toUpperCase()+pg.slice(1)));
  if (el) el.classList.add('active');
  document.querySelectorAll(`[data-page="${pg}"]`).forEach(l => l.classList.add('active'));
  if (pg === 'home')          renderHome();
  if (pg === 'lessons')       renderLessonList();
  if (pg === 'notifications') renderNotifications();
  if (pg === 'schedule')      renderStudentSchedule();
}
document.querySelectorAll('.slink[data-page]').forEach(l => {
  l.addEventListener('click', e => { e.preventDefault(); showPage(l.dataset.page); document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarBackdrop').classList.remove('show'); });
});
document.querySelectorAll('[data-goto]').forEach(l => {
  l.addEventListener('click', e => { e.preventDefault(); showPage(l.dataset.goto); });
});

// ---- Trang chủ ----
async function renderHome() {
  // Avatar + thông tin học viên
  const avatarEl = document.getElementById('homeAvatar');
  const nameEl   = document.getElementById('homeStudentName');
  const classEl  = document.getElementById('homeStudentClass');
  const codeEl   = document.getElementById('homeStudentCode');
  if (avatarEl) avatarEl.textContent = (currentName||'?')[0].toUpperCase();
  if (nameEl)   nameEl.textContent   = currentName;
  if (classEl)  classEl.textContent  = myClasses.length ? `Lớp: ${myClasses.join(', ')}` : '';
  const code = sessionStorage.getItem('dh_code');
  if (codeEl)   codeEl.textContent   = code ? `Mã HV: ${code}` : '';

  // Load thông báo + bài học song song
  const [{ data: list }, { data: anns }] = await Promise.all([
    (() => {
      let q = db.from('lessons').select('id,name,class_name').order('created_at',{ascending:false}).limit(4);
      if (myClasses.length === 1) q = q.eq('class_name', myClasses[0]);
      else if (myClasses.length > 1) q = q.in('class_name', myClasses);
      return q;
    })(),
    db.from('announcements').select('*').order('created_at',{ascending:false}).limit(200)
  ]);

  // Thông báo
  const annSection = document.getElementById('announcementSection');
  const annList    = document.getElementById('announcementList');
  if (annSection && annList) {
    const now = new Date();
    const myAnns = (anns||[]).filter(a =>
      (!a.expires_at || new Date(a.expires_at) > now) &&
      (a.target_username ? a.target_username === currentUser : (!a.class_name || a.class_name === myClass))
    );
    if (myAnns.length) {
      annSection.style.display = '';
      annList.innerHTML = myAnns.map(a => `
        <div style="padding:.65rem .75rem;background:${a.pinned?'#fef9c3':'#fff'};border-radius:10px;border-left:3px solid ${a.pinned?'#f59e0b':'#e2e8f0'}">
          <div style="font-weight:700;font-size:.88rem;margin-bottom:.2rem">${a.pinned?'📌 ':''}${a.title}${a.class_name?` <span class="class-tag">${a.class_name}</span>`:''}</div>
          <div style="font-size:.82rem;color:var(--muted);line-height:1.6;white-space:pre-line">${a.content}</div>
          ${a.link_url ? `<a href="${a.link_url}" target="_blank" style="display:inline-block;margin-top:.35rem;color:#6366f1;font-size:.8rem;font-weight:600;text-decoration:none">🔗 ${a.link_text||a.link_url}</a>` : ''}
          <div style="font-size:.72rem;color:#94a3b8;margin-top:.25rem">${new Date(a.created_at).toLocaleDateString('vi-VN')}</div>
        </div>`).join('');
    } else {
      annSection.style.display = 'none';
    }
  }

  // Bài học mới nhất
  const el = document.getElementById('homeRecentLessons');
  el.innerHTML = '';
  if (!(list||[]).length) { el.innerHTML = '<p class="muted-sm">Chưa có bài học nào.</p>'; return; }

  const ids = list.map(l=>l.id);
  const [{ data: vids }, { data: docs }] = await Promise.all([
    db.from('lesson_videos').select('lesson_id').in('lesson_id', ids),
    db.from('lesson_docs').select('lesson_id').in('lesson_id', ids),
  ]);
  const vcMap = {}, dcMap = {};
  (vids||[]).forEach(v => { vcMap[v.lesson_id] = (vcMap[v.lesson_id]||0)+1; });
  (docs||[]).forEach(d => { dcMap[d.lesson_id] = (dcMap[d.lesson_id]||0)+1; });

  const colors = [
    { bg: 'linear-gradient(135deg,#6366f1,#4f46e5)', light: '#eef2ff', icon: '📐' },
    { bg: 'linear-gradient(135deg,#0ea5e9,#0284c7)', light: '#e0f2fe', icon: '📊' },
    { bg: 'linear-gradient(135deg,#10b981,#059669)', light: '#d1fae5', icon: '📝' },
    { bg: 'linear-gradient(135deg,#f59e0b,#d97706)', light: '#fef3c7', icon: '🔢' },
  ];

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:.85rem;';
  el.appendChild(grid);

  list.forEach((l, i) => {
    const c = colors[i % colors.length];
    const vc = vcMap[l.id] || 0;
    const dc = dcMap[l.id] || 0;
    const card = document.createElement('div');
    card.style.cssText = `background:var(--card);border:1.5px solid var(--border);border-radius:16px;overflow:hidden;cursor:pointer;transition:transform .18s,box-shadow .18s;box-shadow:var(--shadow)`;
    card.innerHTML = `
      <div style="background:${c.bg};padding:1rem 1.1rem 1.1rem;position:relative;overflow:hidden">
        <div style="position:absolute;top:-18px;right:-18px;width:72px;height:72px;background:rgba(255,255,255,.1);border-radius:50%"></div>
        <div style="position:absolute;bottom:-12px;left:30%;width:48px;height:48px;background:rgba(255,255,255,.08);border-radius:50%"></div>
        <div style="width:38px;height:38px;background:rgba(255,255,255,.18);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;margin-bottom:.6rem;position:relative">${c.icon}</div>
        <div style="color:#fff;font-weight:800;font-size:.92rem;line-height:1.35;position:relative;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${l.name}</div>
      </div>
      <div style="padding:.75rem 1rem;display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;gap:.6rem">
          <span style="display:flex;align-items:center;gap:.3rem;background:${c.light};color:var(--text);font-size:.75rem;font-weight:700;padding:.25rem .6rem;border-radius:8px">🎬 ${vc}</span>
          <span style="display:flex;align-items:center;gap:.3rem;background:${c.light};color:var(--text);font-size:.75rem;font-weight:700;padding:.25rem .6rem;border-radius:8px">📄 ${dc}</span>
        </div>
        <span style="font-size:.8rem;color:var(--primary);font-weight:700">Xem →</span>
      </div>`;
    card.addEventListener('mouseenter', () => { card.style.transform = 'translateY(-3px)'; card.style.boxShadow = '0 8px 24px rgba(0,0,0,.12)'; });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; card.style.boxShadow = 'var(--shadow)'; });
    card.addEventListener('click', () => { showPage('lessons'); openLessonDetail(l.id); });
    grid.appendChild(card);
  });
}

// ---- Danh sách bài học ----
let _lessonCache = null; // Cache data để tìm kiếm realtime

async function renderLessonList(forceRefresh = false) {
  document.getElementById('sLessonListView').style.display = '';
  document.getElementById('sLessonDetailView').style.display = 'none';

  // Chỉ fetch lại khi cần
  if (!_lessonCache || forceRefresh) {
    let query = db.from('lessons').select('*').order('group_name',{ascending:true}).order('created_at',{ascending:false}).limit(5000);
    if (myClasses.length === 1) query = query.eq('class_name', myClasses[0]);
    else if (myClasses.length > 1) query = query.in('class_name', myClasses);
    const { data: list } = await query;

    const lessonIds = (list||[]).map(l => l.id);
    const [{ data: allVids }, { data: allDocs }, { data: allGroups }] = await Promise.all([
      lessonIds.length ? db.from('lesson_videos').select('lesson_id').in('lesson_id', lessonIds) : { data: [] },
      lessonIds.length ? db.from('lesson_docs').select('lesson_id').in('lesson_id', lessonIds) : { data: [] },
      db.from('lesson_groups').select('*').order('name'),
    ]);
    _lessonCache = { list: list||[], allVids: allVids||[], allDocs: allDocs||[], allGroups: allGroups||[] };
  }

  renderLessonListFromCache();
}

function renderLessonListFromCache() {
  const { list, allVids, allDocs, allGroups } = _lessonCache;
  const el = document.getElementById('sLessonList');
  el.innerHTML = '';

  // Lọc theo search
  const q = (document.getElementById('sLessonSearch')?.value||'').toLowerCase().trim();
  const filtered = q ? list.filter(l => l.name.toLowerCase().includes(q) || (l.description||'').toLowerCase().includes(q)) : list;

  document.getElementById('sEmptyLessons').style.display = filtered.length?'none':'block';
  if (!filtered.length) return;
  const vcMap = {}, dcMap = {};
  (allVids||[]).forEach(v => { vcMap[v.lesson_id] = (vcMap[v.lesson_id]||0)+1; });
  (allDocs||[]).forEach(d => { dcMap[d.lesson_id] = (dcMap[d.lesson_id]||0)+1; });

  const colors = [
    { gc:'#6366f1', gcLight:'#eef2ff', gcGlow:'rgba(99,102,241,.15)' },
    { gc:'#0ea5e9', gcLight:'#e0f2fe', gcGlow:'rgba(14,165,233,.15)' },
    { gc:'#10b981', gcLight:'#d1fae5', gcGlow:'rgba(16,185,129,.15)' },
    { gc:'#f59e0b', gcLight:'#fef3c7', gcGlow:'rgba(245,158,11,.15)' },
    { gc:'#ec4899', gcLight:'#fce7f3', gcGlow:'rgba(236,72,153,.15)' },
    { gc:'#8b5cf6', gcLight:'#ede9fe', gcGlow:'rgba(139,92,246,.15)' },
  ];

  const grid = document.createElement('div');
  grid.className = 'group-card-grid';
  el.appendChild(grid);

  // Lấy bài học theo nhóm — ưu tiên group_id, fallback group_name cho dữ liệu cũ
  function getLessonsForGroup(gId, gName) {
    return filtered.filter(l => {
      if (l.group_id) return l.group_id === gId;
      return l.group_name === gName;
    });
  }

  // Lấy yêu thích 1 lần
  let favSet = new Set();
  db.from('lesson_favorites').select('lesson_id').eq('username', currentUser)
    .then(({ data }) => { favSet = new Set((data||[]).map(f => f.lesson_id)); });

  function buildLessonItem(l, idx) {
    const vc = vcMap[l.id]||0, dc = dcMap[l.id]||0;
    const item = document.createElement('div');
    item.className = 'group-lesson-item';
    const num = document.createElement('div'); num.className = 'group-lesson-num'; num.textContent = idx + 1;
    const info = document.createElement('div'); info.className = 'group-lesson-info';
    info.innerHTML = `<div class="group-lesson-title"><span style="margin-right:.35rem">📚</span>${l.name}</div>
      <div class="group-lesson-stats"><span>🎬 ${vc}</span><span>📄 ${dc}</span></div>`;
    const favBtn = document.createElement('button');
    favBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:1.1rem;padding:.2rem .3rem;flex-shrink:0;line-height:1;transition:transform .15s';
    favBtn.textContent = favSet.has(l.id) ? '❤️' : '🤍';
    favBtn.addEventListener('click', async e => {
      e.stopPropagation();
      const nowFav = favBtn.textContent === '❤️';
      favBtn.style.transform = 'scale(1.4)';
      setTimeout(() => { favBtn.style.transform = ''; }, 200);
      if (nowFav) {
        favBtn.textContent = '🤍';
        await db.from('lesson_favorites').delete().eq('username', currentUser).eq('lesson_id', l.id);
      } else {
        favBtn.textContent = '❤️';
        await db.from('lesson_favorites').insert({ username: currentUser, lesson_id: l.id });
      }
    });
    const openBtn = document.createElement('button');
    openBtn.className = 'group-lesson-open'; openBtn.textContent = '→';
    openBtn.addEventListener('click', e => { e.stopPropagation(); openLessonDetail(l.id); });
    item.appendChild(num); item.appendChild(info); item.appendChild(favBtn); item.appendChild(openBtn);
    item.addEventListener('click', () => openLessonDetail(l.id));
    return item;
  }

  function buildGroupCard(g, depth, colorIdx) {
    const c = colors[colorIdx % colors.length];
    const children = (allGroups||[]).filter(x => x.parent_id === g.id);
    const directLessons = getLessonsForGroup(g.id, g.name);
    // Bỏ qua nhóm không có nội dung gì
    if (!directLessons.length && !children.length) return null;

    const card = document.createElement('div');
    card.className = 'group-card';
    card.dataset.groupId = String(g.id);
    card.style.setProperty('--gc', c.gc);
    card.style.setProperty('--gc-light', c.gcLight);
    card.style.setProperty('--gc-glow', c.gcGlow);
    if (depth > 0) card.style.marginLeft = (depth * 16) + 'px';
    const iconEl = document.createElement('div');
    iconEl.className = 'group-card-icon';
    const icons = ['📚','🎯','🔥','💡','⭐','🚀','📖','🏆'];
    iconEl.textContent = icons[(colorIdx + depth) % icons.length];
    const bodyEl = document.createElement('div');
    bodyEl.className = 'group-card-body';
    const depthBadge = depth === 1
      ? '<span style="font-size:.62rem;background:rgba(99,102,241,.12);color:var(--primary);padding:.1rem .4rem;border-radius:4px;margin-left:.4rem;font-weight:700">Nhóm con</span>'
      : depth === 2
      ? '<span style="font-size:.62rem;background:rgba(16,185,129,.12);color:#059669;padding:.1rem .4rem;border-radius:4px;margin-left:.4rem;font-weight:700">Nhóm cháu</span>'
      : '';
    bodyEl.innerHTML = `<div class="group-card-name">${g.name}${depthBadge}</div>
      <div class="group-card-meta"><span class="group-card-count">${children.length ? children.length + ' nhóm con • ' : ''}${directLessons.length} bài học</span></div>`;
    const chevron = document.createElement('div');
    chevron.className = 'group-card-chevron'; chevron.textContent = '▼';
    const header = document.createElement('div');
    header.className = 'group-card-header';
    header.appendChild(iconEl); header.appendChild(bodyEl); header.appendChild(chevron);

    const lessonList = document.createElement('div');
    lessonList.className = 'group-lesson-list';
    const inner = document.createElement('div');
    inner.className = 'group-lesson-list-inner';
    lessonList.appendChild(inner);

    let expanded = !!q;
    if (expanded) { card.classList.add('open'); lessonList.classList.add('open'); }

    function loadContent() {
      if (inner.dataset.loaded) return;
      inner.dataset.loaded = '1';
      // Nhóm con trước
      if (children.length && depth < 2) {
        children.forEach((ch, ci) => {
          const childCard = buildGroupCard(ch, depth + 1, colorIdx + ci + 1);
          if (childCard) inner.appendChild(childCard);
        });
      }
      // Bài học trực tiếp
      directLessons.forEach((l, idx) => inner.appendChild(buildLessonItem(l, idx)));
      if (!children.length && !directLessons.length) {
        const msg = document.createElement('div'); msg.className = 'group-empty-msg'; msg.textContent = 'Chưa có nội dung.';
        inner.appendChild(msg);
      }
    }

    if (expanded) loadContent();
    header.addEventListener('click', () => {
      expanded = !expanded;
      card.classList.toggle('open', expanded);
      lessonList.classList.toggle('open', expanded);
      if (expanded) loadContent();
    });

    card.appendChild(header); card.appendChild(lessonList);
    return card;
  }

  // Bài học không thuộc nhóm nào
  const ungrouped = filtered.filter(l => !l.group_id && !l.group_name);

  // Render nhóm gốc
  const roots = (allGroups||[]).filter(g => !g.parent_id);
  roots.forEach((g, gi) => {
    const card = buildGroupCard(g, 0, gi);
    if (card) grid.appendChild(card);
  });

  // Render bài học không nhóm
  if (ungrouped.length) {
    const c = colors[roots.length % colors.length];
    const card = document.createElement('div');
    card.className = 'group-card';
    card.style.setProperty('--gc', c.gc);
    card.style.setProperty('--gc-light', c.gcLight);
    card.style.setProperty('--gc-glow', c.gcGlow);
    const header = document.createElement('div'); header.className = 'group-card-header';
    const iconEl = document.createElement('div'); iconEl.className = 'group-card-icon'; iconEl.textContent = '📋';
    const bodyEl = document.createElement('div'); bodyEl.className = 'group-card-body';
    bodyEl.innerHTML = `<div class="group-card-name">Bài học khác</div><div class="group-card-meta"><span class="group-card-count">${ungrouped.length} bài học</span></div>`;
    const chevron = document.createElement('div'); chevron.className = 'group-card-chevron'; chevron.textContent = '▼';
    header.appendChild(iconEl); header.appendChild(bodyEl); header.appendChild(chevron);
    const lessonList = document.createElement('div'); lessonList.className = 'group-lesson-list';
    const inner = document.createElement('div'); inner.className = 'group-lesson-list-inner';
    lessonList.appendChild(inner);
    let expanded = !!q;
    if (expanded) { card.classList.add('open'); lessonList.classList.add('open'); inner.dataset.loaded = '1'; ungrouped.forEach((l, i) => inner.appendChild(buildLessonItem(l, i))); }
    header.addEventListener('click', () => {
      expanded = !expanded;
      card.classList.toggle('open', expanded);
      lessonList.classList.toggle('open', expanded);
      if (expanded && !inner.dataset.loaded) { inner.dataset.loaded = '1'; ungrouped.forEach((l, i) => inner.appendChild(buildLessonItem(l, i))); }
    });
    card.appendChild(header); card.appendChild(lessonList);
    grid.appendChild(card);
  }

  // Khôi phục scroll và nhóm đang mở khi quay lại từ bài học
  const savedScroll = sessionStorage.getItem('st_lesson_scroll');
  const savedGroups = JSON.parse(sessionStorage.getItem('st_open_groups') || '[]');
  if (savedGroups.length || savedScroll) {
    requestAnimationFrame(() => {
      // Click vào header để mở lại nhóm
      savedGroups.forEach(gid => {
        const card = document.querySelector(`.group-card[data-group-id="${gid}"]`);
        if (card && !card.classList.contains('open')) {
          const header = card.querySelector('.group-card-header');
          if (header) header.click();
        }
      });
      // Khôi phục scroll
      if (savedScroll) {
        setTimeout(() => {
          const page = document.getElementById('pageLessons');
          if (page) page.scrollTop = parseInt(savedScroll);
        }, 80);
      }
      sessionStorage.removeItem('st_lesson_scroll');
      sessionStorage.removeItem('st_open_groups');
    });
  }
}

function getEmbedUrl(url) {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1`;
  const gd = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (gd) return `https://drive.google.com/file/d/${gd[1]}/preview`;
  return null;
}

// Helper: lấy link download từ Google Drive
function getDownloadUrl(url) {
  if (!url) return null;
  const gd = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (gd) return `https://drive.google.com/uc?export=download&id=${gd[1]}`;
  return null;
}

// ---- Chi tiết bài học ----
// ---- Ghi log truy cap ----
function logAccess(lessonId, lessonName, contentId, contentTitle, contentType) {
  db.from('access_logs').insert({
    username: currentUser,
    student_name: currentName,
    class_name: myClasses[0] || myClass || '',
    lesson_id: lessonId,
    lesson_name: lessonName,
    content_id: contentId,
    content_title: contentTitle,
    content_type: contentType
  }).then(() => {}).catch(() => {});
}
async function openLessonDetail(id) {
  sessionStorage.setItem('st_lesson_id', id);
  // Lưu scroll position và nhóm đang mở
  const page = document.getElementById('pageLessons');
  if (page) sessionStorage.setItem('st_lesson_scroll', page.scrollTop);
  const openGroups = [...document.querySelectorAll('.group-card.open')].map(c => c.dataset.groupId).filter(Boolean);
  sessionStorage.setItem('st_open_groups', JSON.stringify(openGroups));
  // Hiện view ngay, load song song
  document.getElementById('sLessonListView').style.display = 'none';
  document.getElementById('sLessonDetailView').style.display = '';
  document.getElementById('sLessonDetailTitle').textContent = '...';
  document.getElementById('sLessonDetailDesc').textContent  = '';

  // 3 query song song
  const [{ data:l }, { data:vids }, { data:docs }] = await Promise.all([
    db.from('lessons').select('*').eq('id',id).single(),
    db.from('lesson_videos').select('*').eq('lesson_id',id).order('created_at'),
    db.from('lesson_docs').select('*').eq('lesson_id',id).order('created_at'),
  ]);

  if (!l) return;
  document.getElementById('sLessonDetailTitle').textContent = l.name;
  document.getElementById('sLessonDetailDesc').textContent  = l.description||'';

  // Render video — decrypt song song
  const vGrid = document.getElementById('sLessonVideoGrid');
  vGrid.innerHTML = '';
  document.getElementById('sEmptyLessonVideos').style.display = (vids||[]).length?'none':'block';
  const vidUrls = await Promise.all((vids||[]).map(v =>
    v.video_url ? decryptUrl(v.video_url) : Promise.resolve(db.storage.from('lessons').getPublicUrl(v.storage_path).data.publicUrl)
  ));
  (vids||[]).forEach((v, idx) => {
    const isLink = !!v.video_url;
    const url = vidUrls[idx];
    const card = document.createElement('div');
    card.className = 'video-card';
    if (isLink && getEmbedUrl(url)) {
      card.innerHTML = `
        <div class="video-thumb" style="background:linear-gradient(135deg,#1e1b4b,#312e81);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:.5rem;position:relative">
          <div style="width:52px;height:52px;background:rgba(255,255,255,.15);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.5rem;border:2px solid rgba(255,255,255,.3)">▶</div>
          <span style="color:rgba(255,255,255,.8);font-size:.75rem;font-weight:600">Nhấn để xem</span>
          <div style="position:absolute;top:8px;left:8px;background:#ef4444;color:#fff;font-size:.65rem;font-weight:700;padding:.2rem .5rem;border-radius:6px">VIDEO</div>
        </div>
        <div class="video-info">
          <div class="video-title">${v.title}</div>
          <div style="font-size:.75rem;color:var(--muted);margin-top:.2rem">Bài ${idx+1}</div>
        </div>`;
    } else {
      card.innerHTML = `
        <div class="video-thumb" style="position:relative">
          <video src="${url}" preload="none"></video>
          <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.6) 0%,transparent 50%);display:flex;align-items:center;justify-content:center">
            <div style="width:52px;height:52px;background:rgba(255,255,255,.2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.4rem;border:2px solid rgba(255,255,255,.4);backdrop-filter:blur(4px)">▶</div>
          </div>
          <div style="position:absolute;top:8px;left:8px;background:#ef4444;color:#fff;font-size:.65rem;font-weight:700;padding:.2rem .5rem;border-radius:6px">VIDEO</div>
        </div>
        <div class="video-info">
          <div class="video-title">${v.title}</div>
          <div style="font-size:.75rem;color:var(--muted);margin-top:.2rem">Bài ${idx+1}</div>
        </div>`;
    }
    card.querySelector('.video-thumb').addEventListener('click', () => {
      logAccess(id, l.name, v.id, v.title, 'video');
      openViewer(v.title, url, v.file_name, isLink ? 'link' : 'video');
    });
    vGrid.appendChild(card);
  });

  // Render tài liệu — decrypt song song
  const dList = document.getElementById('sLessonDocList');
  dList.innerHTML = '';
  document.getElementById('sEmptyLessonDocs').style.display = (docs||[]).length?'none':'block';
  const docUrls = await Promise.all((docs||[]).map(d =>
    (d.file_type==='link'||d.file_type==='handwritten') ? decryptUrl(d.doc_url) : Promise.resolve(db.storage.from('lessons').getPublicUrl(d.storage_path).data.publicUrl)
  ));
  (docs||[]).forEach((d, di) => {
    const isLink = d.file_type==='link';
    const isHandwritten = d.file_type==='handwritten';
    const url = docUrls[di];

    const icon  = isHandwritten ? '✍️' : isLink ? '🔗' : '📄';
    const color = isHandwritten ? '#8b5cf6' : isLink ? '#0ea5e9' : '#f59e0b';
    const bg    = isHandwritten ? '#ede9fe' : isLink ? '#e0f2fe' : '#fef3c7';
    const label = isHandwritten ? 'Bản viết tay' : isLink ? 'Tài liệu online' : 'File tài liệu';

    const row = document.createElement('div');
    row.style.cssText = `display:flex;align-items:center;gap:.85rem;padding:.85rem 1rem;background:var(--card);border:1.5px solid var(--border);border-radius:12px;cursor:pointer;transition:all .15s;box-shadow:var(--shadow)`;
    row.innerHTML = `
      <div style="width:42px;height:42px;background:${bg};border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0">${icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.title}</div>
        <div style="font-size:.75rem;color:${color};font-weight:600;margin-top:.15rem">${label}</div>
      </div>
      <div style="background:${bg};color:${color};padding:.35rem .75rem;border-radius:8px;font-size:.78rem;font-weight:700;flex-shrink:0">Xem →</div>
    `;
    row.addEventListener('mouseenter', () => { row.style.borderColor = color; row.style.transform = 'translateX(3px)'; });
    row.addEventListener('mouseleave', () => { row.style.borderColor = 'var(--border)'; row.style.transform = ''; });
    row.addEventListener('click', () => {
      logAccess(id, l.name, d.id, d.title, 'doc');
      openViewer(d.title, url, d.file_name, isHandwritten?'handwritten-link':isLink?'doc-link':d.file_type);
    });
    dList.appendChild(row);
  });
}
document.getElementById('sBackToLessonsBtn').addEventListener('click', () => {
  sessionStorage.removeItem('st_lesson_id');
  _lessonCache = null; // Reset cache để fetch mới
  renderLessonList();
});
document.getElementById('sLessonSearch').addEventListener('input', debounce(renderLessonListFromCache, 200));

// ---- Viewer ----
function openViewer(title, url, fileName, fileType) {
  const isVideo = fileType==='video'||(fileType||'').startsWith('video/');
  const isLink = fileType==='link';
  const isDocLink = fileType==='doc-link';
  const isHandwrittenLink = fileType==='handwritten-link';

  let displayTitle = title;
  if (isVideo || isLink) displayTitle = 'Video bài học';
  else if (isHandwrittenLink) displayTitle = 'Bản viết tay';
  else if (isDocLink || fileType==='application/pdf' || (fileType||'').startsWith('image/')) displayTitle = 'Tài liệu';

  document.getElementById('viewerTitle').textContent = displayTitle;
  const body = document.getElementById('viewerBody');
  const dl = document.getElementById('viewerDownload');
  dl.style.display = 'none';
  body.innerHTML = '';

  // Loading spinner
  const loading = document.createElement('div');
  loading.id = 'viewerLoading';
  loading.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.75rem;background:#0f172a;z-index:10;border-radius:10px';
  loading.innerHTML = `<div style="width:40px;height:40px;border:3px solid rgba(99,102,241,.3);border-top-color:#6366f1;border-radius:50%;animation:spin .8s linear infinite"></div><div style="color:rgba(255,255,255,.7);font-size:.88rem;font-weight:600">${isVideo||isLink?'⏳ Đang tải video...':'⏳ Đang tải tài liệu...'}</div>`;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;flex:1;min-height:0;display:flex;flex-direction:column';
  wrap.appendChild(loading);
  body.appendChild(wrap);

  const hideLoading = () => { const ld = document.getElementById('viewerLoading'); if(ld) ld.remove(); };

  if (isLink) {
    // Video (YouTube/Drive/Embed) — set src qua JS
    const embed = getEmbedUrl(url) || url; // nếu là embed URL thì dùng thẳng
    if (embed) {
      body.insertBefore(Object.assign(document.createElement('div'), {
        style: 'background:#fffbeb;border-left:3px solid #f59e0b;padding:.5rem .85rem;border-radius:8px;margin-bottom:.5rem;font-size:.8rem;color:#92400e;flex-shrink:0',
        innerHTML: '💡 Video bị mờ? Nhấn ⚙️ → <b>Chất lượng</b> → tăng lên <b>720p hoặc 1080p</b>'
      }), wrap);
      const iframeWrap = document.createElement('div');
      iframeWrap.style.cssText = 'position:relative;flex:1;min-height:0;overflow:hidden';
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;border:none';
      iframe.allowFullscreen = true;
      iframe.onload = hideLoading;
      iframeWrap.appendChild(iframe);
      wrap.appendChild(iframeWrap);
      setTimeout(() => { iframe.src = embed; }, 0);
    } else {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'flex:1;width:100%;height:100%;border:none;border-radius:8px';
      iframe.onload = hideLoading;
      wrap.appendChild(iframe);
      setTimeout(() => { iframe.src = url; }, 0);
    }
  } else if (isDocLink || isHandwrittenLink) {
    const dlUrl = getDownloadUrl(url);
    if (dlUrl) { dl.style.display=''; dl.href=dlUrl; dl.removeAttribute('download'); dl.target='_blank'; }
    const embed = getEmbedUrl(url);
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'flex:1;width:100%;height:100%;border:none;border-radius:8px';
    iframe.allowFullscreen = true;
    iframe.onload = hideLoading;
    wrap.appendChild(iframe);
    setTimeout(() => { iframe.src = embed || url; }, 0);
  } else if (isVideo) {
    const video = document.createElement('video');
    video.controls = true;
    video.setAttribute('controlsList', 'nodownload noremoteplayback');
    video.setAttribute('playsinline', '');
    video.oncontextmenu = () => false;
    video.style.cssText = 'flex:1;width:100%;background:#000';
    video.oncanplay = hideLoading;
    wrap.appendChild(video);
    setTimeout(() => { video.src = url; }, 0);
    if (window.innerWidth < 768 && window.innerHeight > window.innerWidth) {
      const tip = document.createElement('div');
      tip.style.cssText = 'background:#fff3cd;color:#856404;padding:.6rem 1rem;border-radius:8px;margin-bottom:.5rem;font-size:.85rem;text-align:center;flex-shrink:0';
      tip.textContent = '📱 Vui lòng chuyển điện thoại sang ngang để có trải nghiệm học tốt nhất';
      body.insertBefore(tip, wrap);
      const onOrient = () => { if (window.innerWidth > window.innerHeight) { tip.remove(); window.removeEventListener('resize', onOrient); } };
      window.addEventListener('resize', onOrient);
    }
  } else if (fileType==='application/pdf') {
    dl.style.display = '';
    const iframe = document.createElement('iframe');
    iframe.className = 'viewer-iframe';
    iframe.onload = hideLoading;
    wrap.appendChild(iframe);
    setTimeout(() => { iframe.src = url; }, 0);
  } else if ((fileType||'').startsWith('image/')) {
    dl.style.display = '';
    const img = document.createElement('img');
    img.className = 'viewer-img';
    img.alt = title;
    img.onload = hideLoading;
    wrap.appendChild(img);
    setTimeout(() => { img.src = url; }, 0);
  } else {
    dl.style.display = '';
    body.innerHTML = '<p class="muted-center">⚠️ Không xem trực tiếp được. Vui lòng tải xuống.</p>';
  }
  document.getElementById('viewerModal').classList.add('open');
  // Tạm tắt DevTools detection khi modal mở
  if (typeof _dtPaused !== 'undefined') _dtPaused = true;
  // Hiện nút xoay trên mobile
  const rotateBtn = document.getElementById('viewerRotateBtn');
  if (rotateBtn) {
    rotateBtn.style.display = window.innerWidth <= 768 ? '' : 'none';
    rotateBtn.textContent = '🔄 Xoay ngang';
    _viewerRotated = false;
  }
}
document.getElementById('closeViewer').addEventListener('click', closeViewer);
document.getElementById('viewerModal').addEventListener('click', e => { if(e.target===document.getElementById('viewerModal')) closeViewer(); });
function closeViewer() { 
  document.getElementById('viewerModal').classList.remove('open'); 
  document.getElementById('viewerBody').innerHTML='';
  document.getElementById('viewerRotateBtn').style.display = 'none';
  _viewerRotated = false;
  if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
  // Resume DevTools detection
  if (typeof _dtPaused !== 'undefined') {
    _dtPaused = false;
    if (typeof _dtOpen !== 'undefined') _dtOpen = false;
    document.body.style.filter = '';
    document.body.style.pointerEvents = '';
  }
}

// Xoay viewer
let _viewerRotated = false;
document.getElementById('viewerRotateBtn')?.addEventListener('click', () => {
  _viewerRotated = !_viewerRotated;
  const body = document.getElementById('viewerBody');
  const modal = document.querySelector('.viewer-modal');
  if (_viewerRotated) {
    body.style.transform = 'rotate(90deg)';
    body.style.transformOrigin = 'center center';
    body.style.width = '80vh';
    body.style.height = '80vw';
    body.style.margin = 'auto';
    document.getElementById('viewerRotateBtn').textContent = '🔄 Xoay dọc';
  } else {
    body.style.transform = '';
    body.style.width = '';
    body.style.height = '';
    body.style.margin = '';
    document.getElementById('viewerRotateBtn').textContent = '🔄 Xoay ngang';
  }
});

// ---- Init ----
loadMe().then(() => {
  const savedPage = sessionStorage.getItem('st_page') || 'home';
  const savedLesson = sessionStorage.getItem('st_lesson_id');
  if (savedPage === 'lessons' && savedLesson) {
    // Kích hoạt trang lessons trước rồi mở bài
    currentSection = 'lessons';
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.slink').forEach(l => l.classList.remove('active'));
    const el = document.getElementById('pageLessons');
    if (el) el.classList.add('active');
    document.querySelectorAll('[data-page="lessons"]').forEach(l => l.classList.add('active'));
    openLessonDetail(parseInt(savedLesson));
  } else {
    showPage(savedPage);
  }
  checkNewNotifications(true);
});

// Realtime: lắng nghe thay đổi active của tài khoản này
db.channel('student-lock-' + currentUser)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'students',
    filter: `username=eq.${currentUser}`
  }, async (payload) => {
    const s = payload.new;
    if (!s.active) {
      if (typeof _wmDestroyed !== 'undefined') _wmDestroyed = true;
      await setOffline();
      sessionStorage.clear();
      document.body.innerHTML = `
        <div style="position:fixed;inset:0;background:#0f172a;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.25rem;text-align:center;padding:2rem;z-index:99999">
          <div style="font-size:3.5rem">🔒</div>
          <div style="color:#ef4444;font-size:1.3rem;font-weight:800">Tài khoản đã bị khóa</div>
          <div style="color:rgba(255,255,255,.75);font-size:.95rem;max-width:320px;line-height:1.7">
            Tài khoản của bạn vừa bị khóa bởi quản trị viên.<br/>
            Vui lòng liên hệ <b style="color:#fff">Trợ Lý Trần Cường hoặc Quốc Toàn</b> để được hỗ trợ.
          </div>
          <div id="_lockCountdown" style="color:rgba(255,255,255,.5);font-size:.85rem">Tự động chuyển về đăng nhập sau <b style="color:#fff">3</b> giây...</div>
          <button onclick="location.href='index.html'" style="margin-top:.5rem;background:#6366f1;color:#fff;border:none;padding:.75rem 2rem;border-radius:10px;font-size:1rem;font-weight:700;cursor:pointer">
            Về trang đăng nhập
          </button>
        </div>`;
      let _c = 3;
      const _t = setInterval(() => {
        _c--;
        const el = document.getElementById('_lockCountdown');
        if (el) el.innerHTML = `Tự động chuyển về đăng nhập sau <b style="color:#fff">${_c}</b> giây...`;
        if (_c <= 0) { clearInterval(_t); location.href = 'index.html'; }
      }, 1000);
    }
  })
  .subscribe();

// Realtime: lắng nghe bảo trì — out ngay không cần reload
db.channel('maintenance-watch')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'app_settings',
    filter: 'key=eq.maintenance'
  }, async (payload) => {
    const val = payload.new?.value;
    if (val === 'true') _showMaintenanceScreen();
  })
  .subscribe();

// Polling backup mỗi 10 giây — đảm bảo hoạt động dù Realtime chưa bật
let _maintenanceShown = false;
function _showMaintenanceScreen() {
  if (_maintenanceShown) return;
  _maintenanceShown = true;
  if (typeof _wmDestroyed !== 'undefined') _wmDestroyed = true;
  setOffline().catch(()=>{});
  sessionStorage.clear();
  document.body.style.cssText = 'margin:0;padding:0;overflow:hidden';
  document.body.innerHTML = `
    <div style="min-height:100vh;width:100vw;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1e1b4b,#312e81);padding:2rem;box-sizing:border-box">
      <div style="background:#fff;border-radius:20px;padding:2.5rem 2rem;text-align:center;max-width:420px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,.3)">
        <img src="btht.png" alt="Bảo trì" style="width:100%;border-radius:12px;margin-bottom:1.25rem"/>
        <div style="font-size:1.3rem;font-weight:800;color:#1e1b4b;margin-bottom:.75rem">Hệ thống đang bảo trì</div>
        <div style="font-size:.9rem;color:#64748b;line-height:1.7;margin-bottom:1.5rem">
          Chúng tôi đang nâng cấp hệ thống để phục vụ bạn tốt hơn.<br/>
          Vui lòng quay lại sau ít phút.
        </div>
        <div style="font-size:.82rem;color:#94a3b8">Liên hệ trợ lý nếu cần hỗ trợ gấp.</div>
      </div>
    </div>`;
}

setInterval(async () => {
  try {
    const { data } = await db.from('app_settings').select('value').eq('key', 'maintenance').maybeSingle();
    if (data?.value === 'true') _showMaintenanceScreen();
  } catch(e) {}
}, 10000);

// Realtime: lắng nghe thông báo mới từ admin
// ============================================================
// THÔNG BÁO RIÊNG
// ============================================================

async function renderNotifications() {
  const [{ data: anns }, { data: reads }] = await Promise.all([
    db.from('announcements').select('*').order('created_at', { ascending: false }),
    db.from('notification_reads').select('announcement_id').eq('username', currentUser)
  ]);

  const readSet = new Set((reads || []).map(r => r.announcement_id));
  const now = new Date();
  const myAnns = (anns || []).filter(a =>
    (!a.expires_at || new Date(a.expires_at) > now) &&
    (a.target_username ? a.target_username === currentUser : (!a.class_name || a.class_name === myClass))
  );
  const list = document.getElementById('notiPageList');
  const empty = document.getElementById('notiPageEmpty');
  if (!list) return;

  if (!myAnns.length) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  list.innerHTML = '';

  myAnns.forEach(a => {
    const isRead = readSet.has(a.id);
    const card = document.createElement('div');
    card.style.cssText = `background:${isRead ? 'var(--card)' : (a.pinned ? '#fffbeb' : '#f0f4ff')};border:1.5px solid ${isRead ? 'var(--border)' : (a.pinned ? '#f59e0b' : '#6366f1')};border-radius:14px;padding:1rem 1.1rem;box-shadow:${isRead ? 'var(--shadow)' : '0 4px 20px rgba(99,102,241,.2)'};cursor:pointer;transition:all .2s;opacity:${isRead ? '.7' : '1'}${!isRead ? ';transform:scale(1.01)' : ''}`;
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem">
        ${a.pinned ? '<span style="background:#fef3c7;color:#d97706;font-size:.7rem;font-weight:700;padding:.15rem .5rem;border-radius:6px">📌 Ghim</span>' : ''}
        ${a.class_name ? `<span class="class-tag" style="font-size:.72rem">${a.class_name}</span>` : '<span style="background:#e0f2fe;color:#0369a1;font-size:.7rem;font-weight:700;padding:.15rem .5rem;border-radius:6px">Tất cả lớp</span>'}
        ${!isRead ? '<span style="width:8px;height:8px;background:#ef4444;border-radius:50%;flex-shrink:0;margin-left:2px"></span>' : ''}
        <span style="margin-left:auto;font-size:.72rem;color:var(--muted)">${new Date(a.created_at).toLocaleDateString('vi-VN')}</span>
      </div>
      <div style="font-weight:${isRead ? '600' : '800'};font-size:.95rem;margin-bottom:.35rem;color:${isRead ? 'var(--muted)' : 'var(--text)'}">${a.title}</div>
      <div style="font-size:.85rem;color:var(--text);line-height:1.7;white-space:pre-line">${a.content}</div>
      ${a.link_url ? `<a href="${a.link_url}" target="_blank" style="display:inline-block;margin-top:.5rem;background:#eef2ff;color:#6366f1;padding:.35rem .85rem;border-radius:8px;font-size:.82rem;font-weight:700;text-decoration:none">🔗 ${a.link_text||'Xem tại đây'}</a>` : ''}
      ${!isRead ? '<div style="margin-top:.6rem;font-size:.75rem;color:#6366f1;font-weight:600">Nhấn để đánh dấu đã đọc ✓</div>' : '<div style="margin-top:.4rem;font-size:.72rem;color:var(--muted)">✓ Đã đọc</div>'}
    `;
    if (!isRead) {
      card.addEventListener('click', async () => {
        await db.from('notification_reads').upsert({ username: currentUser, announcement_id: a.id }, { onConflict: 'username,announcement_id' });
        readSet.add(a.id);
        renderNotifications();
        checkNewNotifications();
      });
    }
    list.appendChild(card);
  });

  updateNotiBadge(false);
}

function updateNotiBadge(hasNew) {
  const badge = document.getElementById('notiBadge');
  const dot = document.getElementById('sidebarNotiDot');
  if (badge) badge.style.display = hasNew ? 'block' : 'none';
  if (dot) dot.style.display = hasNew ? 'block' : 'none';
}

async function checkNewNotifications(showPopupIfUnread = false) {
  const { data: anns } = await db.from('announcements')
    .select('id, class_name, expires_at, target_username').order('created_at', { ascending: false });
  const myAnns = (anns || []).filter(a =>
    (!a.expires_at || new Date(a.expires_at) > new Date()) &&
    (a.target_username ? a.target_username === currentUser : (!a.class_name || a.class_name === myClass))
  );

  const { data: reads } = await db.from('notification_reads')
    .select('announcement_id').eq('username', currentUser);
  const readSet = new Set((reads || []).map(r => r.announcement_id));
  const hasUnread = myAnns.some(a => !readSet.has(a.id));
  updateNotiBadge(hasUnread);

  if (showPopupIfUnread && hasUnread) {
    showAnnouncementToast();
  }
}

// Nút chuông trên topbar
document.getElementById('notiBtn').addEventListener('click', () => showPage('notifications'));

// Dark mode học viên
const studentDarkBtn = document.getElementById('studentDarkBtn');
if (localStorage.getItem('st_dark') === '1') { document.body.classList.add('dark-mode'); studentDarkBtn.textContent = '☀️'; }
studentDarkBtn?.addEventListener('click', () => {
  const on = document.body.classList.toggle('dark-mode');
  studentDarkBtn.textContent = on ? '☀️' : '🌙';
  localStorage.setItem('st_dark', on ? '1' : '0');
});

// Realtime thông báo
db.channel('announcements-realtime')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
    if (document.getElementById('pageHome')?.classList.contains('active')) renderHome();
    if (document.getElementById('pageNotifications')?.classList.contains('active')) renderNotifications();
    else {
      updateNotiBadge(true);
      showAnnouncementToast();
    }
  })
  .subscribe();

async function showAnnouncementToast(ann = null) {
  // Nếu không truyền ann thì lấy thông báo mới nhất chưa đọc
  if (!ann) {
    const { data: anns } = await db.from('announcements')
      .select('*').order('created_at', { ascending: false }).limit(20);
    const { data: reads } = await db.from('notification_reads')
      .select('announcement_id').eq('username', currentUser);
    const readSet = new Set((reads||[]).map(r => r.announcement_id));
    const now = new Date();
    ann = (anns||[]).find(a =>
      !readSet.has(a.id) &&
      (!a.expires_at || new Date(a.expires_at) > now) &&
      (a.target_username ? a.target_username === currentUser : (!a.class_name || myClasses.includes(a.class_name)))
    );
    if (!ann) return;
  }

  const existing = document.getElementById('annToast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'annToast';
  toast.style.cssText = `
    position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%) translateY(80px);
    z-index:9999;background:linear-gradient(135deg,#1e1b4b,#4338ca);color:#fff;
    padding:1rem 1.5rem;border-radius:16px;font-size:.9rem;font-weight:600;
    box-shadow:0 12px 40px rgba(0,0,0,.35);display:flex;align-items:center;gap:.85rem;
    max-width:360px;width:90%;cursor:pointer;
    transition:transform .4s cubic-bezier(.34,1.56,.64,1),opacity .3s;
    border:1px solid rgba(255,255,255,.15)`;
  toast.innerHTML = `
    <div style="width:40px;height:40px;background:rgba(255,255,255,.15);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0">📢</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:.78rem;opacity:.75;margin-bottom:.15rem">Thông báo mới từ giáo viên</div>
      <div style="font-size:.88rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${ann.title}</div>
    </div>
    <button style="background:rgba(255,255,255,.15);border:none;color:#fff;width:28px;height:28px;border-radius:8px;cursor:pointer;font-size:.9rem;flex-shrink:0" id="annToastClose">✕</button>`;

  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.transform = 'translateX(-50%) translateY(0)'; });

  toast.addEventListener('click', async e => {
    if (e.target.id === 'annToastClose') { dismissToast(); return; }
    // Đánh dấu đã đọc
    await db.from('notification_reads').upsert(
      { username: currentUser, announcement_id: ann.id },
      { onConflict: 'username,announcement_id' }
    );
    showPage('notifications');
    dismissToast();
    checkNewNotifications();
  });

  function dismissToast() {
    toast.style.transform = 'translateX(-50%) translateY(80px)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  }

  setTimeout(dismissToast, 8000);
}

// Kiểm tra session token + trạng thái tài khoản mỗi 30 giây
setInterval(async () => {
  const token = sessionStorage.getItem('dh_token');
  if (!token) return;

  const { data } = await db.from('students').select('session_token, active, class_name, expiry_date, manually_unlocked').eq('username', currentUser).single();
  if (!data) return;

  // Bị đăng nhập thiết bị khác — bỏ kiểm tra

  // Tài khoản bị khóa thủ công
  if (!data.active) {
    alert('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ trợ lý.');
    await setOffline();
    sessionStorage.clear();
    location.href = 'index.html';
    return;
  }

  // Hết hạn tài khoản cá nhân
  if (data.expiry_date) {
    const today = new Date(); today.setHours(0,0,0,0);
    const exp = new Date(data.expiry_date); exp.setHours(0,0,0,0);
    if (today > exp) {
      await db.from('students').update({ active: false }).eq('username', currentUser);
      alert('Tài khoản của bạn đã hết hạn. Vui lòng liên hệ trợ lý để gia hạn.');
      await setOffline();
      sessionStorage.clear();
      location.href = 'index.html';
      return;
    }
  }

  // Lớp học hết hạn — kiểm tra tất cả lớp
  if (data.class_name && !data.manually_unlocked) {
    const classes = data.class_name.split(',').map(c=>c.trim()).filter(Boolean);
    const { data: clsList } = await db.from('classes').select('name,end_date').in('name', classes);
    const today = new Date(); today.setHours(0,0,0,0);
    const allExpired = (clsList||[]).filter(c=>c.end_date).every(c => new Date(c.end_date) < today);
    if (allExpired && (clsList||[]).some(c=>c.end_date)) {
      await db.from('students').update({ active: false }).eq('username', currentUser);
      alert(`Tất cả khóa học đã kết thúc. Tài khoản đã bị khóa.`);
      await setOffline();
      sessionStorage.clear();
      location.href = 'index.html';
      return;
    }
  }
}, 30000);






// ============================================================
// TỰ ĐỘNG ĐĂNG XUẤT SAU 30 PHÚT KHÔNG THAO TÁC
// ============================================================
(function autoLogout() {
  const TIMEOUT = 30 * 60 * 1000; // 30 phút
  const WARN    = 60 * 1000;       // cảnh báo trước 60 giây
  let timer, warnTimer;

  const overlay = document.createElement('div');
  overlay.id = 'autoLogoutOverlay';
  overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99999;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:2rem 2.5rem;text-align:center;max-width:340px;box-shadow:0 24px 64px rgba(0,0,0,.3)">
      <div style="font-size:2.5rem;margin-bottom:.75rem">⏱️</div>
      <div style="font-weight:800;font-size:1.1rem;margin-bottom:.5rem;color:#0f172a">Phiên sắp hết hạn</div>
      <div style="font-size:.88rem;color:#64748b;margin-bottom:1.25rem">Bạn không hoạt động trong 30 phút.<br>Tự động đăng xuất sau <b id="alCountdown" style="color:#ef4444">60</b> giây.</div>
      <button id="alStayBtn" style="width:100%;padding:.75rem;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;border-radius:12px;font-size:.92rem;font-weight:700;cursor:pointer">Tiếp tục học</button>
    </div>`;
  document.body.appendChild(overlay);

  let countdown;
  function showWarning() {
    overlay.style.display = 'flex';
    let secs = 60;
    document.getElementById('alCountdown').textContent = secs;
    countdown = setInterval(() => {
      secs--;
      const el = document.getElementById('alCountdown');
      if (el) el.textContent = secs;
      if (secs <= 0) { clearInterval(countdown); logout(); }
    }, 1000);
  }

  async function logout() {
    clearInterval(countdown);
    overlay.style.display = 'none';
    await db.from('students').update({ is_online: false, last_seen: new Date().toISOString() }).eq('username', currentUser);
    sessionStorage.clear();
    location.href = 'index.html';
  }

  function reset() {
    clearTimeout(timer);
    clearTimeout(warnTimer);
    clearInterval(countdown);
    overlay.style.display = 'none';
    warnTimer = setTimeout(showWarning, TIMEOUT - WARN);
    timer     = setTimeout(logout, TIMEOUT);
  }

  document.getElementById('alStayBtn').addEventListener('click', reset);
  ['mousemove','keydown','click','touchstart','scroll'].forEach(e => document.addEventListener(e, reset, { passive: true }));
  reset();
})();


// ============================================================
// GREETING TRANG CHỦ (chỉ tablet/laptop)
// ============================================================
(function initStudentGreeting() {
  function update() {
    const now  = new Date();
    const h    = now.getHours();
    const name = sessionStorage.getItem('dh_name') || 'bạn';
    const greet = h < 12 ? '☀️ Chào buổi sáng' : h < 18 ? '🌤 Chào buổi chiều' : '🌙 Chào buổi tối';
    const days  = ['Chủ nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'];
    const dateStr = `${days[now.getDay()]}, ${now.toLocaleDateString('vi-VN')}`;
    const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const gt = document.getElementById('studentGreetingText');
    const gd = document.getElementById('studentGreetingDate');
    const gtime = document.getElementById('studentGreetingTime');
    if (gt) gt.textContent = `${greet}, ${name}!`;
    if (gd) gd.textContent = dateStr;
    if (gtime) gtime.textContent = timeStr;
  }
  update();
  setInterval(update, 1000);
})();


// ── Realtime: thông báo bài học mới ──
db.channel('student-new-lesson')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lessons' }, async (payload) => {
    const lesson = payload.new;
    // Chỉ hiện nếu bài học thuộc lớp của học viên hoặc không giới hạn lớp
    if (lesson.class_name && !myClasses.includes(lesson.class_name)) return;
    showNewLessonToast(lesson.name);
    // Reset cache để lần sau vào trang bài học sẽ fetch mới
    _lessonCache = null;
  })
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lesson_videos' }, async () => {
    _lessonCache = null; // Reset cache khi có video mới
  })
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lesson_docs' }, async () => {
    _lessonCache = null;
  })
  .subscribe();

function showNewLessonToast(lessonName) {
  const existing = document.getElementById('newLessonToast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'newLessonToast';
  toast.style.cssText = `
    position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%) translateY(80px);
    z-index:9999;background:linear-gradient(135deg,#059669,#047857);color:#fff;
    padding:1rem 1.5rem;border-radius:16px;font-size:.9rem;font-weight:600;
    box-shadow:0 12px 40px rgba(0,0,0,.3);display:flex;align-items:center;gap:.85rem;
    max-width:340px;width:90%;cursor:pointer;
    transition:transform .4s cubic-bezier(.34,1.56,.64,1),opacity .3s;
    border:1px solid rgba(255,255,255,.2)`;
  toast.innerHTML = `
    <div style="width:40px;height:40px;background:rgba(255,255,255,.2);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0">📚</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:.75rem;opacity:.85;margin-bottom:.15rem">Bài học mới vừa được đăng!</div>
      <div style="font-size:.88rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${lessonName}</div>
    </div>
    <button id="newLessonToastClose" style="background:rgba(255,255,255,.15);border:none;color:#fff;width:28px;height:28px;border-radius:8px;cursor:pointer;font-size:.9rem;flex-shrink:0">✕</button>`;

  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.transform = 'translateX(-50%) translateY(0)'; });

  function dismiss() {
    toast.style.transform = 'translateX(-50%) translateY(80px)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  }

  toast.addEventListener('click', e => {
    if (e.target.id === 'newLessonToastClose') { dismiss(); return; }
    showPage('lessons');
    dismiss();
  });
  document.getElementById('newLessonToastClose').addEventListener('click', dismiss);
  setTimeout(dismiss, 7000);
}

// ============================================================
// LỊCH HỌC
// ============================================================
async function renderStudentSchedule() {
  let query = db.from('schedules').select('*').order('created_at', { ascending: false });
  if (myClasses.length === 1) query = query.or(`class_name.eq.${myClasses[0]},class_name.is.null`);
  else if (myClasses.length > 1) query = query.or(`class_name.in.(${myClasses.join(',')}),class_name.is.null`);
  const { data: list } = await query;
  const grid = document.getElementById('sScheduleGrid');
  grid.innerHTML = '';
  document.getElementById('sEmptySchedule').style.display = (list||[]).length ? 'none' : 'block';
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:.75rem';
  (list||[]).forEach(s => {
    const card = document.createElement('div');
    card.style.cssText = 'background:var(--card);border-radius:12px;overflow:hidden;box-shadow:var(--shadow);border:1.5px solid var(--border);cursor:pointer;transition:transform .15s';
    card.innerHTML = `
      <div style="position:relative;padding-bottom:75%;overflow:hidden">
        <img src="${s.image_url}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"/>
      </div>
      <div style="padding:.5rem .75rem">
        <div style="font-weight:700;font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.title}</div>
        ${s.class_name ? `<span class="class-tag" style="font-size:.68rem">${s.class_name}</span>` : ''}
      </div>`;
    card.addEventListener('mouseenter', () => card.style.transform = 'translateY(-2px)');
    card.addEventListener('mouseleave', () => card.style.transform = '');
    card.addEventListener('click', () => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;cursor:zoom-out';
      overlay.innerHTML = `
        <img src="${s.image_url}" style="max-width:100%;max-height:100%;border-radius:10px;object-fit:contain"/>
        <button id="rotateBtn" style="position:fixed;bottom:1.5rem;right:1.5rem;background:rgba(255,255,255,.2);border:none;color:#fff;width:48px;height:48px;border-radius:50%;font-size:1.3rem;cursor:pointer;z-index:10000" title="Xoay ngang">🔄</button>
        <button style="position:fixed;top:1rem;right:1rem;background:rgba(255,255,255,.2);border:none;color:#fff;width:36px;height:36px;border-radius:50%;font-size:1.1rem;cursor:pointer;z-index:10000" id="closeOverlay">✕</button>`;
      let rotated = false;
      overlay.querySelector('#rotateBtn').addEventListener('click', e => {
        e.stopPropagation();
        rotated = !rotated;
        const img = overlay.querySelector('img');
        if (rotated) {
          img.style.transform = 'rotate(90deg)';
          img.style.maxWidth = '100vh';
          img.style.maxHeight = '100vw';
          img.style.width = 'auto';
          img.style.height = 'auto';
        } else {
          img.style.transform = '';
          img.style.maxWidth = '100%';
          img.style.maxHeight = '100%';
        }
      });
      overlay.querySelector('#closeOverlay').addEventListener('click', e => { e.stopPropagation(); overlay.remove(); });
      overlay.addEventListener('click', () => overlay.remove());
      document.body.appendChild(overlay);
    });
    grid.appendChild(card);
  });
}

function openScheduleViewer(s) {
  let modal = document.getElementById('scheduleViewerModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'scheduleViewerModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1rem';
    modal.innerHTML = `
      <div style="width:100%;max-width:700px;position:relative">
        <button id="closeScheduleViewer" style="position:absolute;top:-40px;right:0;background:rgba(255,255,255,.15);border:none;color:#fff;width:36px;height:36px;border-radius:10px;cursor:pointer;font-size:1.1rem">✕</button>
        <div id="scheduleViewerTitle" style="color:#fff;font-weight:700;font-size:1rem;margin-bottom:.75rem;text-align:center"></div>
        <img id="scheduleViewerImg" style="width:100%;border-radius:14px;max-height:80vh;object-fit:contain"/>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('closeScheduleViewer').addEventListener('click', () => { modal.style.display = 'none'; });
    modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
  }
  document.getElementById('scheduleViewerTitle').textContent = s.title;
  document.getElementById('scheduleViewerImg').src = s.image_url;
  modal.style.display = 'flex';
}
