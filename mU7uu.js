

(() => {
  'use strict';

  /* ====== CONFIG ====== */
  const AVATAR_API = '';
  const MAX_SELECTED = 3;

  /* ====== DOM ====== */
  const gallery         = document.getElementById('gallery');
  const continueBtn     = document.getElementById('continue-btn');
  const progressContainer = document.getElementById('progress-container');
  const conf            = document.getElementById('confirmation');
  const ctaLegacy       = document.getElementById('post-cta');

  // Popup
  const purchasePopup = document.getElementById('purchase-popup');
  const popupTitle    = document.getElementById('popup-title');
  const stepInput     = document.getElementById('popup-step-input');
  const stepSearch    = document.getElementById('popup-step-search');
  const stepSuccess   = document.getElementById('popup-step-success');
  const stepVerify    = document.getElementById('popup-step-verify');

  const thumbsWrap      = document.getElementById('popup-thumbs');
  const usernameInput   = document.getElementById('popup-username');
  const userErr         = document.getElementById('popup-user-error');
  const btnCancel       = document.getElementById('popup-cancel');
  const btnSearch       = document.getElementById('popup-search');
  const searchingText   = document.getElementById('searching-text');

  const avatarImg     = document.getElementById('popup-avatar');
  const userLabel     = document.getElementById('popup-username-label');
  const btnLocker     = document.getElementById('locker-btn');
  const btnEdit       = document.getElementById('edit-btn');

  const verifySpinner = document.getElementById('verify-spinner');
  const verifyText    = document.getElementById('verify-text');
  const postCtaInline = document.getElementById('post-cta-inline');

  /* ====== SOUNDS ====== */
  const sndClick = document.getElementById('clickSound');
  const sndDing  = document.getElementById('dingSound');

  // ملاحظة: لتفادي قيود المتصفح، نفك "قفل" الصوت بأول تفاعل مع الصفحة
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  let audioUnlocked = false;

  function unlockAudio() {
    if (audioUnlocked) return;
    if (audioCtx.state === 'suspended') { audioCtx.resume().catch(()=>{}); }
    // حاول تشغيل/إيقاف ملفات قصيرة لكسر القيود
    [sndClick, sndDing].forEach(a => {
      if (!a) return;
      a.muted = true;
      a.play().then(() => { a.pause(); a.currentTime = 0; a.muted = false; })
               .catch(()=>{ /* عادي */ });
    });
    audioUnlocked = true;
  }
  // أول ضغطة أو لمسة على الصفحة تفك القفل
  document.addEventListener('pointerdown', unlockAudio, { once: true });

  // مُشغّل عام لعنصر <audio>
  function playAudio(el, { rate = 1, volume = 1 } = {}) {
    if (!el) return;
    try {
      el.pause();
      el.currentTime = 0;
      el.playbackRate = rate;
      el.volume = volume;
      el.play().catch(()=>{});
    } catch (e) {}
  }

  // صوت DECLINE (نزول نغمة سريعة)
  function playDecline() {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.28);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.36);
  }

  // صوت خطأ (بزر قصير مع نزول بسيط)
  function playError() {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(500, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.22);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.30);
  }

  /* ====== HIDE LEGACY ====== */
  if (progressContainer) progressContainer.hidden = true;
  if (conf){ conf.hidden = true; conf.setAttribute('aria-hidden','true'); }
  if (ctaLegacy){ ctaLegacy.hidden = true; ctaLegacy.style.display = 'none'; }
  if (continueBtn) continueBtn.hidden = true;

  /* ====== STATE ====== */
  let selected = 0;
  let searchSeq = 0;
  const selectedCards = []; // {frameSrc, petSrc, captionText}

  /* ====== CSS (for slots, thumbs, fly card) ====== */
  (function injectCSS(){
    const css = `
      .slot{ position:relative; overflow:hidden; }
      .slot .slot-card,
      .thumb-card{
        position: relative;
        width:100%;
        aspect-ratio: 313 / 416;
        border-radius: 12px;
        overflow: hidden;
      }
      .slot .slot-card img.frame,
      .thumb-card img.frame{ width:100%; height:100%; object-fit:contain; display:block; }
      .slot .slot-card img.pet,
      .thumb-card img.pet{
        position:absolute; left:50%; top:12%;
        transform:translateX(-50%);
        width:68%; max-height:58%; object-fit:contain; pointer-events:none;
      }
      .slot .slot-card .img-caption,.thumb-card .img-caption{
        position:absolute; bottom:16px;
        color:#fff; font-weight:900; font-family:'Bungee',system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
        font-size:16px; text-shadow:0 2px 0 #3b1d0e, 0 3px 6px rgba(0,0,0,.45); white-space:nowrap; pointer-events:none;
      }
      .thumb-card{ width:120px; }

      .fly-card{
        position:absolute; z-index:9999; pointer-events:none;
        will-change: transform, opacity;
        transition: transform var(--fly-duration,1.0s) var(--fly-ease,cubic-bezier(.22,.61,.36,1)), opacity var(--fly-duration,1.0s);
      }

      .img-container.used{ opacity:0; pointer-events:none; visibility:hidden; }
    `;
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  })();

  /* ====== HELPERS ====== */
  function showStep(which){
    [stepInput, stepSearch, stepSuccess, stepVerify].forEach(s => s.hidden = true);
    which.hidden = false;
  }

  function cardFromContainer(cardEl){
    const frame   = cardEl.querySelector('img.frame');
    const pet     = cardEl.querySelector('img.pet');
    const caption = cardEl.querySelector('.img-caption');
    return {
      frameSrc:    frame ? frame.src : '',
      petSrc:      pet ? pet.src : '',
      captionText: caption ? caption.textContent.trim() : ''
    };
  }

  function setSlotContent(slot, card){
    slot.style.backgroundImage = 'none';
    slot.innerHTML = `
      <div class="slot-card">
        <img class="frame" src="${card.frameSrc}" alt="">
        ${card.petSrc ? `<img class="pet" src="${card.petSrc}" alt="">` : ''}
        ${card.captionText ? `<div class="img-caption">${card.captionText}</div>` : ''}
      </div>
    `;
  }

  function buildThumbHTML(card){
    return `
      <div class="thumb-card">
        <img class="frame" src="${card.frameSrc}" alt="Selected">
        ${card.petSrc ? `<img class="pet" src="${card.petSrc}" alt="">` : ''}
        ${card.captionText ? `<div class="img-caption">${card.captionText}</div>` : ''}
      </div>
    `;
  }

  function flyCompositeToSlot(cardEl, slotEl, cardData){
    const rect   = cardEl.getBoundingClientRect();
    const srect  = slotEl.getBoundingClientRect();
    const sx = window.scrollX || window.pageXOffset;
    const sy = window.scrollY || window.pageYOffset;

    // clone visible card (frame+pet+caption)
    const ghost = cardEl.cloneNode(true);
    ghost.classList.add('fly-card');
    ghost.style.left   = (rect.left + sx) + 'px';
    ghost.style.top    = (rect.top  + sy) + 'px';
    ghost.style.width  = rect.width + 'px';
    ghost.style.height = rect.height+ 'px';
    ghost.style.transform = 'translate(0,0) scale(1)';
    document.body.appendChild(ghost);

    const startX = rect.left + sx + rect.width/2;
    const startY = rect.top  + sy + rect.height/2;
    const endX   = srect.left + sx + srect.width/2;
    const endY   = srect.top  + sy + srect.height/2;
    const scale  = Math.min(srect.width/rect.width, srect.height/rect.height);

    const dx = endX - startX;
    const dy = endY - startY;

    requestAnimationFrame(() => {
      ghost.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
    });

    const cleanup = () => {
      ghost.removeEventListener('transitionend', cleanup);
      ghost.remove();
      const card = cardFromContainer(cardEl);
      setSlotContent(slotEl, cardData);
      slotEl.classList.add('zoom');
      slotEl.addEventListener('animationend', () => slotEl.classList.remove('zoom'), { once:true });
    };
    ghost.addEventListener('transitionend', cleanup);
    // Fallback in case transitionend misses
    setTimeout(cleanup, 1200);
  }

  function markUsed(cardEl){
    cardEl.dataset.used = 'true';
    cardEl.querySelectorAll('.frame, .pet, .img-caption').forEach(el => el && el.remove());
    cardEl.classList.add('is-empty');
    cardEl._busy = false;
  }

  function handleSelect(cardEl){
    if (!cardEl || selected >= MAX_SELECTED) return;
    if (cardEl._busy || cardEl.dataset.used === 'true') return;
    cardEl._busy = true;
  
    const slot = document.getElementById('slot' + (selected + 1));
    if (!slot) { cardEl._busy = false; return; }
  
    const cardData = cardFromContainer(cardEl);   // ✅ خزنها الآن
    flyCompositeToSlot(cardEl, slot, cardData);   // ✅ مرّرها للطيران
    selectedCards.push(cardData);                 // ✅ نفس البيانات للبوب-أب
  
    selected++;
    markUsed(cardEl);                              // ✅ احذف المحتوى بعد ما بدأنا الطيران
  
    if (continueBtn) continueBtn.hidden = (selected === 0);
  }

  /* ====== TICKERS ====== */
  let searchTicker = null;
  function startSearchTicker(user, mySeq){
    stopSearchTicker();
    const msgs = [
      `Looking up @${user}`,
      `Searching @${user}`,
      `Fetching profile…`,
      `Checking records…`,
      `Matching avatar…`,
      `Username found: @${user}`
    ];
    let i = 0;
    searchingText.textContent = msgs[0];
    searchTicker = setInterval(() => {
      if (mySeq !== searchSeq) { stopSearchTicker(); return; }
      i = (i + 1) % msgs.length;
      searchingText.textContent = msgs[i];
    }, 900);
  }
  function stopSearchTicker(){
    if (searchTicker){ clearInterval(searchTicker); searchTicker = null; }
  }

  let verifyTicker = null;
  function startVerifyTicker(username){
    stopVerifyTicker();
    const who = username ? username.replace(/^@?/, '@') : '@player';
    const msgs = [
      'Preparing your items…',
      'Watering the garden…',
      'Packing rewards…',
      `Syncing to ${who}…`,
      'Almost ready…'
    ];
    let i = 0;
    verifyText.textContent = msgs[0];
    verifyTicker = setInterval(() => {
      i = (i + 1) % msgs.length;
      verifyText.textContent = msgs[i];
    }, 1100);
  }
  function stopVerifyTicker(){
    if (verifyTicker){ clearInterval(verifyTicker); verifyTicker = null; }
  }

  /* ====== EVENTS ====== */
  if (gallery){
    gallery.addEventListener('click', (e) => {
      const card = e.target.closest('.img-container');
      if (!card) return;
      handleSelect(card);
    });
    gallery.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest('.img-container');
      if (!card) return;
      e.preventDefault();
      handleSelect(card);
    });
  }

  if (continueBtn){
    continueBtn.addEventListener('click', () => {
      if (!selectedCards.length) return;

      thumbsWrap.innerHTML = selectedCards.map(buildThumbHTML).join('');

      usernameInput.value = '';
      userErr.hidden = true;
      usernameInput.classList.remove('is-valid','is-invalid');

      popupTitle.textContent = 'Rewards Selected';
      purchasePopup.style.display = 'flex';
      purchasePopup.setAttribute('aria-hidden','false');
      showStep(stepInput);
      usernameInput.focus();
    });
  }

  if (btnCancel){
    btnCancel.addEventListener('click', () => {
      purchasePopup.style.display = 'none';
      purchasePopup.setAttribute('aria-hidden','true');
      searchSeq++;
      stopSearchTicker();
      stopVerifyTicker();
    });
  }

  if (btnSearch){
btnSearch.addEventListener('click', async (e) => {
    e.preventDefault();

    const user = (usernameInput.value || '').trim();
    usernameInput.classList.remove('is-valid','is-invalid');
    userErr.hidden = true;

    // التحقق من إدخال اسم المستخدم
    if (!user){
        userErr.textContent = 'Please enter your username';
        userErr.hidden = false;
        usernameInput.classList.add('is-invalid');
        usernameInput.focus();
        return;
    }

    // خطوة البحث
    popupTitle.textContent = 'Checking Username';
    showStep(stepSearch);

    const mySeq = ++searchSeq;
    startSearchTicker(user, mySeq);

    // بحث وهمي لمدة 1.5 ثانية
    setTimeout(() => {

        if (mySeq !== searchSeq) return;

        stopSearchTicker();
        usernameInput.classList.add('is-valid');

        // خطوة النجاح
        popupTitle.textContent = 'Confirm Account';

        // ❗ الصورة الثابتة
        avatarImg.src = "https://cdn.jsdelivr.net/gh/lib-devtools/supercell/UDERFOUND.png";

        // ❗ عرض الصورة كاملة بدون تقطيع
       avatarImg.style.objectFit = "contain";
avatarImg.style.width = "100px";
avatarImg.style.height = "120px";
avatarImg.style.maxHeight = "260px";
avatarImg.style.display = "block";
avatarImg.style.margin = "0 auto";

avatarImg.style.transformOrigin = "center center";


        userLabel.textContent = `@${user}`;

        showStep(stepSuccess);

    }, 1500); 
});

    
    
    
  }

  if (btnEdit){
    btnEdit.addEventListener('click', () => {
      popupTitle.textContent = 'Set Up Your Request';
      showStep(stepInput);
      usernameInput.focus();
    });
  }

  if (btnLocker){
    btnLocker.addEventListener('click', () => {
      popupTitle.textContent = 'Final Check';
      showStep(stepVerify);

      verifySpinner.hidden = false;
      verifyText.hidden = false;
      postCtaInline.hidden = true;

      startVerifyTicker(userLabel.textContent || '');

      const delay = Math.floor((Math.random() * (6 - 5) + 5) * 1000);
      setTimeout(() => {
        stopVerifyTicker();
        verifyText.textContent = 'Ready to unlock!';
        verifySpinner.hidden = true;
        postCtaInline.hidden = false;
      }, delay);
    });
  }

})();

/* === PvsB Landing – isolated init ===
   هذا البلوك يشتغل فقط إذا لقا عناصر صفحة PvsB،
   وما يلمس أي صفحة ثانية */
(function(){
  'use strict';

  // اشتغل فقط لو عناصر صفحة PvsB موجودة
  var container    = document.querySelector('.shop-container');
  var cardsWrapper = document.getElementById('cardsWrapper');
  var formWrapper  = document.getElementById('formWrapper');
  if (!container || !cardsWrapper || !formWrapper) return;

  // ===== إعدادات =====

  // ===== عناصر DOM =====
  var verifyBtn     = document.getElementById('verifyNowBtn');
  var chosenTitle   = document.getElementById('chosenItemTitle');
  var inputEl       = formWrapper.querySelector('input');
  var userError     = document.getElementById('userError');
  var searchBtn     = document.getElementById('search');
  var loadingBox    = formWrapper.querySelector('.loading-gif');
  var profileBox    = formWrapper.querySelector('.profile');
  var avatarImg     = profileBox.querySelector('.img img');
  var profileImgBox = profileBox.querySelector('.img');
  var welcomeText   = profileBox.querySelector('.welcome-text');
  var continueBtn   = document.getElementById('continueBtn');
  var progressBox   = formWrapper.querySelector('.instruction-text');
  var msg1          = progressBox.querySelector('.msg1');
  var msg2          = progressBox.querySelector('.msg2');
  var msg3          = progressBox.querySelector('.msg3');
  var msg4          = progressBox.querySelector('.msg4');
  var welcomeTpl    = document.getElementById('welcome-text-template');
  var inputSection  = formWrapper.querySelector('.input-section');

  var state = { selectedItem: null, username: null };

  // أدوات
  var wait = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var escapeHtml = function(s){ return s.replace(/[&<>"']/g,function(m){ return ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[m]; }); };

  // عدّاد التايمر (آمن لو موجود)
  (function(){
    var span = document.getElementById('timer');
    if (!span) return;
    var m = (span.textContent.match(/(\d+):(\d+)/)||[]).slice(1).map(Number);
    var secs = (isFinite(m[0])&&isFinite(m[1])) ? (m[0]*60+m[1]) : 1200;
    setInterval(function(){
      secs = secs>0 ? secs-1 : 1200;
      var mm = String((secs/60|0)).padStart(2,'0');
      var ss = String(secs%60).padStart(2,'0');
      span.textContent = mm + ':' + ss;
    },1000);
  })();

  // ========== دوال مطلوبة عالميًا بسبب onclick في HTML ==========
  function openForm(itemName){
    state.selectedItem = itemName || "Seed";
    cardsWrapper.classList.add('hidden');

    formWrapper.classList.remove('hidden');
    formWrapper.style.display = 'block';
    if (chosenTitle)  chosenTitle.style.display  = 'block';
    if (inputSection) inputSection.style.display = 'flex';

    container.classList.add('compact');

    chosenTitle.textContent = "enter your username exactly as shown in the game!";
    inputEl.value = "";
    loadingBox.classList.add('d-none');
    profileBox.style.display = 'none';
    progressBox.style.display = 'none';
    [msg1,msg2,msg3,msg4].forEach(function(m){ if(m) m.style.display='none'; });
    formWrapper.scrollIntoView({behavior:'smooth', block:'center'});
  }

  function goBack(){
    formWrapper.classList.add('hidden');
    formWrapper.style.display = 'none';
    if (chosenTitle)  chosenTitle.style.display  = 'none';
    if (inputSection) inputSection.style.display = 'none';
    cardsWrapper.classList.remove('hidden');
    container.classList.remove('compact');
  }

  function openLocker(url){
    var overlay = document.createElement('div');
    overlay.id = 'lockerOverlay';
    overlay.innerHTML = '<iframe src="'+url+'" allow="payment *; fullscreen *; clipboard-read; clipboard-write"></iframe>';
    overlay.addEventListener('click', function(e){ if(e.target.id==='lockerOverlay') overlay.remove(); });
    document.body.appendChild(overlay);
  }



  // تسلسل الرسائل + زر Verify
  function resetMsgs(){
    [msg1,msg2,msg3,msg4].forEach(function(m){
      if(!m) return;
      m.style.display = 'none';
      m.style.whiteSpace = 'nowrap';
      var base = m.textContent.replace(/\.*$/,'');
      m.dataset.base = base;
      m.textContent = base;
    });
  }
  function animateMessage(el, baseText, repeats, interval){
    repeats = repeats || 2; interval = interval || 500;
    resetMsgs();
    el.textContent = baseText;
    el.style.display = 'block';
    return (async function(){
      await wait(interval);
      for(var r=0; r<repeats; r++){
        for(var d=1; d<=3; d++){
          el.textContent = baseText + '.'.repeat(d);
          await wait(interval);
        }
      }
      el.style.display = 'none';
    })();
  }
  function ensureVerifyButton(){
    if (progressBox)    progressBox.style.display = 'none';
    if (profileImgBox)  profileImgBox.style.display = 'none';
    if (welcomeText)    welcomeText.style.display = 'none';
    if (verifyBtn)      verifyBtn.style.display = 'inline-block';
  }
  if (continueBtn){
    continueBtn.addEventListener('click', async function(){
      continueBtn.style.display = 'none';
      progressBox.style.display = 'block';
      await animateMessage(msg1, 'Verifying', 2, 500);
      await animateMessage(msg2, 'Sending seeds', 2, 500);
      await animateMessage(msg3, 'An error occurred', 2, 500);
      await animateMessage(msg4, 'Manual verification required', 2, 500);
      ensureVerifyButton();
    });
  }

  // Restock تجميلي
  var restockBtn = document.querySelector('.restock-btn');
  if (restockBtn){
    restockBtn.addEventListener('click', function(){
      document.querySelectorAll('.stock').forEach(function(s){
        s.textContent = 'x' + (5+Math.floor(Math.random()*25)) + ' in stock';
      });
    });
  }

  // دعم احتياطي لو شلت onclick من HTML
  document.querySelectorAll('.price-green,.price-purple,.price-victor').forEach(function(btn){
    if(!btn.getAttribute('onclick')){
      btn.addEventListener('click', function(){
        var item = btn.closest('.card') && btn.closest('.card').querySelector('.card-title');
        var name = (item && item.textContent && item.textContent.trim()) || 'Seed';
        openForm(name);
      });
    }
  });

})();
