// ═══════════ رزرونو — پنل business: چت با مشتریان (Polling) ═══════════
// اینباکس گفتگوها + پنجره‌ی گفتگو. scope مشترک (بدون import، مثل بقیه‌ی فایل‌ها).

let _chatPollTimer = null;
let _chatActiveThread = null;
let _chatLastTime = null;
let _chatRendered = new Set();
const CHAT_POLL_MS = 4000;

function chatEsc(s){ return String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function chatTime(iso){ try { return new Date(iso).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'}); } catch { return ''; } }

// ── اینباکس (view اصلی چت) ──
async function rChat(){
  const view = document.getElementById('v-chat');
  view.innerHTML = `<div class="panel"><div class="panel-head"><div class="panel-title">پیام‌های مشتریان</div><div class="panel-sub" id="chatInboxSub">در حال بارگذاری…</div></div><div id="chatInbox" class="chat-inbox"></div></div>`;
  const res = await API.get('/restaurant/chats');
  const box = document.getElementById('chatInbox');
  const sub = document.getElementById('chatInboxSub');
  if (!res.ok) { box.innerHTML = `<div class="chat-empty">اتصال برقرار نشد.</div>`; return; }
  const items = res.data.items || [];
  sub.textContent = res.data.unread_threads > 0 ? `${res.data.unread_threads} گفتگوی خوانده‌نشده` : 'همه خوانده شد';
  if (!items.length) { box.innerHTML = `<div class="chat-empty">هنوز پیامی از مشتری نیومده.</div>`; return; }
  box.innerHTML = items.map(t => `
    <div class="chat-inbox-row" role="button" tabindex="0" onclick="openBizChat(${jsq(t.id)},${jsq(chatEsc(t.customer.name))},${jsq(chatEsc(t.customer.phone||''))})">
      <div class="chat-inbox-ava">${chatEsc(t.customer.name.charAt(0))}</div>
      <div class="chat-inbox-main">
        <div class="chat-inbox-top"><span class="chat-inbox-name">${chatEsc(t.customer.name)}</span>${t.reservation_code?`<span class="chat-inbox-tag">#${chatEsc(t.reservation_code)}</span>`:''}</div>
        <div class="chat-inbox-prev">${t.last_message?chatEsc(t.last_message.body).slice(0,64):'—'}</div>
      </div>
      ${t.unread>0?`<span class="chat-inbox-badge">${t.unread}</span>`:''}
    </div>`).join('');
}

// ── باز کردن یک گفتگو ──
async function openBizChat(threadId, name, phone){
  _chatActiveThread = threadId; _chatLastTime = null; _chatRendered = new Set();
  openModal(`
    <div class="chat-modal">
      <div class="chat-modal-head">
        <div><div class="chat-modal-name">${chatEsc(name)}</div>${phone?`<div class="chat-modal-phone" dir="ltr">${chatEsc(phone)}</div>`:''}</div>
        <button class="modal-x" onclick="closeBizChat()" aria-label="بستن">${icon('close',{size:18})}</button>
      </div>
      <div id="bizChatBody" class="chat-modal-body" role="log" aria-live="polite"></div>
      <div class="chat-modal-input">
        <input id="bizChatInput" placeholder="پاسخت رو بنویس…" maxlength="2000" autocomplete="off">
        <button id="bizChatSend" class="btn btn-primary">ارسال</button>
      </div>
    </div>`);
  document.getElementById('bizChatSend').onclick = sendBizChat;
  document.getElementById('bizChatInput').addEventListener('keydown', e => { if (e.key==='Enter'){ e.preventDefault(); sendBizChat(); } });
  await bizPoll(true);
  _chatPollTimer = setInterval(() => bizPoll(false), CHAT_POLL_MS);
}

function closeBizChat(){
  if (_chatPollTimer){ clearInterval(_chatPollTimer); _chatPollTimer = null; }
  _chatActiveThread = null;
  closeModal();
  rChat(); // اینباکس را تازه کن (شمارنده‌ها)
}

async function bizPoll(initial){
  if (!_chatActiveThread) return;
  const q = _chatLastTime ? `?after=${encodeURIComponent(_chatLastTime)}` : '';
  const res = await API.get(`/restaurant/chats/${_chatActiveThread}${q}`);
  if (!res.ok) return;
  const msgs = res.data.items || [];
  const body = document.getElementById('bizChatBody');
  if (!body) { if(_chatPollTimer){clearInterval(_chatPollTimer);_chatPollTimer=null;} return; }
  let appended = false;
  for (const m of msgs){
    if (_chatRendered.has(m.id)) continue;
    _chatRendered.add(m.id); _chatLastTime = m.created_at;
    body.insertAdjacentHTML('beforeend', bizBubble(m));
    appended = true;
  }
  if (initial && !msgs.length) body.innerHTML = `<div class="chat-empty-thread">هنوز پیامی نیست.</div>`;
  if (appended) body.scrollTop = body.scrollHeight;
}

function bizBubble(m){
  const mine = m.sender === 'staff';
  return `<div class="chat-b ${mine?'me':'them'}"><div>${chatEsc(m.body)}</div><div class="chat-b-t">${chatTime(m.created_at)}</div></div>`;
}

async function sendBizChat(){
  const input = document.getElementById('bizChatInput');
  const body = (input.value||'').trim();
  if (!body || !_chatActiveThread) return;
  input.value = '';
  const bodyEl = document.getElementById('bizChatBody');
  const empty = bodyEl?.querySelector('.chat-empty-thread'); if (empty) empty.remove();
  bodyEl?.insertAdjacentHTML('beforeend', `<div class="chat-b me pending"><div>${chatEsc(body)}</div><div class="chat-b-t">…</div></div>`);
  if (bodyEl) bodyEl.scrollTop = bodyEl.scrollHeight;
  const res = await API.post(`/restaurant/chats/${_chatActiveThread}`, { body });
  const pend = bodyEl?.querySelector('.chat-b.pending');
  if (res.ok && res.data?.id){
    _chatRendered.add(res.data.id); _chatLastTime = res.data.created_at;
    if (pend){ pend.classList.remove('pending'); pend.querySelector('.chat-b-t').textContent = chatTime(res.data.created_at); }
  } else {
    if (pend) pend.querySelector('.chat-b-t').innerHTML = icon('alert',{size:14});
    toast('','ارسال نشد');
  }
}
