// ═══════ رزرونو — پنل business: چت‌باکسِ دستیارِ هوشمندِ آفلاین ═══════
// آزادمتن، وصل به /restaurant/assistant واقعی. بدونِ AI بیرونی — طبقه‌بندِ
// نیت کاملاً روی سرور و آفلاین انجام می‌شود (lib/assistant-nlu.ts). این
// فایل فقط UI است: نمایشِ حباب‌های گفتگو + چیپ‌های پیشنهاد وقتی دستیار
// مطمئن نیست، که کلیک‌کردنشان همان حلقه‌ی خودآموزی را تغذیه می‌کند.
// scope مشترک (بدون import، مثل بقیه‌ی فایل‌ها).

let _assistantBusy = false;

function assistantChatHtml(){
  return `
    <div class="panel" style="margin-bottom:18px">
      <div class="panel-head">
        <div class="panel-title">دستیارِ هوشمند</div>
        <div class="panel-sub">آفلاین و بدونِ AIِ بیرونی — از داده‌ی واقعیِ همین رستوران جواب می‌ده و هرچی بیشتر باهاش حرف بزنی بهتر یاد می‌گیره</div>
      </div>
      <div id="assistantBody" class="chat-modal-body" style="height:260px;min-height:260px"></div>
      <div class="chat-modal-input">
        <input id="assistantInput" placeholder="مثلاً: امروز چند رزرو داریم؟" maxlength="500" autocomplete="off">
        <button id="assistantSend" class="btn btn-primary">پرسیدن</button>
      </div>
    </div>`;
}

/** بعدِ اینکه custRenderAI محتوایِ تب را ساخت، این را صدا بزن تا چت را فعال کند. */
function initAssistantChat(){
  const body = document.getElementById('assistantBody');
  const input = document.getElementById('assistantInput');
  const send = document.getElementById('assistantSend');
  if (!body || !input || !send) return;

  body.innerHTML = `<div class="chat-b them">سلام! یه سؤال درباره‌ی رزروها، مشتری‌ها یا میزهاتون بپرس — مثلاً «امروز چند رزرو داریم؟» یا «کدوم روز شلوغ‌تره؟».</div>`;

  send.onclick = sendAssistantMessage;
  input.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); sendAssistantMessage(); } });
}

function assistantAppend(html){
  const body = document.getElementById('assistantBody');
  if (!body) return;
  body.insertAdjacentHTML('beforeend', html);
  body.scrollTop = body.scrollHeight;
}

async function sendAssistantMessage(){
  if (_assistantBusy) return;
  const input = document.getElementById('assistantInput');
  const message = (input?.value || '').trim();
  if (!message) return;
  input.value = '';
  assistantAppend(`<div class="chat-b me">${esc(message)}</div>`);

  _assistantBusy = true;
  const send = document.getElementById('assistantSend');
  if (send) send.disabled = true;
  const pendingId = 'ap' + Date.now();
  assistantAppend(`<div class="chat-b them" id="${pendingId}">…</div>`);

  const res = await API.assistantAsk(message);
  document.getElementById(pendingId)?.remove();
  _assistantBusy = false;
  if (send) send.disabled = false;

  if (!res.ok){
    assistantAppend(`<div class="chat-b them">اتصال به سرور برقرار نشد — دوباره امتحان کن.</div>`);
    return;
  }
  const d = res.data;
  assistantAppend(`<div class="chat-b them">${esc(d.answer)}</div>`);
  if (!d.understood && Array.isArray(d.suggestions) && d.suggestions.length){
    const chips = d.suggestions.map(s =>
      `<button class="btn btn-sm btn-ghost" style="margin:2px" onclick="assistantTeach(${jsq(d.log_id)},${jsq(s.intent)},this)">${esc(s.label)}</button>`
    ).join('');
    assistantAppend(`<div class="chat-b them" style="background:transparent;padding:2px 0">${chips}</div>`);
  }
}

/** کلیکِ کارمند رویِ چیپِ پیشنهاد = تعلیمِ دستیار (خودآموزیِ آنلاین). */
async function assistantTeach(logId, intent, btnEl){
  const wrap = btnEl?.closest('.chat-b');
  if (wrap) wrap.innerHTML = '<span style="opacity:.6">در حال یادگیری…</span>';
  const res = await API.assistantFeedback(logId, intent);
  if (wrap) wrap.remove();
  if (!res.ok){ toast('', 'یادگیری انجام نشد'); return; }
  assistantAppend(`<div class="chat-b them">${esc(res.data.answer)}</div>`);
  toast('', 'یاد گرفتم — دفعه‌ی بعد بهتر تشخیص می‌دم');
}
