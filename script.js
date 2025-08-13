// ===== ОСНОВНЫЕ ПЕРЕМЕННЫЕ / STATE =====
const STATE = {
  furs: 0,
  fursPerSecond: 0, // отображаемое значение; считается из ловушек и зимовьев
  clickPower: 1,    // 1 + охотники
  hunters: 0,       // усиливают клик
  traps: 0,         // дают пассивный доход (0.1/сек за ловушку)
  zimovye: 0,       // ясачные зимовья — множитель пассива
  dogs: 0,          // охотничьи псы — шанс критического 5х клика (0.5% за уровень, максимум 20)
  forceNextCrit: false,
};

const COSTS = { traps: 50, hunters: 20, zimovye: 200, dogs: 300 };

// Internal helpers
let _dirty = false;          // marks that state changed since last save
let _lastAutoSave = 0;       // ms timestamp
let _lastTick = 0;           // ms timestamp for income loop
let _secAcc = 0;             // накопитель секунд для пассива
let _passiveCarry = 0;       // дробная часть пассивного дохода, не добавленная в счёт

// ===== DOM ЭЛЕМЕНТЫ =====
const $ = (id) => document.getElementById(id);
const elements = {
  score: $("score"),
  fps: $("fursPerSecond"),
  clickPower: $("clickPower"),
  clickButton: $("clickButton"),
  huntersUpgrade: $("hunters"),
  trapsUpgrade: $("traps"),
  zimovyeUpgrade: $("zimovye"),
  dogsUpgrade: $("dogs"),
};

// ====== UI (минимум лишних обновлений) ======
const uiCache = { score: "", fps: "", clickPower: "", dogsDisabled: null };
function formatInt(n) { return Math.floor(n).toString(); }
function formatGain(amount, isCrit=false) {
  const num = amount < 1 ? amount.toFixed(2) : formatInt(amount);
  return `+${num}${isCrit ? '!' : ''}`;
}

function setBtnMeta(btn, cost, count, max=null) {
  const priceEl = btn.querySelector('.price');
  const countEl = btn.querySelector('.count');
  const priceStr = String(cost);
  const countStr = max ? `x${formatInt(count)}/${max}` : `x${formatInt(count)}`;
  if (priceEl && priceEl.textContent !== priceStr) priceEl.textContent = priceStr;
  if (countEl && countEl.textContent !== countStr) countEl.textContent = countStr;
}

function computeFps() {
  const basePerTrap = 0.1; // 0.1 шкурки/сек за ловушку
  const base = STATE.traps * basePerTrap;
  const bonusPer5Hunters = Math.floor(STATE.hunters / 5) * 0.01; // +1% за каждые 5 охотников
  const mult = 1 + STATE.zimovye * bonusPer5Hunters; // каждый уровень зимовьев умножает бонус
  return base * mult;
}

function recalcRates() {
  STATE.clickPower = 1 + STATE.hunters;        // clickPower из охотников
  STATE.fursPerSecond = computeFps();           // для отображения
}

function renderNow() {
  recalcRates();
  const scoreText = `Пушнина: ${formatInt(STATE.furs)}`;
  const fpsText = `${STATE.fursPerSecond.toFixed(2)} шкурок/сек`;
  const clickText = `За клик: ${formatInt(STATE.clickPower)}`;

  if (uiCache.score !== scoreText) { elements.score.textContent = scoreText; uiCache.score = scoreText; }
  if (uiCache.fps !== fpsText) { elements.fps.textContent = fpsText; uiCache.fps = fpsText; }
  if (uiCache.clickPower !== clickText) { elements.clickPower.textContent = clickText; uiCache.clickPower = clickText; }

  setBtnMeta(elements.trapsUpgrade, COSTS.traps, STATE.traps);
  setBtnMeta(elements.huntersUpgrade, COSTS.hunters, STATE.hunters);
  setBtnMeta(elements.zimovyeUpgrade, COSTS.zimovye, STATE.zimovye);
  setBtnMeta(elements.dogsUpgrade, COSTS.dogs, STATE.dogs, 20);

  const shouldDisableDogs = STATE.dogs >= 20;
  if (uiCache.dogsDisabled !== shouldDisableDogs) {
    elements.dogsUpgrade.disabled = shouldDisableDogs;
    uiCache.dogsDisabled = shouldDisableDogs;
  }
}

let _rafScheduled = false;
function requestRender() {
  if (_rafScheduled) return;
  _rafScheduled = true;
  requestAnimationFrame(() => { _rafScheduled = false; renderNow(); });
}

// ===== СИСТЕМА СОХРАНЕНИЯ =====
const SAVE_KEY = "yasakClickerSave";
function tryParse(json) { try { return JSON.parse(json); } catch { return null; } }
function saveNow() {
  try {
    const payload = { furs: Math.max(0, Number(STATE.furs)||0), hunters: Math.max(0, Number(STATE.hunters)||0), traps: Math.max(0, Number(STATE.traps)||0), zimovye: Math.max(0, Number(STATE.zimovye)||0), dogs: Math.max(0, Number(STATE.dogs)||0), savedAt: Date.now() };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    _dirty = false; _lastAutoSave = Date.now();
  } catch (e) { console.error("Save failed:", e); }
}
let _saveTimer = null;
function saveSoon(delayMs=800) { if (_saveTimer) clearTimeout(_saveTimer); _saveTimer=setTimeout(()=>{_saveTimer=null; saveNow();}, delayMs); }
function markDirtyAndMaybeSave() { _dirty = true; saveSoon(); }
function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY); if (!raw) return; const data = tryParse(raw); if (!data||typeof data!=="object") return;
  STATE.furs = Math.max(0, Number(data.furs)||0);
  STATE.hunters = Math.max(0, Number(data.hunters)||0);
  STATE.traps = Math.max(0, Number(data.traps)||0);
  STATE.zimovye = Math.max(0, Number(data.zimovye)||0);
  STATE.dogs = Math.max(0, Number(data.dogs)||0);
  recalcRates();
}
window.addEventListener('visibilitychange', ()=>{ if (document.hidden && _dirty) saveNow(); });
window.addEventListener('beforeunload', ()=>{ if (_dirty) saveNow(); });

// ===== АНИМАЦИЯ ЛИСЫ =====
function createFoxElement() {
  const fox = document.createElement("div");
  fox.className = "fox-animation";
  fox.innerHTML = `🦊 <span class="gain"></span>`;
  document.body.appendChild(fox);
  return fox;
}
function showFoxAnimation(x, y, amount=null, isCrit=false) {
  const fox = createFoxElement();
  const span = fox.querySelector('.gain');
  if (amount!==null) { span.textContent = formatGain(amount, isCrit); span.classList.toggle('crit', !!isCrit); } else { span.textContent=''; }
  fox.style.left = `${x - 15}px`; fox.style.top = `${y - 15}px`; fox.style.opacity = "1"; fox.style.transform = "scale(1)";
  setTimeout(()=>{ fox.style.top = `${y - 100}px`; fox.style.opacity = "0"; fox.style.transform = "scale(1.5) rotate(15deg)"; }, 10);
  setTimeout(()=>fox.remove(), 700);
}
function showPassiveFox(amountInt) {
  const rect = elements.clickButton.getBoundingClientRect();
  const x = rect.left + rect.width/2, y = rect.top + rect.height/2;
  showFoxAnimation(x, y, amountInt, false);
}

// ===== ИГРОВАЯ ЛОГИКА =====
function getCritChance() { return Math.min(STATE.dogs * 0.005, 0.10); } // 0.5% за уровень, максимум 10%
function addClick(ev) {
  let isCrit=false; if (STATE.forceNextCrit){ isCrit=true; STATE.forceNextCrit=false; } else if (Math.random()<getCritChance()){ isCrit=true; }
  const gain = (isCrit?5:1) * STATE.clickPower; STATE.furs += gain; markDirtyAndMaybeSave(); requestRender();
  const x = ev?.clientX ?? (window.innerWidth/2), y = ev?.clientY ?? (window.innerHeight/2);
  showFoxAnimation(x, y, gain, isCrit); if (navigator.vibrate) navigator.vibrate(isCrit?25:10);
}
function buyHunters(){ const cost=COSTS.hunters; if(STATE.furs>=cost){ STATE.furs-=cost; STATE.hunters+=1; recalcRates(); markDirtyAndMaybeSave(); requestRender(); }}
function buyTraps(){ const cost=COSTS.traps; if(STATE.furs>=cost){ STATE.furs-=cost; STATE.traps+=1; recalcRates(); markDirtyAndMaybeSave(); requestRender(); }}
function buyZimovye(){ const cost=COSTS.zimovye; if(STATE.furs>=cost){ STATE.furs-=cost; STATE.zimovye+=1; recalcRates(); markDirtyAndMaybeSave(); requestRender(); }}
function buyDogs(){ const cost=COSTS.dogs; if(STATE.dogs>=20) return; if(STATE.furs>=cost){ STATE.furs-=cost; STATE.dogs+=1; STATE.forceNextCrit=true; markDirtyAndMaybeSave(); requestRender(); }}

// ===== ОБРАБОТЧИКИ =====
function handleClick(ev){ addClick(ev); }
function handleHunterUpgrade(){ buyHunters(); }
function handleTrapUpgrade(){ buyTraps(); }
function handleZimovyeUpgrade(){ buyZimovye(); }
function handleDogsUpgrade(){ buyDogs(); }

// ===== ДОХОД ПО ВРЕМЕНИ (секундная хронология) =====
function incomeTick(nowMs){
  if (_lastTick===0) _lastTick=nowMs;
  const dt = Math.max(0, (nowMs - _lastTick)/1000); _lastTick = nowMs; _secAcc += dt;
  while (_secAcc >= 1) {
    const fps = computeFps();
    const total = _passiveCarry + fps;
    const intAdd = Math.floor(total);
    _passiveCarry = total - intAdd;
    if (intAdd > 0) { STATE.furs += intAdd; showPassiveFox(intAdd); markDirtyAndMaybeSave(); }
    _secAcc -= 1;
  }
  requestRender();
  if (_dirty && nowMs - _lastAutoSave > 30000) saveNow();
  setTimeout(()=>requestAnimationFrame(incomeTick), 100);
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
function init(){
  loadGame(); recalcRates();
  elements.clickButton.addEventListener("click", handleClick);
  elements.huntersUpgrade.addEventListener("click", handleHunterUpgrade);
  elements.trapsUpgrade.addEventListener("click", handleTrapUpgrade);
  elements.zimovyeUpgrade.addEventListener("click", handleZimovyeUpgrade);
  elements.dogsUpgrade.addEventListener("click", handleDogsUpgrade);
  renderNow(); requestAnimationFrame(incomeTick);
}
if (document.readyState==='complete' || document.readyState==='interactive') init(); else window.addEventListener('DOMContentLoaded', init);