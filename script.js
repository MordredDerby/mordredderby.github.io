// ===== ОСНОВНЫЕ ПЕРЕМЕННЫЕ =====
let furs = 0;
let fursPerSecond = 0;
let clickPower = 1;
let hunters = 0;
let traps = 0;

// ===== DOM ЭЛЕМЕНТЫ =====
const elements = {
    score: document.getElementById("score"),
    fps: document.getElementById("fursPerSecond"),
    clickPower: document.getElementById("clickPower"),
    clickButton: document.getElementById("clickButton"),
    huntersUpgrade: document.getElementById("hunters"),
    trapsUpgrade: document.getElementById("traps")
};

// ===== СИСТЕМА СОХРАНЕНИЯ =====
const SAVE_KEY = "yasakClickerSave_v2";

function saveGame() {
    const gameData = {
        version: 2,
        furs: furs,
        fursPerSecond: fursPerSecond,
        clickPower: clickPower,
        hunters: hunters,
        traps: traps,
        savedAt: new Date().toISOString()
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(gameData));
}

function loadGame() {
    const savedData = localStorage.getItem(SAVE_KEY);
    if (!savedData) return;

    try {
        const data = JSON.parse(savedData);
        if (data.version === 2) {
            furs = data.furs || 0;
            fursPerSecond = data.fursPerSecond || 0;
            clickPower = data.clickPower || 1;
            hunters = data.hunters || 0;
            traps = data.traps || 0;
        }
    } catch (e) {
        console.error("Ошибка загрузки:", e);
    }
}

// ===== АНИМАЦИЯ ЛИСЫ =====
function createFoxElement() {
    const fox = document.createElement("div");
    fox.className = "fox-animation";
    fox.innerHTML = "🦊";
    document.body.appendChild(fox);
    return fox;
}

function showFoxAnimation(x, y) {
    const fox = createFoxElement();
    
    // Начальная позиция
    fox.style.left = `${x - 15}px`;
    fox.style.top = `${y - 15}px`;
    fox.style.opacity = "1";
    fox.style.transform = "scale(1)";

    // Анимация
    setTimeout(() => {
        fox.style.top = `${y - 100}px`;
        fox.style.opacity = "0";
        fox.style.transform = "scale(1.5) rotate(15deg)";
    }, 10);

    // Удаление после анимации
    setTimeout(() => {
        fox.remove();
    }, 600);
}

// ===== ОБРАБОТЧИКИ СОБЫТИЙ =====
function handleClick(event) {
    // Получаем координаты клика
    const clickX = event.clientX;
    const clickY = event.clientY;
    
    // Игровая логика
    furs += clickPower;
    updateUI();
    saveGame();
    
    // Запуск анимации
    showFoxAnimation(clickX, clickY);
    
    // Вибро-эффект для кнопки (если поддерживается)
    if (window.navigator.vibrate) {
        window.navigator.vibrate(10);
    }
}

function handleHunterUpgrade() {
    if (furs >= 20) {
        furs -= 20;
        hunters++;
        fursPerSecond += 1;
        updateUI();
        saveGame();
    }
}

function handleTrapUpgrade() {
    if (furs >= 50) {
        furs -= 50;
        traps++;
        clickPower += 1;
        updateUI();
        saveGame();
    }
}

// ===== ОБНОВЛЕНИЕ ИНТЕРФЕЙСА =====
function updateUI() {
    elements.score.textContent = `Пушнина: ${furs}`;
    elements.fps.textContent = `${fursPerSecond} шкурок/сек`;
    elements.clickPower.textContent = `За клик: ${clickPower}`;
    elements.huntersUpgrade.textContent = `Охотники (20) [${hunters}]`;
    elements.trapsUpgrade.textContent = `Ловушки (50) [${traps}]`;
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
function init() {
    // Загрузка сохранения
    loadGame();
    
    // Назначение обработчиков
    elements.clickButton.addEventListener("click", handleClick);
    elements.huntersUpgrade.addEventListener("click", handleHunterUpgrade);
    elements.trapsUpgrade.addEventListener("click", handleTrapUpgrade);
    
    // Автоматический доход
    setInterval(() => {
        if (fursPerSecond > 0) {
            furs += fursPerSecond;
            updateUI();
            if (Date.now() % 5000 < 100) saveGame();
        }
    }, 1000);
    
    // Первое обновление UI
    updateUI();
}

// Запуск игры после полной загрузки страницы
if (document.readyState === "complete") {
    init();
} else {
    window.addEventListener("load", init);
}