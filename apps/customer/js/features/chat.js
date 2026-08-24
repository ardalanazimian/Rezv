// ═══════════════════════════════════════════════════════════
//  چت مشتری ↔ رستوران (Polling-based).
//  window.openChat(slug, reservationId?)  → گفتگو را باز می‌کند.
//  window.renderChats()                   → لیستِ همه‌ی گفتگوها.
//  Polling فقط وقتی صفحه‌ی چت باز است فعال است (صرفه‌جویی در باتری/شبکه).
// ═══════════════════════════════════════════════════════════
import { API } from '../api.js';
import { icon } from '../icons.js';
import { esc } from '../auth.js';

let _pollTimer = null;
let _activeThreadId = null;
let _lastMsgTime = null;   // ISO — آخرین پیامی که داریم (برای ?after)
let _rendered = new Set(); // idهای پیامِ نمایش‌داده‌شده (جلوگیری از تکرار)

const POLL_MS = 4000;

// esc از auth.js (منبعِ واحد) import می‌شود — نسخه‌ی محلیِ تکراری حذف شد.
function faTime(iso){
  try { return new Date(iso).toLocaleTimeString('fa-IR', { hour:'2-digit', minute:'2-digit' }); }
  catch { return ''; }
}

// ── لیست گفتگوها (صفحه‌ی «پیام‌ها») ──
export async function renderChats(){
  const page = document.getElementById('page-chats');
  if (!page) return;
  page.innerHTML = `<div class="chat-list-head"><button class="icon-btn" onclick="go('discover')" aria-label="بازگشت">${icon('arrowR',{size:20})}</button><h2>پیام‌ها</h2></div><div id="chatListBody" class="chat-list" aria-busy="true"><div class="skeleton skeleton-card" style="margin-bottom:var(--sp-3)"></div><div class="skeleton skeleton-card" style="margin-bottom:var(--sp-3)"></div><div class="skeleton skeleton-card"></div></div>`;

  const res = await API.get('/me/chats');
  const body = document.getElementById('chatListBody');
  // ⚠️ aria-busy="true" رویِ خودِ ظرف است و innerHTML آن را پاک نمی‌کند —
  // بدونِ این خط، صفحه‌خوان تا ابد لیست را «در حالِ بارگذاری» اعلام می‌کرد
  // (economy.js و loyalty.js از قبل درست بودند؛ اینجا جا مانده بود).
  body.removeAttribute('aria-busy');
  if (!res.ok) { body.innerHTML = `<div class="chat-empty">اتصال برقرار نشد.</div>`; return; }
  const items = res.data.items || [];
  if (!items.length) { body.innerHTML = `<div class="chat-empty">هنوز گفتگویی نداری.<br>از صفحه‌ی هر رستوران می‌تونی پیام بدی.</div>`; return; }

  body.innerHTML = items.map(t => `
    <div class="chat-row" role="button" tabindex="0" onclick="openChatThread('${t.id}','${esc(t.restaurant.name)}')">
      <div class="chat-row-avatar">${esc(t.restaurant.name.charAt(0))}</div>
      <div class="chat-row-main">
        <div class="chat-row-top"><span class="chat-row-name">${esc(t.restaurant.name)}</span>${t.reservation_code ? `<span class="chat-row-tag">#${esc(t.reservation_code)}</span>` : ''}</div>
        <div class="chat-row-preview">${t.last_message ? esc(t.last_message.body).slice(0,60) : 'گفتگوی جدید'}</div>
      </div>
      ${t.unread > 0 ? `<span class="chat-badge">${t.unread}</span>` : ''}
    </div>`).join('');
}

// ── باز کردن یک گفتگو با رستوران (از صفحه‌ی رستوران) ──
export async function openChat(slug, reservationId){
  const res = await API.post(`/restaurants/${encodeURIComponent(slug)}/chat`, reservationId ? { reservation_id: reservationId } : {});
  if (!res.ok || !res.data?.thread_id) {
    if (typeof toast === 'function') toast('', res.error?.message || 'شروع گفتگو ناموفق بود');
    return;
  }
  openChatThread(res.data.thread_id, '');
}

// ── باز کردن ترد و شروع polling ──
export async function openChatThread(threadId, name){
  _activeThreadId = threadId;
  _lastMsgTime = null;
  _rendered = new Set();

  const page = document.getElementById('page-chat');
  if (!page) return;
  go('chat');
  page.innerHTML = `
    <div class="chat-head">
      <button class="icon-btn" onclick="closeChatThread()" aria-label="بازگشت">${icon('arrowR',{size:20})}</button>
      <div class="chat-head-title" id="chatHeadTitle">${esc(name || 'گفتگو')}</div>
    </div>
    <div id="chatBody" class="chat-body" role="log" aria-live="polite"></div>
    <form class="chat-input-bar" id="chatForm" onsubmit="return false">
      <input id="chatInput" class="chat-input" placeholder="پیامت رو بنویس…" autocomplete="off" maxlength="2000">
      <button class="chat-send" id="chatSend" aria-label="ارسال">${icon('arrowL',{size:20})}</button>
    </form>`;

  document.getElementById('chatSend').onclick = sendCurrent;
  document.getElementById('chatInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendCurrent(); } });

  await pollOnce(true);
  startPolling();
}

function startPolling(){
  stopPolling();
  _pollTimer = setInterval(() => pollOnce(false), POLL_MS);
}
function stopPolling(){ if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; } }

export function closeChatThread(){
  stopPolling();
  _activeThreadId = null;
  go('chats');
  renderChats();
}
window.addEventListener('beforeunload', stopPolling);

async function pollOnce(initial){
  if (!_activeThreadId) return;
  const q = _lastMsgTime ? `?after=${encodeURIComponent(_lastMsgTime)}` : '';
  const res = await API.get(`/me/chats/${_activeThreadId}${q}`);
  if (!res.ok) return;
  const msgs = res.data.items || [];
  const bodyEl = document.getElementById('chatBody');
  if (!bodyEl) { stopPolling(); return; }

  let appended = false;
  for (const m of msgs) {
    if (_rendered.has(m.id)) continue;
    _rendered.add(m.id);
    _lastMsgTime = m.created_at;
    bodyEl.insertAdjacentHTML('beforeend', bubble(m));
    appended = true;
  }
  if (initial && !msgs.length) {
    bodyEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${icon('message',{size:40})}</div><div class="empty-state-title">هنوز پیامی نیست</div><div class="empty-state-desc">اولین پیام رو بفرست تا گفتگو شروع شه</div></div>`;
  }
  if (appended) bodyEl.scrollTop = bodyEl.scrollHeight;
}

function bubble(m){
  const mine = m.sender === 'user';
  return `<div class="chat-bubble ${mine ? 'mine' : 'theirs'}"><div class="chat-bubble-text">${esc(m.body)}</div><div class="chat-bubble-time">${faTime(m.created_at)}</div></div>`;
}

async function sendCurrent(){
  const input = document.getElementById('chatInput');
  const body = (input.value || '').trim();
  if (!body || !_activeThreadId) return;
  input.value = '';
  // optimistic: پیام را فوری نشان بده
  const tempEl = document.getElementById('chatBody');
  if (tempEl) {
    const empty = tempEl.querySelector('.chat-empty-thread'); if (empty) empty.remove();
    tempEl.insertAdjacentHTML('beforeend', `<div class="chat-bubble mine pending"><div class="chat-bubble-text">${esc(body)}</div><div class="chat-bubble-time">…</div></div>`);
    tempEl.scrollTop = tempEl.scrollHeight;
  }
  const res = await API.post(`/me/chats/${_activeThreadId}`, { body });
  // پیامِ pending را بردار؛ polling نسخه‌ی واقعی را می‌آورد
  const pend = tempEl?.querySelector('.chat-bubble.pending');
  if (res.ok && res.data?.id) {
    _rendered.add(res.data.id);
    _lastMsgTime = res.data.created_at;
    if (pend) { pend.classList.remove('pending'); pend.querySelector('.chat-bubble-time').textContent = faTime(res.data.created_at); }
  } else {
    if (pend) pend.querySelector('.chat-bubble-time').textContent = '⚠️ ناموفق';
    if (typeof toast === 'function') toast('⚠️', 'ارسال نشد');
  }
}

window.openChat = openChat;
window.openChatThread = openChatThread;
window.closeChatThread = closeChatThread;
window.renderChats = renderChats;
