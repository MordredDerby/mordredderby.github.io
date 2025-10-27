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
  // достижения
  achievements: [],           // массив id открытых достижений
  fursTotal: 0,               // всего добыто (для порогов 1/100/1000)
};

const COSTS = { traps: 50, hunters: 20, zimovye: 200, dogs: 300 };

// ===== ДОСТИЖЕНИЯ =====
const ACHIEVEMENTS = [
  { id: 'first_fur',     name: 'Первая шкурка',       desc: 'Получите первую шкурку',               img: 'https://cdn-icons-png.flaticon.com/512/616/616490.png', test: (s)=> s.fursTotal >= 1 },
  { id: 'first_hunter',  name: 'Первый артельщик',    desc: 'Принять первого охотника',             img: 'https://cdn-icons-png.flaticon.com/512/599/599502.png', test: (s)=> s.hunters >= 1 },
  { id: 'first_zimovye', name: 'Первое зимовье',      desc: 'Построить ясачное зимовье',            img: 'https://cdn-icons-png.flaticon.com/512/3076/3076129.png', test: (s)=> s.zimovye >= 1 },
  { id: '100_furs',      name: 'Сотня пушнины',       desc: 'Добыть 100 пушнины',                   img: 'https://cdn-icons-png.flaticon.com/512/805/805370.png', test: (s)=> s.fursTotal >= 100 },
  { id: '10_traps',      name: 'Мастер ловушек',      desc: 'Поставить 10 ловушек',                 img: 'https://cdn-icons-png.flaticon.com/512/3595/3595455.png', test: (s)=> s.traps >= 10 },
  { id: '20_hunters',    name: 'Сила артели',         desc: 'Собрать 20 охотников',                 img: 'https://cdn-icons-png.flaticon.com/512/3417/3417886.png', test: (s)=> s.hunters >= 20 },
  { id: '25_traps',      name: 'Хозяин угодий',       desc: 'Поставить 25 ловушек',                 img: 'https://cdn-icons-png.flaticon.com/512/2921/2921822.png', test: (s)=> s.traps >= 25 },
  { id: '1000_furs',     name: 'Тысяча пушнины',      desc: 'Добыть 1000 пушнины',                  img: 'https://cdn-icons-png.flaticon.com/512/2682/2682065.png', test: (s)=> s.fursTotal >= 1000 },
  { id: 'pack_of_hounds',name: 'Верная стая',         desc: 'Собрать 10 охотничьих псов',           img: 'https://cdn-icons-png.flaticon.com/512/616/616408.png', test: (s)=> s.dogs >= 10 },
  { id: '5000_furs',     name: 'Богатства тайги',     desc: 'Добыть 5000 пушнины',                  img: 'https://cdn-icons-png.flaticon.com/512/1046/1046751.png', test: (s)=> s.fursTotal >= 5000 },
];

// Звук теперь управляется через soundManager.js

function hasAch(id){ return STATE.achievements.includes(id); }
function unlockAchievement(ach){
  if (hasAch(ach.id)) return;
  STATE.achievements.push(ach.id);
  saveSoon();
  renderAchievements();
  showAchievementToast(ach);
  playSound('achievement');
}
function checkAchievements(){
  for (const ach of ACHIEVEMENTS){ if (!hasAch(ach.id) && ach.test(STATE)) unlockAchievement(ach); }
}

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
  resetButton: $("reset"),
  achievementsBtn: $("achievementsBtn"),
  achievementsDropdown: $("achievementsDropdown"),
  achievementsList: $("achievementsList"),
  toastHost: $("achievementToastHost"),
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

function updateAffordability() {
  const canBuy = (cost) => STATE.furs >= cost;
  elements.trapsUpgrade.disabled   = !canBuy(COSTS.traps);
  elements.huntersUpgrade.disabled = !canBuy(COSTS.hunters);
  elements.zimovyeUpgrade.disabled = !canBuy(COSTS.zimovye);
  elements.dogsUpgrade.disabled    = (STATE.dogs >= 20) || !canBuy(COSTS.dogs);
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

  updateAffordability();
}

// ===== РЕНДЕР ДОСТИЖЕНИЙ =====
function renderAchievements(){
  // Очищаем список достижений
  elements.achievementsList.innerHTML = '';

  // Разделяем достижения на открытые и закрытые
  const opened = [], locked = [];
  for (const a of ACHIEVEMENTS){ (hasAch(a.id) ? opened : locked).push(a); }
  const list = [...opened, ...locked];

  // Создаем элементы через DOM API для лучшей безопасности
  for (const achievement of list) {
    const unlocked = hasAch(achievement.id);

    const li = document.createElement('li');
    li.className = `ach-card ${unlocked ? 'open' : 'locked'}`;
    li.role = 'menuitem';

    const img = document.createElement('img');
    img.src = achievement.img;
    img.alt = achievement.name;
    img.className = 'ach-img';

    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'ach-body';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'ach-title';
    titleDiv.textContent = achievement.name;

    const descDiv = document.createElement('div');
    descDiv.className = 'ach-desc';
    descDiv.textContent = achievement.desc;

    bodyDiv.appendChild(titleDiv);
    bodyDiv.appendChild(descDiv);
    li.appendChild(img);
    li.appendChild(bodyDiv);
    elements.achievementsList.appendChild(li);
  }
}

let _achievementsOpen = false;
function setAchievementsOpen(isOpen){
  _achievementsOpen = isOpen;
  elements.achievementsDropdown.classList.toggle('hidden', !isOpen);
  elements.achievementsDropdown.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  elements.achievementsBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  if (isOpen) renderAchievements();
}
function toggleAchievements(){ setAchievementsOpen(!_achievementsOpen); }

// ===== ТОСТ О ДОСТИЖЕНИИ =====
function showAchievementToast(ach){
  // Создаем тост-уведомление через DOM API для лучшей безопасности
  const card = document.createElement('div');
  card.className = 'toast-card';

  const glowDiv = document.createElement('div');
  glowDiv.className = 'toast-glow';

  const img = document.createElement('img');
  img.src = ach.img;
  img.alt = ach.name;

  const textDiv = document.createElement('div');
  textDiv.className = 'toast-text';

  const strong = document.createElement('strong');
  strong.textContent = ach.name;

  const br = document.createElement('br');
  const descText = document.createTextNode(ach.desc);

  textDiv.appendChild(strong);
  textDiv.appendChild(br);
  textDiv.appendChild(descText);

  card.appendChild(glowDiv);
  card.appendChild(img);
  card.appendChild(textDiv);

  card.addEventListener('click', ()=> card.remove());
  elements.toastHost.appendChild(card);
  setTimeout(()=> card.remove(), 10000);
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
  // Сохраняем игровое состояние в localStorage
  try {
    const payload = {
      furs: Math.max(0, Number(STATE.furs)||0),
      hunters: Math.max(0, Number(STATE.hunters)||0),
      traps: Math.max(0, Number(STATE.traps)||0),
      zimovye: Math.max(0, Number(STATE.zimovye)||0),
      dogs: Math.max(0, Number(STATE.dogs)||0),
      achievements: Array.from(new Set(STATE.achievements)),
      fursTotal: Math.max(0, Number(STATE.fursTotal)||0),
      savedAt: Date.now()
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    _dirty = false; _lastAutoSave = Date.now();
  } catch (e) {
    // В продакшене можно убрать это предупреждение
    // console.error("Save failed:", e);
  }
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
  STATE.achievements = Array.isArray(data.achievements) ? data.achievements.slice(0) : [];
  STATE.fursTotal = Math.max(0, Number(data.fursTotal)||0);
  recalcRates();
}
window.addEventListener('visibilitychange', ()=>{ if (document.hidden && _dirty) saveNow(); });
window.addEventListener('beforeunload', ()=>{ if (_dirty) saveNow(); });

// ===== СБРОС ПРОГРЕССА =====
function resetProgress() {
  const ok = confirm('Сбросить весь прогресс? Это действие необратимо.');
  if (!ok) return;
  try { localStorage.removeItem(SAVE_KEY); } catch {}
  STATE.furs = 0; STATE.hunters = 0; STATE.traps = 0; STATE.zimovye = 0; STATE.dogs = 0;
  STATE.forceNextCrit = false; _secAcc = 0; _passiveCarry = 0; _dirty = false;
  STATE.achievements = []; STATE.fursTotal = 0;
  recalcRates(); renderNow(); renderAchievements();
}

// ===== АНИМАЦИЯ ЛИСЫ =====
function createFoxElement() {
  // Создаем анимацию лисы через DOM API для лучшей безопасности
  const fox = document.createElement("div");
  fox.className = "fox-animation";

  const foxText = document.createTextNode('🦊 ');
  const gainSpan = document.createElement("span");
  gainSpan.className = "gain";

  fox.appendChild(foxText);
  fox.appendChild(gainSpan);
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
  const jx = (Math.random() - 0.5) * 180;
  const jy = (Math.random() - 0.5) * 120;
  const x = rect.left + rect.width/2 + jx;
  const y = rect.top + rect.height/2 + jy;
  showFoxAnimation(x, y, amountInt, false);
}

// ===== ИГРОВАЯ ЛОГИКА =====
function getCritChance() { return Math.min(STATE.dogs * 0.005, 0.10); } // 0.5% за уровень, максимум 10%
function addClick(ev) {
  let isCrit=false; if (STATE.forceNextCrit){ isCrit=true; STATE.forceNextCrit=false; } else if (Math.random()<getCritChance()){ isCrit=true; }
  const gain = (isCrit?5:1) * STATE.clickPower; STATE.furs += gain; STATE.fursTotal += gain;
  if (isCrit) playSound('crit');
  markDirtyAndMaybeSave(); requestRender();
  const x = ev?.clientX ?? (window.innerWidth/2), y = ev?.clientY ?? (window.innerHeight/2);
  showFoxAnimation(x, y, gain, isCrit); if (navigator.vibrate) navigator.vibrate(isCrit?25:10);
  checkAchievements();
}
function buyHunters(){ const cost=COSTS.hunters; if(STATE.furs>=cost){ STATE.furs-=cost; STATE.hunters+=1; recalcRates(); markDirtyAndMaybeSave(); requestRender(); checkAchievements(); }}
function buyTraps(){ const cost=COSTS.traps; if(STATE.furs>=cost){ STATE.furs-=cost; STATE.traps+=1; recalcRates(); markDirtyAndMaybeSave(); requestRender(); checkAchievements(); }}
function buyZimovye(){ const cost=COSTS.zimovye; if(STATE.furs>=cost){ STATE.furs-=cost; STATE.zimovye+=1; recalcRates(); markDirtyAndMaybeSave(); requestRender(); }}
function buyDogs(){ const cost=COSTS.dogs; if(STATE.dogs>=20) return; if(STATE.furs>=cost){ STATE.furs-=cost; STATE.dogs+=1; STATE.forceNextCrit=true; markDirtyAndMaybeSave(); requestRender(); }}

// ===== ОБРАБОТЧИКИ =====
function handleClick(ev){ addClick(ev); }
function handleHunterUpgrade(){ buyHunters(); }
function handleTrapUpgrade(){ buyTraps(); }
function handleZimovyeUpgrade(){ buyZimovye(); }
function handleDogsUpgrade(){ buyDogs(); }

// ===== ДОХОД ПО ВРЕМЕНИ (реальное время) =====
// Используем requestAnimationFrame для плавной анимации, но сохраняем реальные секунды для дохода
function incomeTick(nowMs){
  if (_lastTick===0) _lastTick=nowMs;

  // Вычисляем реальное время в секундах для точного расчета дохода
  const dt = Math.max(0, (nowMs - _lastTick)/1000);
  _lastTick = nowMs;
  _secAcc += dt;

  // Обрабатываем накопленные секунды для пассивного дохода
  while (_secAcc >= 1) {
    const fps = computeFps();
    const total = _passiveCarry + fps;
    const intAdd = Math.floor(total);
    _passiveCarry = total - intAdd;

    if (intAdd > 0) {
      STATE.furs += intAdd;
      STATE.fursTotal += intAdd;
      showPassiveFox(intAdd);
      markDirtyAndMaybeSave();
      checkAchievements();
    }
    _secAcc -= 1;
  }

  // Обновляем UI через requestAnimationFrame для плавности
  requestRender();

  // Автосохранение каждые 30 секунд
  if (_dirty && nowMs - _lastAutoSave > 30000) {
    saveNow();
  }

  // Продолжаем цикл анимации
  requestAnimationFrame(incomeTick);
}

// ===== ИНИЦИАЛИЗАЦИЯ ИГРЫ =====
function init(){
  // Загружаем сохраненное состояние игры
  loadGame();
  recalcRates();
  checkAchievements();

  // Подключаем обработчики событий для интерактивных элементов
  elements.clickButton.addEventListener("click", handleClick);
  elements.huntersUpgrade.addEventListener("click", handleHunterUpgrade);
  elements.trapsUpgrade.addEventListener("click", handleTrapUpgrade);
  elements.zimovyeUpgrade.addEventListener("click", handleZimovyeUpgrade);
  elements.dogsUpgrade.addEventListener("click", handleDogsUpgrade);
  elements.resetButton.addEventListener("click", resetProgress);

  // Обработчики для системы достижений
  elements.achievementsBtn.addEventListener('click', (ev)=>{ ev.stopPropagation(); toggleAchievements(); });
  elements.achievementsDropdown.addEventListener('click', (ev)=> ev.stopPropagation());
  document.addEventListener('click', (ev)=>{
    if (!_achievementsOpen) return;
    if (!elements.achievementsBtn.contains(ev.target) && !elements.achievementsDropdown.contains(ev.target)) {
      setAchievementsOpen(false);
    }
  });
  document.addEventListener('keydown', (ev)=>{ if (ev.key === 'Escape' && _achievementsOpen) setAchievementsOpen(false); });

  // Инициализируем UI и запускаем игровой цикл
  renderAchievements();
  setAchievementsOpen(false);
  renderNow();
  requestAnimationFrame(incomeTick);
}

// Запускаем игру когда DOM готов
if (document.readyState==='complete' || document.readyState==='interactive') {
  init();
} else {
  window.addEventListener('DOMContentLoaded', init);
}
