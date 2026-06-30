// =========================
// 难度配置
// =========================

const DIFFICULTY = {
    beginner:     { label: "初级", rows: 9,  cols: 9,  mines: 10, cellSize: 32 },
    intermediate: { label: "中级", rows: 16, cols: 16, mines: 40, cellSize: 30 },
    expert:       { label: "高级", rows: 16, cols: 30, mines: 99, cellSize: 28 },
};

// 当前难度
let currentDifficulty = "beginner";
let ROWS, COLS, MINE_COUNT, CELL_SIZE;


// =========================
// 8 方向偏移
// =========================

const DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [ 0, -1],          [ 0, 1],
    [ 1, -1], [ 1, 0], [ 1, 1]
];


// =========================
// Cell 类
// =========================

class Cell {

    constructor(row, col) {
        this.row = row;
        this.col = col;
        this.mine = false;
        this.number = 0;
        this.open = false;
        this.flag = false;
        this.element = null;
    }

}


// =========================
// 游戏状态
// =========================

const board = [];

let gameOver = false;
let gameWin = false;
let firstClick = true;
let flagCount = 0;

let timerInterval = null;
let secondsElapsed = 0;


// =========================
// DOM 元素
// =========================

const boardElement   = document.getElementById("board");
const mineCountEl    = document.getElementById("mine-count");
const timerEl        = document.getElementById("timer");
const restartBtn     = document.getElementById("restart");
const diffButtons    = document.querySelectorAll(".difficulty-bar:not(#multi-diff-bar) > .diff-btn");

// 设置面板
const settingsToggleBtn = document.getElementById("settings-toggle");
const settingsOverlay   = document.getElementById("settings-overlay");
const settingsPanel     = document.getElementById("settings-panel");
const settingsCloseBtn  = document.getElementById("settings-close");
const settingVolume     = document.getElementById("setting-volume");
const volumeVal         = document.getElementById("volume-val");
const settingParticles  = document.getElementById("setting-particles");
const settingAnimations = document.getElementById("setting-animations");
const settingCustom     = document.getElementById("setting-custom");
const settingsResetBtn  = document.getElementById("settings-reset");
const customFields      = document.getElementById("custom-difficulty-fields");
const customRows        = document.getElementById("custom-rows");
const customCols        = document.getElementById("custom-cols");
const customMines       = document.getElementById("custom-mines");
const maxMinesHint      = document.getElementById("max-mines-hint");
const applyCustomBtn    = document.getElementById("apply-custom");
const bgCanvas          = document.getElementById("bg-canvas");


// =========================
// 设置状态
// =========================

const DEFAULT_SETTINGS = {
    volume: 30,
    particles: true,
    animations: true,
    custom: false,
    theme: "night",
};

const settings = { ...DEFAULT_SETTINGS };

(function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem("minesweeper-settings"));
        if (saved) {
            settings.volume     = saved.volume     ?? DEFAULT_SETTINGS.volume;
            settings.particles  = saved.particles  ?? DEFAULT_SETTINGS.particles;
            settings.animations = saved.animations ?? DEFAULT_SETTINGS.animations;
            settings.custom     = saved.custom     ?? DEFAULT_SETTINGS.custom;
            settings.theme      = saved.theme      ?? DEFAULT_SETTINGS.theme;
            // 兼容旧版 sound 字段
            if (saved.sound === false) settings.volume = 0;
        }
    } catch (_) { /* 忽略 */ }
})();

function persistSettings() {
    try {
        localStorage.setItem("minesweeper-settings", JSON.stringify(settings));
    } catch (_) { /* 忽略 */ }
}

function resetSettings() {
    Object.assign(settings, DEFAULT_SETTINGS);
    persistSettings();
    applySettingsUI();
}

function applySettingsUI() {
    settingVolume.value = settings.volume;
    volumeVal.textContent = settings.volume + "%";
    settingParticles.checked = settings.particles;
    settingAnimations.checked = settings.animations;
    settingCustom.checked = settings.custom;

    if (settings.custom) {
        customFields.classList.remove("collapsed");
    } else {
        customFields.classList.add("collapsed");
    }

    if (settings.particles) {
        bgCanvas.style.display = "";
    } else {
        bgCanvas.style.display = "none";
    }

    // 动画开关影响 CSS
    document.documentElement.classList.toggle("no-anim", !settings.animations);

    // 主题
    document.documentElement.setAttribute("data-theme", settings.theme);
    document.querySelectorAll("#theme-grid .theme-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.theme === settings.theme);
    });
}

applySettingsUI();


// =========================
// 音效系统 (Web Audio API)
// =========================

let audioCtx = null;

function getAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

/** 播放一个简单音调 */
function playTone(freq, duration, type = "square", volume = 0.08, delay = 0) {
    try {
        const ctx = getAudioCtx();
        const t = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(volume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t);
        osc.stop(t + duration);
    } catch (_) { /* 静默处理音频错误 */ }
}

/** 从设置中获取当前音量倍率 (0–1) */
function volScale() {
    return settings.volume / 100;
}

// --- 音效预设 ---

function sfxClick() {
    if (settings.volume <= 0) return;
    playTone(800, 0.06, "square", 0.04 * volScale());
}

function sfxFlag() {
    if (settings.volume <= 0) return;
    const v = volScale();
    playTone(1200, 0.08, "sine", 0.05 * v);
    playTone(1400, 0.06, "sine", 0.04 * v, 0.06);
}

function sfxReveal() {
    if (settings.volume <= 0) return;
    const v = volScale();
    playTone(500, 0.12, "sine", 0.03 * v);
    playTone(700, 0.10, "sine", 0.03 * v, 0.08);
}

function sfxLose() {
    if (settings.volume <= 0) return;
    const v = volScale();
    const notes = [600, 500, 400, 300, 200];
    notes.forEach((freq, i) => {
        playTone(freq, 0.25, "sawtooth", 0.06 * v, i * 0.15);
    });
    setTimeout(() => playTone(80, 0.8, "sawtooth", 0.08 * v), notes.length * 150);
}

function sfxWin() {
    if (settings.volume <= 0) return;
    const v = volScale();
    const notes = [523, 659, 784, 1047, 1319, 1568];
    notes.forEach((freq, i) => {
        playTone(freq, 0.22, "sine", 0.07 * v, i * 0.12);
    });
    setTimeout(() => {
        playTone(523, 0.5, "triangle", 0.06 * v, 0);
        playTone(659, 0.5, "triangle", 0.06 * v, 0);
        playTone(784, 0.5, "triangle", 0.06 * v, 0);
        playTone(1047, 0.5, "triangle", 0.06 * v, 0);
    }, notes.length * 120 + 60);
}


// =========================
// 背景粒子动画
// =========================

function initBgParticles() {
    const canvas = document.getElementById("bg-canvas");
    if (!canvas) return;
    const ctx2 = canvas.getContext("2d");

    let w, h;
    const particles = [];
    const PARTICLE_COUNT = 60;

    function resize() {
        w = canvas.width  = window.innerWidth;
        h = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
            r: Math.random() * 2 + 0.8,
            alpha: Math.random() * 0.5 + 0.15,
        });
    }

    function draw() {
        ctx2.clearRect(0, 0, w, h);

        for (const p of particles) {
            p.x += p.vx;
            p.y += p.vy;

            // 循环边界
            if (p.x < 0) p.x = w;
            if (p.x > w) p.x = 0;
            if (p.y < 0) p.y = h;
            if (p.y > h) p.y = 0;

            ctx2.beginPath();
            ctx2.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx2.fillStyle = `rgba(233, 69, 96, ${p.alpha})`;
            ctx2.fill();
        }

        // 连线
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    ctx2.beginPath();
                    ctx2.moveTo(particles[i].x, particles[i].y);
                    ctx2.lineTo(particles[j].x, particles[j].y);
                    ctx2.strokeStyle = `rgba(233, 69, 96, ${0.06 * (1 - dist / 120)})`;
                    ctx2.lineWidth = 0.5;
                    ctx2.stroke();
                }
            }
        }

        requestAnimationFrame(draw);
    }

    draw();
}


// =========================
// 工具函数
// =========================

function inBounds(r, c) {
    return r >= 0 && r < ROWS && c >= 0 && c < COLS;
}

/** 格式化数字为 3 位 LED 显示 */
function fmtLED(n) {
    return String(Math.max(0, Math.min(999, n))).padStart(3, "0");
}

/**
 * 为格子添加长按插旗支持（触屏设备）
 * @param {HTMLElement} el - 格子 DOM 元素
 * @param {Function} onFlag - 插旗回调
 */
function addLongPressSupport(el, onFlag) {
    let pressTimer = null;
    let startX = 0, startY = 0;

    el.addEventListener("touchstart", (e) => {
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        pressTimer = setTimeout(() => {
            pressTimer = null;
            e.preventDefault();
            onFlag();
        }, 500);
    }, { passive: false });

    el.addEventListener("touchmove", (e) => {
        if (!pressTimer) return;
        const touch = e.touches[0];
        if (Math.abs(touch.clientX - startX) > 10 ||
            Math.abs(touch.clientY - startY) > 10) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
    });

    el.addEventListener("touchend", () => {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
    });

    el.addEventListener("touchcancel", () => {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
    });
}


// =========================
// 初始化棋盘数据
// =========================

function initBoard() {

    board.length = 0;

    for (let r = 0; r < ROWS; r++) {
        board[r] = [];
        for (let c = 0; c < COLS; c++) {
            board[r][c] = new Cell(r, c);
        }
    }

}


// =========================
// 埋雷（避开首次点击位置及其周围 8 格）
// =========================

function placeMines(safeRow, safeCol) {

    const candidates = [];

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (Math.abs(r - safeRow) <= 1 && Math.abs(c - safeCol) <= 1) {
                continue;
            }
            candidates.push({ r, c });
        }
    }

    // Fisher-Yates 洗牌
    for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    for (let i = 0; i < MINE_COUNT && i < candidates.length; i++) {
        const { r, c } = candidates[i];
        board[r][c].mine = true;
    }

    // 绝对安全：显式清除第一步格（及周围 8 格）的雷，防止任何边界情况
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const rr = safeRow + dr;
            const cc = safeCol + dc;
            if (inBounds(rr, cc)) {
                board[rr][cc].mine = false;
            }
        }
    }

}


// =========================
// 计算数字
// =========================

function calculateNumbers() {

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {

            if (board[r][c].mine) continue;

            let count = 0;
            for (const [dr, dc] of DIRECTIONS) {
                const nr = r + dr;
                const nc = c + dc;
                if (inBounds(nr, nc) && board[nr][nc].mine) {
                    count++;
                }
            }
            board[r][c].number = count;

        }
    }

}


// =========================
// 渲染棋盘
// =========================

function renderBoard() {

    boardElement.innerHTML = "";
    boardElement.style.gridTemplateColumns = `repeat(${COLS}, ${CELL_SIZE}px)`;
    document.documentElement.style.setProperty("--cell-size", `${CELL_SIZE}px`);

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {

            const cell = board[r][c];
            const el = document.createElement("div");

            el.classList.add("cell");
            el.dataset.row = r;
            el.dataset.col = c;

            // 左键 → 翻开
            el.addEventListener("click", () => onCellClick(cell));

            // 右键 → 插旗
            el.addEventListener("contextmenu", (e) => {
                e.preventDefault();
                onCellRightClick(cell);
            });

            // 触屏长按 → 插旗
            addLongPressSupport(el, () => onCellRightClick(cell));

            cell.element = el;
            boardElement.appendChild(el);

        }
    }

}


// =========================
// 更新格子外观
// =========================

function updateCellDisplay(cell) {

    const el = cell.element;
    if (!el) return;

    el.classList.remove("open", "flag", "mine", "mine-death", "flag-wrong");
    el.textContent = "";

    if (cell.open) {

        el.classList.add("open");

        if (cell.mine) {
            el.classList.add("mine");
            el.textContent = "💣";
        } else if (cell.number > 0) {
            el.textContent = cell.number;
            el.classList.add(`n${cell.number}`);
        }

    } else if (cell.flag) {

        el.classList.add("flag");
        el.textContent = "🚩";

    }

}


// =========================
// 翻开 & 展开
// =========================

function openCell(cell) {

    if (gameOver || gameWin) return;
    if (cell.open || cell.flag) return;

    cell.open = true;

    if (cell.mine) {
        cell.element.classList.add("mine-death");
        sfxLose();
        triggerGameOver(cell);
        return;
    }

    // 累加翻开数，用于判断是否播放展开音效
    updateCellDisplay(cell);

    if (cell.number === 0) {
        for (const [dr, dc] of DIRECTIONS) {
            const nr = cell.row + dr;
            const nc = cell.col + dc;
            if (inBounds(nr, nc)) {
                openCell(board[nr][nc]);
            }
        }
    }

}


// =========================
// 左键点击
// =========================

function onCellClick(cell) {

    if (gameOver || gameWin) return;
    if (cell.flag) return;

    const wasFirst = firstClick;

    if (firstClick) {
        firstClick = false;
        placeMines(cell.row, cell.col);

        // 最后防线：若因任何边界情况第一步格仍是雷，当场迁走
        if (cell.mine) {
            cell.mine = false;
            for (let rr = 0; rr < ROWS; rr++) {
                for (let cc = 0; cc < COLS; cc++) {
                    if (Math.abs(rr - cell.row) <= 1 && Math.abs(cc - cell.col) <= 1) continue;
                    if (!board[rr][cc].mine) {
                        board[rr][cc].mine = true;
                        break;
                    }
                }
            }
        }

        calculateNumbers();
        startTimer();
    }

    sfxClick();

    openCell(cell);

    // 如果翻开的是一片空地，额外播放展开音效
    if (!cell.mine && cell.number === 0 && !wasFirst) {
        sfxReveal();
    }

    if (!gameOver) {
        checkWin();
    }

}


// =========================
// 右键插旗 / 取消
// =========================

function onCellRightClick(cell) {

    if (gameOver || gameWin) return;
    if (cell.open) return;

    cell.flag = !cell.flag;

    if (cell.flag) {
        flagCount++;
    } else {
        flagCount--;
    }

    sfxFlag();
    updateCellDisplay(cell);
    updateMineCountDisplay();

}


// =========================
// 游戏结束
// =========================

function triggerGameOver(clickedCell) {

    gameOver = true;
    stopTimer();
    restartBtn.textContent = "😵";

    // 记录失败战绩
    recordGame(false, secondsElapsed);

    // 翻开所有雷
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = board[r][c];
            if (cell.mine && cell !== clickedCell) {
                cell.open = true;
                updateCellDisplay(cell);
            }
            // 标记错误的旗
            if (cell.flag && !cell.mine) {
                cell.element.classList.add("flag-wrong");
                cell.element.textContent = "❌";
            }
        }
    }

}


// =========================
// 检查胜利
// =========================

function checkWin() {

    let allOpened = true;

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = board[r][c];
            if (!cell.mine && !cell.open) {
                allOpened = false;
            }
        }
    }

    if (allOpened) {
        gameWin = true;
        stopTimer();

        // 记录胜利战绩
        recordGame(true, secondsElapsed);

        // 自动插旗
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const cell = board[r][c];
                if (cell.mine && !cell.flag) {
                    cell.flag = true;
                    updateCellDisplay(cell);
                }
            }
        }

        flagCount = MINE_COUNT;
        updateMineCountDisplay();
        restartBtn.textContent = "😎";
        sfxWin();
    }

}


// =========================
// 计时器
// =========================

function startTimer() {

    secondsElapsed = 0;
    timerEl.querySelector(".led-value").textContent = "000";

    timerInterval = setInterval(() => {
        secondsElapsed++;
        if (secondsElapsed > 999) secondsElapsed = 999;
        timerEl.querySelector(".led-value").textContent = fmtLED(secondsElapsed);
    }, 1000);

}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}


// =========================
// 更新剩余雷数
// =========================

function updateMineCountDisplay() {
    const remaining = MINE_COUNT - flagCount;
    mineCountEl.querySelector(".led-value").textContent = fmtLED(remaining);
}


// =========================
// 重新开始
// =========================

function restart() {

    stopTimer();

    gameOver = false;
    gameWin = false;
    firstClick = true;
    flagCount = 0;
    secondsElapsed = 0;

    timerEl.querySelector(".led-value").textContent = "000";
    updateMineCountDisplay();
    restartBtn.textContent = "😊";

    initBoard();
    renderBoard();

}


// =========================
// 切换难度
// =========================

function setDifficulty(level) {

    if (level === currentDifficulty) return;
    currentDifficulty = level;

    // 更新按钮状态
    diffButtons.forEach(btn => {
        btn.classList.toggle("active", btn.dataset.level === level);
    });

    // 应用配置
    const cfg = DIFFICULTY[level];
    ROWS       = cfg.rows;
    COLS       = cfg.cols;
    MINE_COUNT = cfg.mines;
    CELL_SIZE  = cfg.cellSize;

    // 根据当前模式重新初始化
    if (currentMode === "vs") {
        initVsMode();
    } else if (currentMode === "multiplayer") {
        // 多人模式下不重置，难度通过房间面板选择
    } else {
        restart();
    }
}


// =========================
// 事件绑定
// =========================

restartBtn.addEventListener("click", restart);

diffButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        setDifficulty(btn.dataset.level);
    });
});


// =========================
// 设置面板事件
// =========================

function openSettings() {
    settingsOverlay.classList.add("open");
    settingsPanel.classList.add("open");
    settingsToggleBtn.style.opacity = "0";
    settingsToggleBtn.style.pointerEvents = "none";
}

function closeSettings() {
    settingsOverlay.classList.remove("open");
    settingsPanel.classList.remove("open");
    settingsToggleBtn.style.opacity = "";
    settingsToggleBtn.style.pointerEvents = "";
}

settingsToggleBtn.addEventListener("click", openSettings);
settingsCloseBtn.addEventListener("click", closeSettings);
settingsOverlay.addEventListener("click", closeSettings);

settingVolume.addEventListener("input", () => {
    settings.volume = parseInt(settingVolume.value);
    volumeVal.textContent = settings.volume + "%";
    persistSettings();
});

settingParticles.addEventListener("change", () => {
    settings.particles = settingParticles.checked;
    persistSettings();
    bgCanvas.style.display = settings.particles ? "" : "none";
});

settingAnimations.addEventListener("change", () => {
    settings.animations = settingAnimations.checked;
    persistSettings();
    document.documentElement.classList.toggle("no-anim", !settings.animations);
});

settingCustom.addEventListener("change", () => {
    settings.custom = settingCustom.checked;
    persistSettings();
    if (settings.custom) {
        customFields.classList.remove("collapsed");
    } else {
        customFields.classList.add("collapsed");
    }
});

settingsResetBtn.addEventListener("click", () => {
    resetSettings();
});

// 主题切换
document.querySelectorAll("#theme-grid .theme-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        settings.theme = btn.dataset.theme;
        persistSettings();
        applySettingsUI();
    });
});

function updateMaxMinesHint() {
    const rows = parseInt(customRows.value) || 9;
    const cols = parseInt(customCols.value) || 9;
    const maxMines = Math.max(1, rows * cols - 9);
    maxMinesHint.textContent = maxMines;
    customMines.max = maxMines;
    if (parseInt(customMines.value) > maxMines) {
        customMines.value = maxMines;
    }
}

customRows.addEventListener("input", updateMaxMinesHint);
customCols.addEventListener("input", updateMaxMinesHint);

applyCustomBtn.addEventListener("click", () => {
    const rows = Math.max(5, Math.min(30, parseInt(customRows.value) || 9));
    const cols = Math.max(5, Math.min(40, parseInt(customCols.value) || 9));
    const maxMines = Math.max(1, rows * cols - 9);
    const mines = Math.max(1, Math.min(maxMines, parseInt(customMines.value) || 10));

    customRows.value = rows;
    customCols.value = cols;
    customMines.value = mines;

    ROWS       = rows;
    COLS       = cols;
    MINE_COUNT = mines;
    CELL_SIZE  = rows > 12 || cols > 20 ? 26 : rows > 9 ? 30 : 32;
    currentDifficulty = "custom";

    diffButtons.forEach(btn => btn.classList.remove("active"));

    updateMaxMinesHint();
    if (currentMode === "vs") {
        initVsMode();
    } else if (currentMode === "multiplayer") {
        // 多人模式难度由房间面板控制，不重置棋盘
    } else {
        restart();
    }
    closeSettings();
});

updateMaxMinesHint();


// =========================
// 黑夜/白天模式切换
// =========================

const THEME_STORAGE_KEY = "minesweeper-color-mode";
const themeToggleBtn = document.getElementById("theme-toggle");

/** 检查 localStorage 或系统偏好，返回 "dark" 或 "light" */
function getColorMode() {
    try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        if (saved === "light" || saved === "dark") return saved;
    } catch (_) { /* 忽略 */ }
    // 跟随系统偏好
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
        return "light";
    }
    return "dark"; // 默认黑夜
}

/** 应用颜色模式到 DOM */
function applyColorMode(mode) {
    if (mode === "light") {
        document.body.classList.add("light-mode");
        document.body.classList.remove("dark-mode");
        if (themeToggleBtn) {
            themeToggleBtn.textContent = "🌙";  // 月亮 → 可切换到黑夜
            themeToggleBtn.title = "切换至黑夜模式";
        }
    } else {
        document.body.classList.remove("light-mode");
        document.body.classList.add("dark-mode");
        if (themeToggleBtn) {
            themeToggleBtn.textContent = "☀️";  // 太阳 → 可切换到白天
            themeToggleBtn.title = "切换至白天模式";
        }
    }
    try { localStorage.setItem(THEME_STORAGE_KEY, mode); } catch (_) { /* 忽略 */ }
}

/** 切换模式 */
function toggleColorMode() {
    const isLight = document.body.classList.contains("light-mode");
    applyColorMode(isLight ? "dark" : "light");
}

// 初始化
applyColorMode(getColorMode());
themeToggleBtn.addEventListener("click", toggleColorMode);


// =========================
// 程序入口
// =========================

const initCfg = DIFFICULTY[currentDifficulty];
ROWS = initCfg.rows;
COLS = initCfg.cols;
MINE_COUNT = initCfg.mines;
CELL_SIZE = initCfg.cellSize;

initBoard();
renderBoard();
updateMineCountDisplay();
initBgParticles();


// =========================
// 用户系统 (localStorage)
// =========================

const USER_STORAGE_KEY = "minesweeper-users";
const SESSION_KEY = "minesweeper-session";

// =========================
// API 通信（服务端账号系统）
// =========================

/**
 * 调用服务端 API，失败时返回 null（不抛异常）
 * 内置 10 秒超时，避免手机端网络不通时长时间卡死
 */
async function apiCall(endpoint, data) {
    try {
        const base = window.location.origin;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(base + endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const json = await res.json();
        return json;
    } catch (_) {
        // 网络不通、超时或服务端未启动 → 返回 null，由调用方降级到 localStorage
        return null;
    }
}

/**
 * 使用 SubtleCrypto 计算 SHA-256 哈希（hex 字符串）
 *
 * 注意：crypto.subtle 需要"安全上下文"（HTTPS 或 localhost）。
 * 手机端通过 HTTP 访问（如 http://192.168.x.x:3000）时，
 * crypto.subtle 为 undefined，会抛出 TypeError。
 * 此处增加 try-catch 降级方案，确保登录流程不被中断。
 */
async function sha256(message) {
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(message);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    } catch (_) {
        // 降级：crypto.subtle 不可用时（如手机端 HTTP 访问），
        // 返回 null 由调用方决定如何处理（服务端登录路径可跳过缓存，
        // 本地离线登录路径则需要提示用户使用 HTTPS）
        console.warn("[sha256] crypto.subtle 不可用，返回 null（可能为非安全上下文）");
        return null;
    }
}

/**
 * 读取所有用户
 */
function loadUsers() {
    try {
        return JSON.parse(localStorage.getItem(USER_STORAGE_KEY)) || {};
    } catch (_) {
        return {};
    }
}

/**
 * 保存所有用户
 */
function saveUsers(users) {
    try {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(users));
    } catch (_) { /* 忽略 */ }
}

/**
 * 大小写不敏感查找用户（本地 localStorage）
 * 返回 [key, user] 或 [null, null]
 */
function findUserLocal(username) {
    const users = loadUsers();
    const normalizedKey = (username || "").toLowerCase();
    const entry = Object.entries(users).find(
        ([key]) => key.toLowerCase() === normalizedKey
    );
    return entry ? { key: entry[0], user: entry[1] } : null;
}

/**
 * 获取当前会话
 */
function getSession() {
    try {
        return JSON.parse(localStorage.getItem(SESSION_KEY));
    } catch (_) {
        return null;
    }
}

/**
 * 保存会话
 */
function saveSession(username) {
    try {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ username }));
    } catch (_) { /* 忽略 */ }
}

/**
 * 清除会话
 */
function clearSession() {
    try {
        localStorage.removeItem(SESSION_KEY);
    } catch (_) { /* 忽略 */ }
}

// 当前登录用户（null 表示未登录）
let currentUser = getSession();

/**
 * 初始化各难度的最佳成绩记录
 */
function createDefaultStats() {
    return {
        games: 0,
        wins: 0,
        losses: 0,
        totalSeconds: 0,         // 总游戏时长（秒）
        history: [],             // 最近对局 [{ mode, difficulty, result, seconds, date }]
        bestTimes: {
            beginner: null,      // 秒
            intermediate: null,
            expert: null,
        },
    };
}

/**
 * 记录一局游戏（在游戏结束时调用）
 * @param {boolean} win - 是否胜利
 * @param {number} seconds - 用时（秒）
 * @param {string} mode - 模式: "classic" | "vs" | "multi"
 */
function recordGame(win, seconds, mode) {
    if (!currentUser) return;  // 未登录不记录

    const users = loadUsers();
    const username = currentUser.username;
    if (!users[username]) return;

    const stats = users[username].stats;
    stats.games++;
    stats.totalSeconds = (stats.totalSeconds || 0) + seconds;

    const gameMode = mode || currentMode;
    const diffKey = currentDifficulty === "custom" ? null : currentDifficulty;

    if (win) {
        stats.wins++;
        // 更新最佳成绩（仅经典模式计入最佳时间）
        if (gameMode === "classic" && diffKey && DIFFICULTY[diffKey]) {
            const prev = stats.bestTimes[diffKey];
            if (prev === null || seconds < prev) {
                stats.bestTimes[diffKey] = seconds;
            }
        }
    } else {
        stats.losses++;
    }

    // 添加到历史记录（最近20局）
    if (!stats.history) stats.history = [];
    stats.history.unshift({
        mode: gameMode,
        difficulty: diffKey || "custom",
        result: win ? "win" : "lose",
        seconds: seconds,
        date: new Date().toISOString(),
    });
    if (stats.history.length > 20) {
        stats.history = stats.history.slice(0, 20);
    }

    saveUsers(users);

    // 异步同步到服务端（不阻塞游戏流程）
    const user = users[username];
    apiCall("/api/save-stats", {
        username,
        stats,
        friends: user.friends,
        friendRequestsSent: user.friendRequestsSent,
        friendRequestsReceived: user.friendRequestsReceived,
    });
}


// =========================
// 用户面板 DOM
// =========================

const userToggleBtn      = document.getElementById("user-toggle");
const authOverlay        = document.getElementById("auth-overlay");
const authPanel          = document.getElementById("auth-panel");
const authCloseBtn       = document.getElementById("auth-close");
const authCloseBtn2      = document.getElementById("auth-close2");
const authTitle          = document.getElementById("auth-title");

const authViewLogin      = document.getElementById("auth-view-login");
const authViewProfile    = document.getElementById("auth-view-profile");

const loginForm          = document.getElementById("login-form");
const loginUsername      = document.getElementById("login-username");
const loginPassword      = document.getElementById("login-password");
const loginRemember      = document.getElementById("login-remember");
const loginMsg           = document.getElementById("login-msg");

const registerForm       = document.getElementById("register-form");
const regUsername        = document.getElementById("reg-username");
const regPassword        = document.getElementById("reg-password");
const regPassword2       = document.getElementById("reg-password2");
const regMsg             = document.getElementById("reg-msg");

const profileUsername    = document.getElementById("profile-username");
const profileJoinDate    = document.getElementById("profile-join-date");
const statGames          = document.getElementById("stat-games");
const statWins           = document.getElementById("stat-wins");
const statLosses         = document.getElementById("stat-losses");
const statWinrate        = document.getElementById("stat-winrate");
const bestTimesEl        = document.getElementById("best-times");
const logoutBtn          = document.getElementById("logout-btn");
const switchAccountBtn  = document.getElementById("switch-account-btn");
const editProfileBtn    = document.getElementById("edit-profile-btn");

// 编辑资料弹窗
const editProfileOverlay = document.getElementById("edit-profile-overlay");
const editProfilePanel  = document.getElementById("edit-profile-panel");
const editProfileClose  = document.getElementById("edit-profile-close");
const editProfileCancel = document.getElementById("edit-profile-cancel");
const editProfileSave   = document.getElementById("edit-profile-save");
const editProfileMsg    = document.getElementById("edit-profile-msg");
const profileNicknameInput = document.getElementById("profile-nickname-input");
const avatarPicker      = document.getElementById("avatar-picker");

// 好友面板
const friendsToggleBtn  = document.getElementById("friends-toggle");
const friendsOverlay    = document.getElementById("friends-overlay");
const friendsPanel      = document.getElementById("friends-panel");
const friendsCloseBtn   = document.getElementById("friends-close");
const friendsSearchInput = document.getElementById("friends-search-input");
const friendsAddBtn     = document.getElementById("friends-add-btn");
const friendsAddMsg     = document.getElementById("friends-add-msg");
const friendsListEl     = document.getElementById("friends-list");
const friendsEmptyEl    = document.getElementById("friends-empty");
const friendsRequestsSection = document.getElementById("friends-requests-section");
const friendsRequestsList    = document.getElementById("friends-requests-list");

const authTabs           = document.querySelectorAll(".auth-tab");


// =========================
// 面板开关
// =========================

function openAuthPanel() {
    authOverlay.classList.add("open");
    authPanel.classList.add("open");
    userToggleBtn.style.opacity = "0";
    userToggleBtn.style.pointerEvents = "none";

    if (currentUser) {
        showProfileView();
    } else {
        showLoginView();
    }
}

function closeAuthPanel() {
    authOverlay.classList.remove("open");
    authPanel.classList.remove("open");
    userToggleBtn.style.opacity = "";
    userToggleBtn.style.pointerEvents = "";
}

function showLoginView() {
    authViewLogin.style.display = "";
    authViewProfile.style.display = "none";
    // 默认显示登录表单
    switchAuthTab("login");
}

function showProfileView() {
    authViewLogin.style.display = "none";
    authViewProfile.style.display = "";
    updateProfileUI();
}


// =========================
// 选项卡切换
// =========================

function switchAuthTab(tab) {
    authTabs.forEach(t => t.classList.toggle("active", t.dataset.tab === tab));

    if (tab === "login") {
        loginForm.classList.add("active");
        registerForm.classList.remove("active");
        authTitle.textContent = "🔐 登 录";
    } else {
        loginForm.classList.remove("active");
        registerForm.classList.add("active");
        authTitle.textContent = "📝 注 册";
    }

    // 清空消息
    loginMsg.textContent = "";
    loginMsg.className = "auth-msg";
    regMsg.textContent = "";
    regMsg.className = "auth-msg";
}

authTabs.forEach(tab => {
    tab.addEventListener("click", () => {
        switchAuthTab(tab.dataset.tab);
    });
});


// =========================
// 表单验证
// =========================

/** 验证用户名格式：4-20位字母/数字/下划线 */
function isValidUsername(name) {
    return /^[a-zA-Z0-9_]{4,20}$/.test(name);
}

/** 验证密码长度：至少6位 */
function isValidPassword(pw) {
    return pw.length >= 6 && pw.length <= 30;
}


// =========================
// 注册
// =========================

async function handleRegister(e) {
    e.preventDefault();

    const username = regUsername.value.trim();
    const password = regPassword.value;
    const password2 = regPassword2.value;

    // 清空消息
    regMsg.textContent = "";
    regMsg.className = "auth-msg";

    // 验证
    if (!isValidUsername(username)) {
        regMsg.textContent = "⚠ 用户名需为4-20位字母/数字/下划线";
        regMsg.className = "auth-msg error";
        return;
    }
    if (!isValidPassword(password)) {
        regMsg.textContent = "⚠ 密码至少需要6位";
        regMsg.className = "auth-msg error";
        return;
    }
    if (password !== password2) {
        regMsg.textContent = "⚠ 两次输入的密码不一致";
        regMsg.className = "auth-msg error";
        return;
    }

    // 禁用提交按钮，防止重复点击
    const submitBtn = registerForm.querySelector("button[type=submit]");
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "注册中..."; }

    // 1. 尝试服务端注册（服务端做全局唯一性校验，确保跨设备账号统一）
    regMsg.textContent = "⏳ 正在连接服务器...";
    regMsg.className = "auth-msg";
    const result = await apiCall("/api/register", { username, password });

    // 恢复按钮
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "注 册"; }

    if (result && result.ok) {
        // 服务端注册成功 — 账号已全局持久化，所有设备均可登录
        regMsg.textContent = "✅ 注册成功！请切换到登录";
        regMsg.className = "auth-msg success";
        showToast("✅ 注册成功！请切换到登录页面", "success");
    } else if (result && !result.ok) {
        // 服务端明确拒绝（用户名已存在 / 格式错误等）
        // 显示醒目的 Toast 提示 + 表单内错误信息
        regMsg.textContent = "⚠ " + result.message;
        regMsg.className = "auth-msg error";
        showToast(result.message, "error");

        // 如果是用户名已存在，引导用户去登录
        if (result.message && result.message.includes("已被注册")) {
            // 延迟后自动切换到登录标签页，并预填用户名
            setTimeout(() => {
                switchAuthTab("login");
                loginUsername.value = username;
                loginMsg.textContent = "💡 该账号已存在，请直接登录";
                loginMsg.className = "auth-msg success";
            }, 1500);
        }
        // 不继续执行后续的"注册成功"流程
        return;
    } else {
        // 2. 服务端不可用 → 降级到 localStorage（仅本地设备有效）
        //    注意：本地模式下无法感知其他设备已注册的账号！
        const users = loadUsers();

        // 大小写不敏感查重
        const normalizedKey = username.toLowerCase();
        const existingEntry = Object.entries(users).find(
            ([key]) => key.toLowerCase() === normalizedKey
        );
        if (existingEntry) {
            const existingName = existingEntry[0];
            regMsg.textContent = `⚠ 该用户名已被注册（已存在：${existingName}），请直接登录`;
            regMsg.className = "auth-msg error";
            showToast("该账号已存在，请切换到登录页面", "error");
            // 引导用户去登录
            setTimeout(() => {
                switchAuthTab("login");
                loginUsername.value = username;
                loginMsg.textContent = "💡 该账号已存在，请直接登录";
                loginMsg.className = "auth-msg success";
            }, 1500);
            return;
        }

        const passwordHash = await sha256(password);
        // 检查 crypto.subtle 是否可用（手机端 HTTP 访问时可能不可用）
        if (passwordHash === null) {
            regMsg.textContent = "⚠ 当前浏览器不支持安全加密，请使用 HTTPS 访问或连接服务器后重试";
            regMsg.className = "auth-msg error";
            return;
        }
        users[username] = {
            passwordHash,
            createdAt: new Date().toISOString(),
            nickname: username,
            avatar: "👤",
            stats: createDefaultStats(),
            friends: [],
            friendRequestsSent: [],
            friendRequestsReceived: [],
        };
        saveUsers(users);

        regMsg.textContent = "✅ 注册成功（本地模式）！请切换到登录";
        regMsg.className = "auth-msg success";
        showToast("⚠ 已离线注册（仅本设备有效），连接服务器后可跨设备登录", "error");
    }

    // 清空注册表单
    regUsername.value = "";
    regPassword.value = "";
    regPassword2.value = "";

    // 切换到登录
    setTimeout(() => {
        switchAuthTab("login");
        loginUsername.value = username;
        loginMsg.textContent = "✅ 注册成功，请登录";
        loginMsg.className = "auth-msg success";
    }, 1000);
}

registerForm.addEventListener("submit", handleRegister);


// =========================
// 登录
// =========================

async function handleLogin(e) {
    e.preventDefault();

    const username = loginUsername.value.trim();
    const password = loginPassword.value;

    // 清空消息
    loginMsg.textContent = "";
    loginMsg.className = "auth-msg";

    if (!username || !password) {
        loginMsg.textContent = "⚠ 请输入用户名和密码";
        loginMsg.className = "auth-msg error";
        return;
    }

    // 禁用提交按钮，防止重复点击
    const submitBtn = loginForm.querySelector("button[type=submit]");
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "登录中..."; }

    // 1. 尝试服务端登录
    loginMsg.textContent = "⏳ 正在连接服务器...";
    loginMsg.className = "auth-msg";
    const result = await apiCall("/api/login", { username, password });

    // 恢复按钮
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "登 录"; }

    // 用于记录登录成功后的最终用户名（可能是服务端返回的原始大小写）
    let finalUsername = username;

    if (result && result.ok) {
        // 服务端登录成功
        loginMsg.textContent = "✅ 登录成功！";
        loginMsg.className = "auth-msg success";

        // 使用服务端返回的原始大小写用户名（保证跨设备一致性）
        finalUsername = result.user.username;

        // 尝试将服务端数据同步到 localStorage 缓存
        // 【重要】此操作为非关键路径 — 即使失败也不影响登录状态
        try {
            const passwordHash = await sha256(password);
            if (passwordHash) {
                const users = loadUsers();
                // 使用服务端返回的原始用户名作为 key，保证大小写一致
                users[finalUsername] = {
                    passwordHash,
                    createdAt: result.user.createdAt,
                    nickname: result.user.nickname,
                    avatar: result.user.avatar,
                    stats: result.user.stats,
                    friends: result.user.friends || [],
                    friendRequestsSent: result.user.friendRequestsSent || [],
                    friendRequestsReceived: result.user.friendRequestsReceived || [],
                };
                saveUsers(users);
            }
            // 若 passwordHash 为 null（手机端 HTTP 下 crypto.subtle 不可用），
            // 跳过本地缓存，但服务端已验证通过，登录不受影响
        } catch (_) {
            // 缓存同步失败不影响登录流程（例如无痕模式 localStorage 不可用）
            console.warn("[handleLogin] 本地缓存同步失败，已跳过");
        }
    } else if (result && !result.ok) {
        // 服务端明确拒绝
        loginMsg.textContent = "⚠ " + result.message;
        loginMsg.className = "auth-msg error";
        return;
    } else {
        // 2. 服务端不可用 → 降级到 localStorage（大小写不敏感查找）
        const found = findUserLocal(username);

        if (!found) {
            loginMsg.textContent = "⚠ 用户不存在，请先注册";
            loginMsg.className = "auth-msg error";
            return;
        }

        // 使用存储时的原始大小写用户名，保证本地体验一致
        finalUsername = found.key;
        const user = found.user;

        const passwordHash = await sha256(password);
        // 检查 crypto.subtle 是否可用（手机端 HTTP 访问时可能不可用）
        if (passwordHash === null) {
            loginMsg.textContent = "⚠ 当前浏览器不支持安全加密，请使用 HTTPS 访问或连接服务器后重试";
            loginMsg.className = "auth-msg error";
            return;
        }
        if (passwordHash !== user.passwordHash) {
            loginMsg.textContent = "⚠ 密码错误";
            loginMsg.className = "auth-msg error";
            return;
        }

        loginMsg.textContent = "✅ 登录成功（本地模式）！";
        loginMsg.className = "auth-msg success";
    }

    // =========================
    // 登录成功 — 立即设置登录状态
    // （此段代码必须在所有 try-catch 保护的非关键操作之前执行，
    //   确保任何后续异常都不会阻止用户完成登录）
    // =========================
    currentUser = { username: finalUsername };

    // 记住我 → localStorage 持久化；否则 → sessionStorage
    // 使用 finalUsername（服务端返回的原始大小写或本地存储的原始 key）
    if (loginRemember.checked) {
        saveSession(finalUsername);
        try { sessionStorage.removeItem(SESSION_KEY); } catch (_) { /* 忽略 */ }
    } else {
        clearSession();
        try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify({ username: finalUsername }));
        } catch (_) { /* 忽略 */ }
    }

    // 更新 UI（必须在关闭面板前执行，保证按钮状态正确）
    updateUserButtonState();

    // 通知服务器上线（好友系统）— 非关键操作，加 try-catch 容错
    if (wsConnected) {
        try {
            sendMessage({ type: "set_username", username: finalUsername });
        } catch (_) {
            console.warn("[handleLogin] WebSocket 注册失败，已忽略");
        }
    }

    // 关闭面板（延迟 600ms，让用户看到"登录成功"提示后再关闭）
    setTimeout(() => {
        closeAuthPanel();
        // 清空表单
        loginUsername.value = "";
        loginPassword.value = "";
        loginRemember.checked = false;
        loginMsg.textContent = "";
        loginMsg.className = "auth-msg";
    }, 600);
}

loginForm.addEventListener("submit", handleLogin);


// =========================
// 退出登录
// =========================

function handleLogout() {
    currentUser = null;
    clearSession();
    try { sessionStorage.removeItem(SESSION_KEY); } catch (_) { /* 忽略 */ }

    updateUserButtonState();
    closeAuthPanel();
}

logoutBtn.addEventListener("click", handleLogout);
if (switchAccountBtn) {
    switchAccountBtn.addEventListener("click", switchAccount);
}

// 编辑资料弹窗事件
if (editProfileBtn) {
    editProfileBtn.addEventListener("click", openEditProfileModal);
}
if (editProfileClose) {
    editProfileClose.addEventListener("click", closeEditProfileModal);
}
if (editProfileCancel) {
    editProfileCancel.addEventListener("click", closeEditProfileModal);
}
if (editProfileOverlay) {
    editProfileOverlay.addEventListener("click", closeEditProfileModal);
}
if (editProfileSave) {
    editProfileSave.addEventListener("click", saveProfile);
}

// 好友面板事件
if (friendsToggleBtn) {
    friendsToggleBtn.addEventListener("click", openFriendsPanel);
}
if (friendsCloseBtn) {
    friendsCloseBtn.addEventListener("click", closeFriendsPanel);
}
if (friendsOverlay) {
    friendsOverlay.addEventListener("click", closeFriendsPanel);
}
if (friendsAddBtn) {
    friendsAddBtn.addEventListener("click", sendFriendRequest);
}
if (friendsSearchInput) {
    friendsSearchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") sendFriendRequest();
    });
}


// =========================
// 更新按钮状态
// =========================

function updateUserButtonState() {
    if (currentUser) {
        userToggleBtn.classList.add("logged-in");

        // 显示自定义头像或默认图标
        const users = loadUsers();
        const user = users[currentUser.username];
        const displayName = (user && user.nickname) ? user.nickname : currentUser.username;
        const avatar = (user && user.avatar) ? user.avatar : "👤";

        userToggleBtn.textContent = avatar;
        userToggleBtn.title = displayName;
    } else {
        userToggleBtn.classList.remove("logged-in");
        userToggleBtn.textContent = "👤";
        userToggleBtn.title = "用户";
    }
}


// =========================
// 更新个人中心 UI
// =========================

/** 根据用户名字符串生成稳定的颜色 */
function avatarColor(username) {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    const s = 55 + (Math.abs(hash) % 25); // 55-80%
    const l = 45 + (Math.abs(hash >> 8) % 15); // 45-60%
    return `hsl(${h}, ${s}%, ${l}%)`;
}

/** 根据总局数计算等级 */
function calcLevel(games) {
    if (games < 5) return { title: "见习矿工", icon: "🪨" };
    if (games < 20) return { title: "初级矿工", icon: "⛏️" };
    if (games < 50) return { title: "资深矿工", icon: "💎" };
    if (games < 100) return { title: "扫雷专家", icon: "🧨" };
    if (games < 200) return { title: "排爆大师", icon: "🏅" };
    return { title: "雷神降临", icon: "👑" };
}

function updateProfileUI() {
    if (!currentUser) return;

    const users = loadUsers();
    const user = users[currentUser.username];
    if (!user) return;

    // 兼容旧用户数据：补全缺失的字段
    let needsSave = false;
    if (!user.avatar) { user.avatar = "👤"; needsSave = true; }
    if (!user.nickname) { user.nickname = currentUser.username; needsSave = true; }
    if (needsSave) saveUsers(users);

    const stats = user.stats;

    // ---- 头像 & 基本信息 ----
    const avatarEl = document.getElementById("profile-avatar");
    const userAvatar = user.avatar || "👤";
    avatarEl.textContent = userAvatar;
    avatarEl.style.background = avatarColor(currentUser.username);

    const displayName = user.nickname || currentUser.username;
    profileUsername.textContent = displayName;
    const created = new Date(user.createdAt);
    profileJoinDate.textContent = `注册于 ${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}-${String(created.getDate()).padStart(2, "0")}`;

    // ---- 编辑资料：回填当前值 ----
    if (profileNicknameInput) {
        profileNicknameInput.value = user.nickname || "";
    }
    if (avatarPicker) {
        renderAvatarPicker(userAvatar);
    }

    // 等级
    const lvl = calcLevel(stats.games);
    document.getElementById("profile-level").textContent = lvl.icon + " " + lvl.title;

    // ---- 统计 ----
    statGames.textContent = stats.games;
    statWins.textContent = stats.wins;
    statLosses.textContent = stats.losses;

    // 胜率 & 进度条
    let winRate = 0;
    if (stats.games > 0) {
        winRate = Math.round((stats.wins / stats.games) * 100);
        statWinrate.textContent = winRate + "%";
    } else {
        statWinrate.textContent = "-";
    }
    document.getElementById("winrate-fill").style.width = winRate + "%";

    // 总游戏时长
    const totalSec = stats.totalSeconds || 0;
    const totalTimeEl = document.getElementById("total-time");
    if (totalSec > 0) {
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        if (h > 0) {
            totalTimeEl.innerHTML = "⏱ 总游戏时长 <strong>" + h + "</strong> 小时 <strong>" + m + "</strong> 分钟";
        } else {
            totalTimeEl.innerHTML = "⏱ 总游戏时长 <strong>" + m + "</strong> 分钟";
        }
    } else {
        totalTimeEl.textContent = "";
    }

    // ---- 最佳成绩 (带排名) ----
    const diffs = [
        { key: "beginner", label: "初级", icon: "🌱", medal: "🥇" },
        { key: "intermediate", label: "中级", icon: "⚡", medal: "🥈" },
        { key: "expert", label: "高级", icon: "💀", medal: "🥉" },
    ];

    let timesHTML = "";
    for (const d of diffs) {
        const best = stats.bestTimes ? stats.bestTimes[d.key] : null;
        if (best !== null && best !== undefined) {
            timesHTML += `<div class="best-time-row rank-${diffs.indexOf(d) + 1}">
                <span class="best-time-diff">
                    <span class="best-time-medal">${d.medal}</span>${d.icon} ${d.label}
                </span>
                <span class="best-time-value">${best} 秒</span>
            </div>`;
        } else {
            timesHTML += `<div class="best-time-row">
                <span class="best-time-diff">
                    <span class="best-time-medal">⬜</span>${d.icon} ${d.label}
                </span>
                <span class="best-time-none">暂无记录</span>
            </div>`;
        }
    }
    bestTimesEl.innerHTML = timesHTML;

    // ---- 最近对局 ----
    const history = stats.history || [];
    const historyEl = document.getElementById("game-history");
    const historyEmptyEl = document.getElementById("game-history-empty");

    if (history.length === 0) {
        historyEl.innerHTML = "";
        historyEl.style.display = "none";
        historyEmptyEl.style.display = "";
    } else {
        historyEmptyEl.style.display = "none";
        historyEl.style.display = "";

        let histHTML = "";
        const modeLabels = { classic: "🎮 经典", vs: "🤖 人机", multi: "👥 多人" };
        const diffLabels = { beginner: "初级", intermediate: "中级", expert: "高级", custom: "自定义" };

        for (const h of history.slice(0, 10)) {
            const resultIcon = h.result === "win" ? "🏆" : "💀";
            const modeLabel = modeLabels[h.mode] || h.mode;
            const diffLabel = diffLabels[h.difficulty] || h.difficulty;
            const date = new Date(h.date);
            const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

            histHTML += `<div class="history-item">
                <span class="history-result">${resultIcon}</span>
                <div class="history-info">
                    <div class="history-mode">${modeLabel} · ${diffLabel}</div>
                    <div class="history-detail">${dateStr} · ${h.result === "win" ? "胜利" : "失败"}</div>
                </div>
                <span class="history-time">${h.seconds}s</span>
            </div>`;
        }
        historyEl.innerHTML = histHTML;
    }
}


// =========================
// 头像选择器 — 可用 emoji 列表
// =========================

const AVATAR_OPTIONS = [
    "👤", "😊", "😎", "🤖", "👻", "🐱", "🐶", "🦊",
    "🐼", "🐨", "🦁", "🐯", "🐸", "🐵", "🐙", "🦄",
    "🌸", "🔥", "⭐", "🌈", "💎", "🎮", "🚀", "⚡",
    "🎯", "🏆", "💣", "🧨", "⛏️", "💀", "👑", "🗿",
];

/**
 * 渲染头像选择器
 * @param {string} selected - 当前选中的 emoji
 */
function renderAvatarPicker(selected) {
    if (!avatarPicker) return;
    let html = "";
    for (const emoji of AVATAR_OPTIONS) {
        const selClass = emoji === selected ? " selected" : "";
        html += `<button class="avatar-option${selClass}" data-avatar="${emoji}">${emoji}</button>`;
    }
    avatarPicker.innerHTML = html;

    // 绑定点击事件
    avatarPicker.querySelectorAll(".avatar-option").forEach(btn => {
        btn.addEventListener("click", () => {
            avatarPicker.querySelectorAll(".avatar-option").forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
        });
    });
}

/**
 * 保存昵称和头像到用户数据
 */
async function saveProfile() {
    if (!currentUser) return;

    // 昵称
    const nickname = (profileNicknameInput.value || "").trim();
    if (nickname && nickname.length > 12) {
        editProfileMsg.textContent = "⚠ 昵称最多12个字符";
        editProfileMsg.className = "auth-msg error";
        return;
    }

    // 头像
    let avatar = null;
    const selectedBtn = avatarPicker.querySelector(".avatar-option.selected");
    if (selectedBtn) {
        avatar = selectedBtn.dataset.avatar;
    }

    // 1. 尝试服务端保存
    const result = await apiCall("/api/save-profile", {
        username: currentUser.username,
        nickname: nickname || undefined,
        avatar: avatar || undefined,
    });

    // 2. 同步到本地
    const users = loadUsers();
    const user = users[currentUser.username];
    if (user) {
        if (nickname) user.nickname = nickname;
        if (avatar) user.avatar = avatar;
        if (!user.avatar) user.avatar = "👤";
        if (!user.nickname) user.nickname = currentUser.username;
        saveUsers(users);
    }

    // 刷新 UI
    updateProfileUI();
    updateUserButtonState();

    // 关闭弹窗
    closeEditProfileModal();
}

/**
 * 打开编辑资料弹窗
 */
function openEditProfileModal() {
    if (!currentUser) return;

    // 回填当前值
    const users = loadUsers();
    const user = users[currentUser.username];
    if (!user) return;

    profileNicknameInput.value = user.nickname || "";
    renderAvatarPicker(user.avatar || "👤");

    // 清空消息
    editProfileMsg.textContent = "";
    editProfileMsg.className = "auth-msg";

    // 显示弹窗
    editProfileOverlay.classList.add("open");
    editProfilePanel.classList.add("open");
}

/**
 * 关闭编辑资料弹窗（不保存）
 */
function closeEditProfileModal() {
    editProfileOverlay.classList.remove("open");
    editProfilePanel.classList.remove("open");
    editProfileMsg.textContent = "";
    editProfileMsg.className = "auth-msg";
}

/**
 * 切换账号：退出当前账号并回到登录界面
 */
function switchAccount() {
    handleLogout();
    // 退出后延迟打开面板到登录界面
    setTimeout(() => {
        openAuthPanel();
    }, 200);
}


// =========================
// 好友系统
// =========================

/** 获取当前用户的好友数据（自动迁移旧用户） */
function getFriendData() {
    if (!currentUser) return null;
    const users = loadUsers();
    const user = users[currentUser.username];
    if (!user) return null;

    if (!user.friends) user.friends = [];
    if (!user.friendRequestsSent) user.friendRequestsSent = [];
    if (!user.friendRequestsReceived) user.friendRequestsReceived = [];

    return user;
}

/** 打开好友面板 */
function openFriendsPanel() {
    if (!currentUser) {
        showToast("请先登录", "error");
        return;
    }

    friendsOverlay.classList.add("open");
    friendsPanel.classList.add("open");
    friendsToggleBtn.style.opacity = "0";
    friendsToggleBtn.style.pointerEvents = "none";

    refreshFriendsUI();
}

/** 关闭好友面板 */
function closeFriendsPanel() {
    friendsOverlay.classList.remove("open");
    friendsPanel.classList.remove("open");
    friendsToggleBtn.style.opacity = "";
    friendsToggleBtn.style.pointerEvents = "";

    // 清空消息
    friendsAddMsg.textContent = "";
    friendsAddMsg.className = "auth-msg";
    friendsSearchInput.value = "";
}

/** 刷新好友面板 UI */
function refreshFriendsUI() {
    const user = getFriendData();
    if (!user) return;

    const users = loadUsers();

    // ---- 收到的好友请求 ----
    const received = user.friendRequestsReceived || [];
    if (received.length > 0) {
        friendsRequestsSection.style.display = "";
        let reqHTML = "";
        for (const reqUsername of received) {
            const reqUser = users[reqUsername];
            const avatar = reqUser ? (reqUser.avatar || "👤") : "👤";
            const nickname = reqUser ? (reqUser.nickname || reqUsername) : reqUsername;

            reqHTML += `<div class="friend-item request-item">
                <span class="friend-avatar">${avatar}</span>
                <span class="friend-name">${escapeHtml(nickname)}</span>
                <div class="friend-actions">
                    <button class="friend-accept-btn" data-username="${escapeHtml(reqUsername)}">✅</button>
                    <button class="friend-decline-btn" data-username="${escapeHtml(reqUsername)}">❌</button>
                </div>
            </div>`;
        }
        friendsRequestsList.innerHTML = reqHTML;

        // 绑定事件
        friendsRequestsList.querySelectorAll(".friend-accept-btn").forEach(btn => {
            btn.addEventListener("click", () => acceptFriendRequest(btn.dataset.username));
        });
        friendsRequestsList.querySelectorAll(".friend-decline-btn").forEach(btn => {
            btn.addEventListener("click", () => declineFriendRequest(btn.dataset.username));
        });
    } else {
        friendsRequestsSection.style.display = "none";
        friendsRequestsList.innerHTML = "";
    }

    // ---- 好友列表 ----
    const friends = user.friends || [];
    if (friends.length > 0) {
        friendsEmptyEl.style.display = "none";
        let listHTML = "";
        for (const friendName of friends) {
            const friendUser = users[friendName];
            const avatar = friendUser ? (friendUser.avatar || "👤") : "👤";
            const nickname = friendUser ? (friendUser.nickname || friendName) : friendName;

            // 检查对方是否也加了自己（双向好友状态）
            const isMutual = friendUser && (friendUser.friends || []).includes(currentUser.username);

            listHTML += `<div class="friend-item">
                <span class="friend-avatar">${avatar}</span>
                <div class="friend-info">
                    <span class="friend-name">${escapeHtml(nickname)}</span>
                    <span class="friend-username-hint">@${escapeHtml(friendName)}</span>
                </div>
                <span class="friend-status ${isMutual ? "mutual" : "oneway"}" title="${isMutual ? "互为好友" : "等待对方确认"}">
                    ${isMutual ? "🤝" : "📤"}
                </span>
                <button class="friend-challenge-btn" data-username="${escapeHtml(friendName)}" title="发起对战">⚔️</button>
                <button class="friend-remove-btn" data-username="${escapeHtml(friendName)}" title="删除好友">🗑️</button>
            </div>`;
        }
        friendsListEl.innerHTML = listHTML;

        // 绑定删除事件
        friendsListEl.querySelectorAll(".friend-remove-btn").forEach(btn => {
            btn.addEventListener("click", () => removeFriend(btn.dataset.username));
        });
        // 绑定挑战事件
        friendsListEl.querySelectorAll(".friend-challenge-btn").forEach(btn => {
            btn.addEventListener("click", () => challengeFriend(btn.dataset.username));
        });
    } else {
        friendsEmptyEl.style.display = "";
        friendsListEl.innerHTML = "";
    }
}

/** 发送好友请求 */
function sendFriendRequest() {
    const targetName = (friendsSearchInput.value || "").trim();
    friendsAddMsg.textContent = "";
    friendsAddMsg.className = "auth-msg";

    if (!targetName) {
        friendsAddMsg.textContent = "⚠ 请输入用户名";
        friendsAddMsg.className = "auth-msg error";
        return;
    }
    if (targetName === currentUser.username) {
        friendsAddMsg.textContent = "⚠ 不能添加自己为好友";
        friendsAddMsg.className = "auth-msg error";
        return;
    }

    const users = loadUsers();
    if (!users[targetName]) {
        friendsAddMsg.textContent = "⚠ 该用户不存在";
        friendsAddMsg.className = "auth-msg error";
        return;
    }

    const user = getFriendData();
    if (!user) return;

    // 检查是否已经是好友
    if ((user.friends || []).includes(targetName)) {
        friendsAddMsg.textContent = "⚠ 你们已经是好友了";
        friendsAddMsg.className = "auth-msg error";
        return;
    }

    // 检查是否已发送过请求
    if ((user.friendRequestsSent || []).includes(targetName)) {
        friendsAddMsg.textContent = "⚠ 已发送过好友请求，等待对方确认";
        friendsAddMsg.className = "auth-msg error";
        return;
    }

    // 添加到"已发送"列表
    if (!user.friendRequestsSent) user.friendRequestsSent = [];
    user.friendRequestsSent.push(targetName);

    // 添加到对方的"已收到"列表
    const target = users[targetName];
    if (!target.friendRequestsReceived) target.friendRequestsReceived = [];
    target.friendRequestsReceived.push(currentUser.username);

    saveUsers(users);

    friendsAddMsg.textContent = "✅ 好友请求已发送！";
    friendsAddMsg.className = "auth-msg success";
    friendsSearchInput.value = "";

    setTimeout(() => {
        friendsAddMsg.textContent = "";
        friendsAddMsg.className = "auth-msg";
    }, 2500);
}

/** 接受好友请求 */
function acceptFriendRequest(fromUsername) {
    const users = loadUsers();
    const user = users[currentUser.username];
    const fromUser = users[fromUsername];
    if (!user || !fromUser) return;

    // 从"已收到"中移除
    user.friendRequestsReceived = (user.friendRequestsReceived || []).filter(n => n !== fromUsername);
    // 从对方的"已发送"中移除
    fromUser.friendRequestsSent = (fromUser.friendRequestsSent || []).filter(n => n !== currentUser.username);

    // 互相添加为好友
    if (!user.friends) user.friends = [];
    if (!fromUser.friends) fromUser.friends = [];
    if (!user.friends.includes(fromUsername)) user.friends.push(fromUsername);
    if (!fromUser.friends.includes(currentUser.username)) fromUser.friends.push(currentUser.username);

    saveUsers(users);
    refreshFriendsUI();
}

/** 拒绝好友请求 */
function declineFriendRequest(fromUsername) {
    const users = loadUsers();
    const user = users[currentUser.username];
    const fromUser = users[fromUsername];
    if (!user || !fromUser) return;

    // 从"已收到"中移除
    user.friendRequestsReceived = (user.friendRequestsReceived || []).filter(n => n !== fromUsername);
    // 从对方的"已发送"中移除
    fromUser.friendRequestsSent = (fromUser.friendRequestsSent || []).filter(n => n !== currentUser.username);

    saveUsers(users);
    refreshFriendsUI();
}

/** 删除好友 */
function removeFriend(friendName) {
    const users = loadUsers();
    const user = users[currentUser.username];
    const friendUser = users[friendName];
    if (!user) return;

    // 从自己的好友列表移除
    user.friends = (user.friends || []).filter(n => n !== friendName);
    // 从对方的好友列表也移除自己
    if (friendUser && friendUser.friends) {
        friendUser.friends = friendUser.friends.filter(n => n !== currentUser.username);
    }

    saveUsers(users);
    refreshFriendsUI();
}

/** 向好友发起对战挑战 */
function challengeFriend(friendName) {
    if (!currentUser) {
        showToast("请先登录", "error");
        return;
    }

    if (!wsConnected) {
        // 自动尝试连接
        showToast("正在连接服务器...", "info");
        connectToServer(getWsUrl());
        // 延迟发送挑战
        const checkConnection = setInterval(() => {
            if (wsConnected) {
                clearInterval(checkConnection);
                sendChallengeRequest(friendName);
            }
        }, 300);
        // 超时
        setTimeout(() => {
            clearInterval(checkConnection);
            if (!wsConnected) {
                showToast("无法连接到服务器，请检查服务器地址", "error");
            }
        }, 5000);
        return;
    }

    sendChallengeRequest(friendName);
}

function sendChallengeRequest(friendName) {
    const diff = DIFFICULTY[currentDifficulty] || DIFFICULTY.beginner;
    sendMessage({
        type: "challenge_friend",
        from: currentUser.username,
        to: friendName,
        difficulty: { rows: diff.rows, cols: diff.cols, mines: diff.mines },
    });
}

/** 更新多人房间难度按钮选中状态 */
function updateMultiDiffButtons() {
    const diffBar = document.getElementById("multi-diff-bar");
    if (!diffBar) return;
    diffBar.querySelectorAll(".diff-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.level === multiCurrentDiff);
    });
}


// =========================
// 恢复会话（页面加载时）
// =========================

function restoreSession() {
    // 先尝试 localStorage（记住我）
    let session = getSession();

    // 如果没有持久会话，尝试 sessionStorage（当前标签页）
    if (!session) {
        try {
            session = JSON.parse(sessionStorage.getItem(SESSION_KEY));
        } catch (_) { /* 忽略 */ }
    }

    if (session && session.username) {
        const users = loadUsers();
        if (users[session.username]) {
            currentUser = session;
            // 如果是从 sessionStorage 恢复的，同步到 localStorage 以便跨标签页
            // 不持久化 —— 只写回当前内存
        } else {
            // 用户已被删除
            currentUser = null;
            clearSession();
            try { sessionStorage.removeItem(SESSION_KEY); } catch (_) { /* 忽略 */ }
        }
    }

    updateUserButtonState();
}


// =========================
// 用户面板事件绑定
// =========================

userToggleBtn.addEventListener("click", openAuthPanel);
authCloseBtn.addEventListener("click", closeAuthPanel);
authCloseBtn2.addEventListener("click", closeAuthPanel);
authOverlay.addEventListener("click", closeAuthPanel);

// 初始化会话
restoreSession();


// =========================
// 模式切换 (经典 / 人机对战)
// =========================

let currentMode = "classic"; // "classic" | "vs"

const modeButtons    = document.querySelectorAll(".mode-btn");
const gameClassic    = document.getElementById("game-classic");
const gameVs         = document.getElementById("game-vs");

function switchMode(mode) {
    if (mode === currentMode) return;

    // 清理上一个模式
    if (currentMode === "multiplayer") {
        if (multiRoomCode) {
            sendMessage({ type: "leave_room" });
        }
        disconnectFromServer();
        multiStopTimer();
        resetMultiState();
    }
    if (currentMode === "vs") {
        stopVsGame();
    }

    currentMode = mode;

    modeButtons.forEach(btn => btn.classList.toggle("active", btn.dataset.mode === mode));

    // 隐藏所有游戏容器
    gameClassic.style.display = "none";
    gameVs.style.display = "none";
    const gameMultiEl = document.getElementById("game-multi");
    if (gameMultiEl) gameMultiEl.style.display = "none";

    if (mode === "classic") {
        gameClassic.style.display = "";
        restart();
    } else if (mode === "vs") {
        gameVs.style.display = "flex";
        stopTimer();
        vsHumanScore = 0;
        vsAiScore = 0;
        updateVsScoreDisplay();
        initVsMode();
    } else if (mode === "multiplayer") {
        document.getElementById("game-multi").style.display = "flex";
        showMultiLobby();
        // 自动连接服务器
        if (!wsConnected) {
            connectToServer(getWsUrl());
        }
    }
}

modeButtons.forEach(btn => {
    btn.addEventListener("click", () => switchMode(btn.dataset.mode));
});


// =========================
// AI 难度配置
// =========================

const AI_DIFFICULTY = {
    easy: {
        label: "🌱 初级",
        speedMin: 800,
        speedMax: 1200,
        useFlags: false,        // 不主动插旗
        useRule2: false,        // 不推断雷位
        mistakeRate: 0.25,      // 25% 概率随机猜测而非使用逻辑
        cornerPrefer: false,
        probHeuristic: false,
        patterns: false,
    },
    medium: {
        label: "⚡ 中级",
        speedMin: 500,
        speedMax: 900,
        useFlags: true,
        useRule2: true,
        mistakeRate: 0,
        cornerPrefer: true,
        probHeuristic: false,
        patterns: false,
    },
    hard: {
        label: "💀 高级",
        speedMin: 200,
        speedMax: 450,
        useFlags: true,
        useRule2: true,
        mistakeRate: 0,
        cornerPrefer: true,
        probHeuristic: true,    // 猜测时使用概率启发
        patterns: false,
    },
    expert: {
        label: "👾 专家",
        speedMin: 60,
        speedMax: 200,
        useFlags: true,
        useRule2: true,
        mistakeRate: 0,
        cornerPrefer: true,
        probHeuristic: true,
        patterns: true,         // 识别基本定式
    },
};

let currentAiDifficulty = "medium";


// =========================
// AI 求解器
// =========================

class AiSolver {

    /**
     * @param {Cell[][]} boardRef - AI 棋盘引用
     * @param {number} rows
     * @param {number} cols
     * @param {string} difficulty - AI 难度 key
     */
    constructor(boardRef, rows, cols, difficulty) {
        this.board = boardRef;
        this.rows = rows;
        this.cols = cols;
        this.diff = AI_DIFFICULTY[difficulty] || AI_DIFFICULTY.medium;
    }

    /** 获取某一格周围所有未翻开的邻居 */
    _getHiddenNeighbors(r, c) {
        const result = [];
        for (const [dr, dc] of DIRECTIONS) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                const cell = this.board[nr][nc];
                if (!cell.open) result.push(cell);
            }
        }
        return result;
    }

    /** 获取某一格周围已插旗的邻居 */
    _getFlaggedNeighbors(r, c) {
        const result = [];
        for (const [dr, dc] of DIRECTIONS) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                const cell = this.board[nr][nc];
                if (cell.flag) result.push(cell);
            }
        }
        return result;
    }

    /**
     * 执行一步推理
     * @returns {{ safe: Cell[], mines: Cell[] }}
     */
    deduce() {
        const safeCells = new Set();
        const mineCells = new Set();

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = this.board[r][c];
                if (!cell.open || cell.mine || cell.number === 0) continue;

                const hidden = this._getHiddenNeighbors(r, c);
                const flagged = this._getFlaggedNeighbors(r, c);

                // 规则1: 数字 == 已插旗数 → 剩余未翻开格都是安全的
                if (cell.number === flagged.length && hidden.length > flagged.length) {
                    for (const h of hidden) {
                        if (!h.flag) safeCells.add(h);
                    }
                }

                // 规则2（仅中级及以上）: 数字 == 未翻开格总数 → 都是雷
                if (this.diff.useRule2 && cell.number === hidden.length && hidden.length > 0) {
                    for (const h of hidden) {
                        if (!h.flag) mineCells.add(h);
                    }
                }
            }
        }

        // 专家：模式识别（1-2-1 等定式）
        if (this.diff.patterns) {
            const patternResult = this._findPatterns();
            for (const h of patternResult.safe) safeCells.add(h);
            for (const h of patternResult.mines) mineCells.add(h);
        }

        return {
            safe: [...safeCells],
            mines: [...mineCells],
        };
    }

    /**
     * 模式识别：1-2-1 及其变体
     * 在一行/列上，若存在 1-2-1 序列且中间的 2 只对应这3格：
     *   1 的格 → 雷，2 对面的格 → 安全
     */
    _findPatterns() {
        const safeCells = new Set();
        const mineCells = new Set();

        // 在所有4个方向上检查 (水平、垂直、两条对角线)
        const axes = [[0, 1], [1, 0], [1, 1], [1, -1]];

        for (const [dr, dc] of axes) {
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    const c1 = this.board[r]?.[c];
                    const c2 = this.board[r + dr]?.[c + dc];
                    const c3 = this.board[r + 2 * dr]?.[c + 2 * dc];
                    if (!c1 || !c2 || !c3) continue;
                    if (!c1.open || c1.mine || !c2.open || c2.mine || !c3.open || c3.mine) continue;
                    if (c1.number !== 1 || c2.number !== 2 || c3.number !== 1) continue;

                    // 检查 2 的未知邻居严格等于这3格方向上的2格
                    const h2 = this._getHiddenNeighbors(c2.row, c2.col);
                    const h2NoFlag = h2.filter(h => !h.flag);
                    const pairCells = [c1, c3].filter(cc => !cc.open && !cc.flag);
                    // 只有当 2 的未知邻居恰好是这3格中的2个未翻格时才适用
                    if (h2NoFlag.length <= 3) {
                        // 1 对面的未翻格 → 雷
                        for (const h of pairCells) {
                            if (!h.open && !h.flag) mineCells.add(h);
                        }
                        // 2 对面的未翻格（不在1的未知中）→ 安全
                        for (const h of h2NoFlag) {
                            if (!pairCells.includes(h)) safeCells.add(h);
                        }
                    }
                }
            }
        }

        return { safe: [...safeCells], mines: [...mineCells] };
    }

    /**
     * 获取所有未翻开且未插旗的格子
     */
    getUnknownCells() {
        const result = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = this.board[r][c];
                if (!cell.open && !cell.flag) {
                    result.push(cell);
                }
            }
        }
        return result;
    }

    /**
     * 基于概率启发选择最佳猜测格
     * 对每个未知格计算"危险度"：相邻已翻数字格的总雷数 / 相邻未知格数
     * 危险度越低越安全
     */
    getBestGuess() {
        const unknowns = this.getUnknownCells();
        if (unknowns.length === 0) return null;

        // 计算剩余雷数
        let flaggedCount = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.board[r][c].flag) flaggedCount++;
            }
        }
        const totalMines = this._countTotalMines();
        const remainingMines = totalMines - flaggedCount;

        // 为每个未知格评分
        const scored = unknowns.map(cell => {
            let dangerScore = 0;
            let adjacentOpenCount = 0;

            for (const [dr, dc] of DIRECTIONS) {
                const nr = cell.row + dr, nc = cell.col + dc;
                if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                    const neighbor = this.board[nr][nc];
                    if (neighbor.open && !neighbor.mine && neighbor.number > 0) {
                        const nHidden = this._getHiddenNeighbors(nr, nc);
                        const nFlagged = this._getFlaggedNeighbors(nr, nc);
                        const nRemaining = nHidden.length - nFlagged.length;
                        if (nRemaining > 0) {
                            dangerScore += (neighbor.number - nFlagged.length) / nRemaining;
                            adjacentOpenCount++;
                        }
                    }
                }
            }

            // 若没有相邻数字格，用基准概率
            if (adjacentOpenCount === 0) {
                dangerScore = unknowns.length > 0 ? remainingMines / unknowns.length : 0;
            } else {
                dangerScore /= adjacentOpenCount;
            }

            // 边角加分（降低被选中的优先级，即加分越少越先选）
            const isCorner = (cell.row === 0 || cell.row === this.rows - 1) &&
                             (cell.col === 0 || cell.col === this.cols - 1);
            const isEdge = cell.row === 0 || cell.row === this.rows - 1 ||
                           cell.col === 0 || cell.col === this.cols - 1;

            return { cell, dangerScore, isCorner, isEdge };
        });

        // 排序：危险度升序 → 角优先 → 边优先
        scored.sort((a, b) => {
            if (Math.abs(a.dangerScore - b.dangerScore) > 0.001) {
                return a.dangerScore - b.dangerScore;
            }
            if (a.isCorner !== b.isCorner) return a.isCorner ? -1 : 1;
            if (a.isEdge !== b.isEdge) return a.isEdge ? -1 : 1;
            return 0;
        });

        return scored[0].cell;
    }

    /** 统计棋盘中雷的总数 */
    _countTotalMines() {
        let count = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.board[r][c].mine) count++;
            }
        }
        return count;
    }
}


// =========================
// 人机对战状态
// =========================

// AI 棋盘
let vsAiBoard = [];

// VS 游戏状态
let vsGameActive = false;
let vsGameEnded = false;
let vsHumanFirstClick = true;
let vsAiFirstClick = true;
let vsHumanDead = false;
let vsAiDead = false;

// VS 计时
let vsTimerInterval = null;
let vsSecondsElapsed = 0;
let vsAiTimerInterval = null;
let vsAiSecondsElapsed = 0;

// AI 自动走子定时器
let vsAiStepInterval = null;

// VS 比分
let vsHumanScore = 0;
let vsAiScore = 0;

// VS 模式下的雷位快照（用于同步两个棋盘）
let vsMineSnapshot = null;


// =========================
// VS 模式 DOM
// =========================

const vsBoardHumanEl   = document.getElementById("vs-board-human");
const vsBoardAiEl      = document.getElementById("vs-board-ai");
const vsMineCountEl    = document.getElementById("vs-mine-count");
const vsTimerEl        = document.getElementById("vs-timer");
const vsAiMineCountEl  = document.getElementById("vs-ai-mine-count");
const vsAiTimerEl      = document.getElementById("vs-ai-timer");
const vsRestartBtn     = document.getElementById("vs-restart");
const vsAiFaceEl       = document.getElementById("vs-ai-face");
const vsStatusEl       = document.getElementById("vs-status");
const vsStartBtn       = document.getElementById("vs-start-btn");
const vsHumanWinsEl    = document.getElementById("vs-human-wins");
const vsAiWinsEl       = document.getElementById("vs-ai-wins");


// =========================
// VS 模式初始化
// =========================

function initVsMode() {
    stopVsGame();

    // 清空两个棋盘
    vsBoardHumanEl.innerHTML = "";
    vsBoardAiEl.innerHTML = "";

    // 设置棋盘样式
    vsBoardHumanEl.style.display = "grid";
    vsBoardHumanEl.style.gridTemplateColumns = `repeat(${COLS}, ${CELL_SIZE}px)`;
    vsBoardAiEl.style.display = "grid";
    vsBoardAiEl.style.gridTemplateColumns = `repeat(${COLS}, ${CELL_SIZE}px)`;
    document.documentElement.style.setProperty("--cell-size", `${CELL_SIZE}px`);

    // 初始化棋盘数据
    vsAiBoard = [];
    for (let r = 0; r < ROWS; r++) {
        vsAiBoard[r] = [];
        for (let c = 0; c < COLS; c++) {
            vsAiBoard[r][c] = new Cell(r, c);
        }
    }

    // 同样重置人类棋盘数据（复用 board 变量，但使用 VS 的棋盘 DOM）
    board.length = 0;
    for (let r = 0; r < ROWS; r++) {
        board[r] = [];
        for (let c = 0; c < COLS; c++) {
            board[r][c] = new Cell(r, c);
        }
    }

    // 渲染人类棋盘
    renderVsHumanBoard();

    // 渲染 AI 棋盘（只读外观）
    renderVsAiBoard();

    // 重置状态
    vsGameActive = false;
    vsGameEnded = false;
    vsHumanFirstClick = true;
    vsAiFirstClick = true;
    vsHumanDead = false;
    vsAiDead = false;
    vsMineSnapshot = null;

    vsMineCountEl.querySelector(".led-value").textContent = fmtLED(MINE_COUNT);
    vsAiMineCountEl.querySelector(".led-value").textContent = fmtLED(MINE_COUNT);
    vsTimerEl.querySelector(".led-value").textContent = "000";
    vsAiTimerEl.querySelector(".led-value").textContent = "000";
    vsRestartBtn.textContent = "😊";
    vsAiFaceEl.textContent = "🤖";
    vsStatusEl.textContent = "准备就绪 - 点击开始对战！";
    vsStatusEl.className = "vs-status";
    vsStartBtn.disabled = false;

    flagCount = 0;
}


// =========================
// 渲染 VS 棋盘
// =========================

function renderVsHumanBoard() {
    vsBoardHumanEl.innerHTML = "";
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = board[r][c];
            const el = document.createElement("div");
            el.classList.add("cell");
            el.dataset.row = r;
            el.dataset.col = c;

            el.addEventListener("click", () => vsOnHumanClick(cell));
            el.addEventListener("contextmenu", (e) => {
                e.preventDefault();
                vsOnHumanRightClick(cell);
            });
            addLongPressSupport(el, () => vsOnHumanRightClick(cell));

            cell.element = el;
            vsBoardHumanEl.appendChild(el);
        }
    }
}

function renderVsAiBoard() {
    vsBoardAiEl.innerHTML = "";
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = vsAiBoard[r][c];
            const el = document.createElement("div");
            el.classList.add("cell");
            cell.element = el;
            vsBoardAiEl.appendChild(el);
        }
    }
}


// =========================
// VS 模式：雷位快照
// =========================

/** 从人类棋盘获取雷位列表 */
function captureMineSnapshot() {
    const mines = [];
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c].mine) {
                mines.push({ r, c });
            }
        }
    }
    return mines;
}

/** 将雷位快照应用到 AI 棋盘 */
function applyMineSnapshot(mines) {
    for (const { r, c } of mines) {
        vsAiBoard[r][c].mine = true;
    }
    // 计算 AI 棋盘数字
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (vsAiBoard[r][c].mine) continue;
            let count = 0;
            for (const [dr, dc] of DIRECTIONS) {
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && vsAiBoard[nr][nc].mine) {
                    count++;
                }
            }
            vsAiBoard[r][c].number = count;
        }
    }
}


// =========================
// VS 模式：人类操作
// =========================

function vsOnHumanClick(cell) {
    if (!vsGameActive || vsGameEnded || vsHumanDead) return;
    if (cell.open || cell.flag) return;

    if (vsHumanFirstClick) {
        vsHumanFirstClick = false;
        placeMines(cell.row, cell.col);

        // 最后防线：若因任何边界情况第一步格仍是雷，当场迁走
        if (cell.mine) {
            cell.mine = false;
            for (let rr = 0; rr < ROWS; rr++) {
                for (let cc = 0; cc < COLS; cc++) {
                    if (Math.abs(rr - cell.row) <= 1 && Math.abs(cc - cell.col) <= 1) continue;
                    if (!board[rr][cc].mine) {
                        board[rr][cc].mine = true;
                        break;
                    }
                }
            }
        }

        calculateNumbers();
        // 快照雷位并同步到 AI 棋盘
        vsMineSnapshot = captureMineSnapshot();
        applyMineSnapshot(vsMineSnapshot);
        // 首次点击：同时启动人类计时器和 AI 计时器 + AI 走子
        vsStartTimers();
        vsStartAiTimer();
        startVsAiSteps();
    }

    sfxClick();
    vsOpenHumanCell(cell);

    if (!vsHumanDead && !vsGameEnded) {
        vsCheckHumanWin();
    }
}

function vsOnHumanRightClick(cell) {
    if (!vsGameActive || vsGameEnded || vsHumanDead) return;
    if (cell.open) return;

    cell.flag = !cell.flag;
    flagCount += cell.flag ? 1 : -1;
    sfxFlag();
    updateVsCellDisplay(cell);
    vsMineCountEl.querySelector(".led-value").textContent = fmtLED(MINE_COUNT - flagCount);
}

function vsOpenHumanCell(cell) {
    if (cell.open || cell.flag) return;
    cell.open = true;

    if (cell.mine) {
        cell.element.classList.add("mine-death");
        sfxLose();
        vsHumanDead = true;
        vsHumanLose();
        return;
    }

    updateVsCellDisplay(cell);

    if (cell.number === 0) {
        for (const [dr, dc] of DIRECTIONS) {
            const nr = cell.row + dr, nc = cell.col + dc;
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
                vsOpenHumanCell(board[nr][nc]);
            }
        }
    }
}

function vsCheckHumanWin() {
    let allOpened = true;
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (!board[r][c].mine && !board[r][c].open) {
                allOpened = false;
            }
        }
    }
    if (allOpened && !vsHumanDead) {
        vsHumanWin();
    }
}


// =========================
// VS 模式：AI 操作
// =========================

function vsAiOpenCell(cell) {
    if (cell.open || cell.flag) return;
    cell.open = true;

    if (cell.mine) {
        cell.element.classList.add("mine-death");
        vsAiDead = true;
        vsAiLose();
        return;
    }

    updateVsCellDisplay(cell);

    // 展开空格
    if (cell.number === 0) {
        for (const [dr, dc] of DIRECTIONS) {
            const nr = cell.row + dr, nc = cell.col + dc;
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
                vsAiOpenCell(vsAiBoard[nr][nc]);
            }
        }
    }
}

function vsCheckAiWin() {
    let allOpened = true;
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (!vsAiBoard[r][c].mine && !vsAiBoard[r][c].open) {
                allOpened = false;
            }
        }
    }
    if (allOpened && !vsAiDead) {
        vsAiWin();
    }
}

/** AI 执行一步 */
function vsAiStep() {
    if (!vsGameActive || vsGameEnded || vsAiDead) return;

    const diff = AI_DIFFICULTY[currentAiDifficulty];
    const solver = new AiSolver(vsAiBoard, ROWS, COLS, currentAiDifficulty);
    const { safe, mines } = solver.deduce();

    // 初级 AI 有概率随机猜测而非使用逻辑
    if (diff.mistakeRate > 0 && Math.random() < diff.mistakeRate) {
        const unknowns = solver.getUnknownCells();
        if (unknowns.length > 0) {
            const pick = unknowns[Math.floor(Math.random() * unknowns.length)];
            vsAiOpenCell(pick);
            vsCheckAiWin();
            return;
        }
    }

    // 插旗（初级 AI 不主动插旗）
    if (diff.useFlags && mines.length > 0) {
        for (const cell of mines) {
            if (cell.flag || cell.open) continue;
            cell.flag = true;
            updateVsCellDisplay(cell);
            const aiFlags = countAiFlags();
            vsAiMineCountEl.querySelector(".led-value").textContent = fmtLED(MINE_COUNT - aiFlags);
        }
        vsCheckAiWin();
        return;
    }

    // 翻开安全格
    if (safe.length > 0) {
        const numCells = safe.filter(c => c.number > 0);
        const pick = numCells.length > 0 ? numCells[0] : safe[0];
        vsAiOpenCell(pick);
        vsCheckAiWin();
        return;
    }

    // 无逻辑可推 → 猜测
    const unknowns = solver.getUnknownCells();
    if (unknowns.length > 0) {
        let pick;

        if (diff.probHeuristic) {
            // 高级/专家：使用概率启发
            pick = solver.getBestGuess();
        } else if (diff.cornerPrefer) {
            // 中级：优先角 → 边 → 随机
            const corners = unknowns.filter(c =>
                (c.row === 0 || c.row === ROWS - 1) && (c.col === 0 || c.col === COLS - 1)
            );
            if (corners.length > 0) {
                pick = corners[Math.floor(Math.random() * corners.length)];
            } else {
                const edges = unknowns.filter(c =>
                    c.row === 0 || c.row === ROWS - 1 || c.col === 0 || c.col === COLS - 1
                );
                pick = edges.length > 0
                    ? edges[Math.floor(Math.random() * edges.length)]
                    : unknowns[Math.floor(Math.random() * unknowns.length)];
            }
        } else {
            // 初级：纯随机
            pick = unknowns[Math.floor(Math.random() * unknowns.length)];
        }

        if (pick) {
            vsAiOpenCell(pick);
            vsCheckAiWin();
        }
    }
}

function countAiFlags() {
    let count = 0;
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (vsAiBoard[r][c].flag) count++;
        }
    }
    return count;
}


// =========================
// VS 模式：胜负判定
// =========================

function vsHumanWin() {
    if (vsGameEnded) return;
    vsGameEnded = true;
    vsGameActive = false;
    vsHumanScore++;
    updateVsScoreDisplay();
    stopVsTimers();
    stopVsAiStep();

    // 自动插旗
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c].mine && !board[r][c].flag) {
                board[r][c].flag = true;
                updateVsCellDisplay(board[r][c]);
            }
        }
    }
    flagCount = MINE_COUNT;
    vsMineCountEl.querySelector(".led-value").textContent = fmtLED(MINE_COUNT - flagCount);
    vsRestartBtn.textContent = "😎";
    vsAiFaceEl.textContent = "😵";
    vsStatusEl.textContent = "🎉 你赢了！";
    vsStatusEl.className = "vs-status win";
    sfxWin();
    recordGame(true, vsSecondsElapsed);
    vsStartBtn.disabled = false;
}

function vsHumanLose() {
    if (vsGameEnded) return;
    vsGameEnded = true;
    vsGameActive = false;
    vsAiScore++;
    updateVsScoreDisplay();
    stopVsTimers();
    stopVsAiStep();

    // 翻开人类棋盘所有雷
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = board[r][c];
            if (cell.mine) {
                cell.open = true;
                updateVsCellDisplay(cell);
            }
            if (cell.flag && !cell.mine) {
                cell.element.classList.add("flag-wrong");
                cell.element.textContent = "❌";
            }
        }
    }
    vsRestartBtn.textContent = "😵";
    vsAiFaceEl.textContent = "😎";
    vsStatusEl.textContent = "💀 你踩雷了！AI 获胜";
    vsStatusEl.className = "vs-status lose";
    recordGame(false, vsSecondsElapsed);
    vsStartBtn.disabled = false;
}

function vsAiWin() {
    if (vsGameEnded) return;
    vsGameEnded = true;
    vsGameActive = false;
    vsAiScore++;
    updateVsScoreDisplay();
    stopVsTimers();
    stopVsAiStep();

    // AI 自动插旗
    let aiFlags = 0;
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (vsAiBoard[r][c].mine && !vsAiBoard[r][c].flag) {
                vsAiBoard[r][c].flag = true;
                updateVsCellDisplay(vsAiBoard[r][c]);
            }
            if (vsAiBoard[r][c].flag) aiFlags++;
        }
    }
    vsAiMineCountEl.querySelector(".led-value").textContent = fmtLED(MINE_COUNT - aiFlags);
    vsAiFaceEl.textContent = "😎";
    vsRestartBtn.textContent = "😵";
    vsStatusEl.textContent = "🤖 AI 赢了！再来一局？";
    vsStatusEl.className = "vs-status lose";
    recordGame(false, vsSecondsElapsed);
    vsStartBtn.disabled = false;
}

function vsAiLose() {
    if (vsGameEnded) return;
    vsGameEnded = true;
    vsGameActive = false;
    vsHumanScore++;
    updateVsScoreDisplay();
    stopVsTimers();
    stopVsAiStep();

    // 显示 AI 棋盘所有雷
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = vsAiBoard[r][c];
            if (cell.mine) {
                cell.open = true;
                updateVsCellDisplay(cell);
            }
        }
    }
    vsAiFaceEl.textContent = "😵";
    vsRestartBtn.textContent = "😎";
    vsStatusEl.textContent = "🎉 AI 踩雷了！你赢了！";
    vsStatusEl.className = "vs-status win";
    sfxWin();
    recordGame(true, vsSecondsElapsed);
    vsStartBtn.disabled = false;
}


// =========================
// VS 模式：计时器
// =========================

function vsStartTimers() {
    vsSecondsElapsed = 0;
    vsAiSecondsElapsed = 0;
    vsTimerEl.querySelector(".led-value").textContent = "000";
    vsAiTimerEl.querySelector(".led-value").textContent = "000";

    vsTimerInterval = setInterval(() => {
        vsSecondsElapsed++;
        if (vsSecondsElapsed > 999) vsSecondsElapsed = 999;
        vsTimerEl.querySelector(".led-value").textContent = fmtLED(vsSecondsElapsed);
    }, 1000);
}

function vsStartAiTimer() {
    vsAiTimerInterval = setInterval(() => {
        vsAiSecondsElapsed++;
        if (vsAiSecondsElapsed > 999) vsAiSecondsElapsed = 999;
        vsAiTimerEl.querySelector(".led-value").textContent = fmtLED(vsAiSecondsElapsed);
    }, 1000);
}

function stopVsTimers() {
    clearInterval(vsTimerInterval);
    vsTimerInterval = null;
    clearInterval(vsAiTimerInterval);
    vsAiTimerInterval = null;
}


// =========================
// VS 模式：AI 自动走子
// =========================

function scheduleAiStep() {
    if (!vsGameActive || vsGameEnded || vsAiDead) {
        vsAiStepInterval = null;
        return;
    }
    const diff = AI_DIFFICULTY[currentAiDifficulty];
    const delay = diff.speedMin + Math.random() * (diff.speedMax - diff.speedMin);
    vsAiStepInterval = setTimeout(() => {
        vsAiStep();
        scheduleAiStep();  // 递归调度下一步
    }, delay);
}

function startVsAiSteps() {
    stopVsAiStep();
    scheduleAiStep();
}

function stopVsAiStep() {
    clearTimeout(vsAiStepInterval);
    vsAiStepInterval = null;
}


// =========================
// VS 模式：更新格子外观
// =========================

function updateVsCellDisplay(cell) {
    const el = cell.element;
    if (!el) return;

    el.classList.remove("open", "flag", "mine", "mine-death", "flag-wrong");
    el.textContent = "";

    if (cell.open) {
        el.classList.add("open");
        if (cell.mine) {
            el.classList.add("mine");
            el.textContent = "💣";
        } else if (cell.number > 0) {
            el.textContent = cell.number;
            el.classList.add(`n${cell.number}`);
        }
    } else if (cell.flag) {
        el.classList.add("flag");
        el.textContent = "🚩";
    }
}


// =========================
// VS 模式：开始对战
// =========================

function startVsBattle() {
    if (vsGameActive) return;

    initVsMode();
    vsGameActive = true;
    vsGameEnded = false;
    vsHumanFirstClick = true;
    vsAiFirstClick = true;
    vsHumanDead = false;
    vsAiDead = false;
    vsMineSnapshot = null;

    // 重置计时显示，但等首次点击后再启动计时器
    vsSecondsElapsed = 0;
    vsAiSecondsElapsed = 0;
    vsTimerEl.querySelector(".led-value").textContent = "000";
    vsAiTimerEl.querySelector(".led-value").textContent = "000";

    vsStatusEl.textContent = "⚡ 对战中...你先走！";
    vsStatusEl.className = "vs-status";
    vsStartBtn.disabled = true;
}

vsStartBtn.addEventListener("click", startVsBattle);


// =========================
// AI 难度选择
// =========================

const aiDiffBtns = document.querySelectorAll(".ai-diff-btn");

function setAiDifficulty(level) {
    if (level === currentAiDifficulty) return;
    currentAiDifficulty = level;

    aiDiffBtns.forEach(btn => btn.classList.toggle("active", btn.dataset.ai === level));

    // 如果正在对战中，立即应用新速度（通过重启 AI 走子循环）
    if (vsGameActive && !vsGameEnded && vsAiStepInterval) {
        stopVsAiStep();
        scheduleAiStep();
    }
}

aiDiffBtns.forEach(btn => {
    btn.addEventListener("click", () => setAiDifficulty(btn.dataset.ai));
});


// =========================
// VS 模式：重新开始
// =========================

function vsRestart() {
    stopVsGame();
    initVsMode();
    // 自动开始新对局
    vsGameActive = true;
    vsGameEnded = false;
    vsHumanFirstClick = true;
    vsAiFirstClick = true;
    vsHumanDead = false;
    vsAiDead = false;
    vsMineSnapshot = null;
    vsSecondsElapsed = 0;
    vsAiSecondsElapsed = 0;
    vsTimerEl.querySelector(".led-value").textContent = "000";
    vsAiTimerEl.querySelector(".led-value").textContent = "000";
    vsStatusEl.textContent = "⚡ 对战中...你先走！";
    vsStatusEl.className = "vs-status";
    vsStartBtn.disabled = true;
}

function stopVsGame() {
    vsGameActive = false;
    vsGameEnded = false;
    stopVsTimers();
    stopVsAiStep();
}

vsRestartBtn.addEventListener("click", vsRestart);


// =========================
// VS 模式：更新比分显示
// =========================

function updateVsScoreDisplay() {
    vsHumanWinsEl.textContent = vsHumanScore;
    vsAiWinsEl.textContent = vsAiScore;
}


// =========================
// HTML 转义（供多人对战和排行榜使用）
// =========================

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}


// =========================
// 多人对战 — WebSocket 连接管理
// =========================

let ws = null;
let wsConnected = false;
let wsReconnectAttempts = 0;
const WS_MAX_RECONNECT = 3;
const WS_RECONNECT_DELAYS = [1000, 2000, 4000];

function getWsUrl() {
    // 1. 如果用户手动输入了自定义地址，优先使用
    const inputEl = document.getElementById("multi-server-url");
    const customUrl = (inputEl.value || "").trim();
    if (customUrl) return customUrl;

    // 2. 自动检测：使用当前页面的协议、主机名和端口
    //    手机端访问时自动指向服务器地址，不会错误地连到手机自己的 localhost
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    const port = window.location.port || "3000";
    const autoUrl = protocol + "//" + host + ":" + port;

    // 3. 将自动检测到的地址回填到输入框，方便用户查看
    if (inputEl) inputEl.value = autoUrl;
    return autoUrl;
}

function connectToServer(url) {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return; // 已连接或正在连接
    }

    const targetUrl = url || getWsUrl();
    updateConnStatus("connecting", "● 连接中...");

    try {
        ws = new WebSocket(targetUrl);
    } catch (e) {
        updateConnStatus("disconnected", "● 连接失败");
        showToast("无法连接到服务器", "error");
        return;
    }

    // 连接超时处理：8 秒内未建立连接则自动断开并提示
    let connectTimeout = setTimeout(() => {
        if (ws && ws.readyState === WebSocket.CONNECTING) {
            ws.close();
            ws = null;
            wsConnected = false;
            updateConnStatus("disconnected", "● 连接超时");
            showToast("连接超时，请检查服务器地址是否正确", "error");
        }
    }, 8000);

    ws.addEventListener("open", () => {
        clearTimeout(connectTimeout);
        wsConnected = true;
        wsReconnectAttempts = 0;
        updateConnStatus("connected", "● 已连接");
        showToast("已连接到服务器", "success");

        // 注册为在线用户（好友系统用）
        if (currentUser) {
            sendMessage({ type: "set_username", username: currentUser.username });
        }
    });

    ws.addEventListener("message", (event) => {
        handleServerMessage(event);
    });

    ws.addEventListener("close", () => {
        clearTimeout(connectTimeout);
        wsConnected = false;
        updateConnStatus("disconnected", "● 已断开");

        // 如果在游戏中，尝试重连
        if (multiRoomCode && wsReconnectAttempts < WS_MAX_RECONNECT) {
            const delay = WS_RECONNECT_DELAYS[wsReconnectAttempts];
            wsReconnectAttempts++;
            updateConnStatus("connecting", `● 重连中(${wsReconnectAttempts}/${WS_MAX_RECONNECT})...`);
            showToast(`连接断开，${delay/1000}秒后重连...`, "error");
            setTimeout(() => connectToServer(targetUrl), delay);
        } else if (wsReconnectAttempts >= WS_MAX_RECONNECT) {
            showToast("无法重新连接，请返回大厅", "error");
            resetMultiState();
            showMultiLobby();
        }
    });

    ws.addEventListener("error", () => {
        // close 事件会随之触发，这里只做静默处理
    });
}

function disconnectFromServer() {
    wsReconnectAttempts = WS_MAX_RECONNECT; // 阻止自动重连
    if (ws) {
        ws.close();
        ws = null;
    }
    wsConnected = false;
    updateConnStatus("disconnected", "● 未连接");
}

function sendMessage(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
        return true;
    }
    showToast("未连接到服务器", "error");
    return false;
}

function updateConnStatus(status, text) {
    const el = document.getElementById("multi-conn-status");
    if (el) {
        el.className = "multi-conn-status " + status;
        el.textContent = text;
    }
}


// =========================
// 多人对战 — Toast 通知
// =========================

let toastTimer = null;

function showToast(message, type) {
    const toast = document.getElementById("multi-toast");
    if (!toast) return;

    if (toastTimer) clearTimeout(toastTimer);

    toast.textContent = message;
    toast.className = "multi-toast " + type + " show";

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
        toastTimer = null;
    }, 3000);
}


// =========================
// 多人对战 — 状态变量
// =========================

let multiRoomCode = null;
let multiIsHost = false;
let multiMyPlayerId = null;
let multiPlayers = [];       // [{ id, username, isHost, alive, finished, openedCount, flagCount, seconds }]
let multiGameActive = false;
let multiGameEnded = false;
let multiMineLayout = null;  // [{ r, c }] from server
let multiTotalCells = 0;     // total non-mine cells
let multiRows = 9;
let multiCols = 9;
let multiMines = 10;
let multiSecondsElapsed = 0;
let multiTimerInterval = null;
let multiMyFlagCount = 0;
let multiMyOpenedCount = 0;
let multiMyBoard = [];       // 2D Cell array for current player
let multiCurrentDiff = "beginner";
let multiMyFirstClick = true;
let multiProgressDebounce = null;


// =========================
// 多人对战 — 辅助函数
// =========================

function getMultiUsername() {
    if (currentUser) return currentUser.username;
    return "Guest_" + Math.random().toString(36).substring(2, 6).toUpperCase();
}

function countMultiOpened() {
    let count = 0;
    for (let r = 0; r < multiRows; r++) {
        for (let c = 0; c < multiCols; c++) {
            if (multiMyBoard[r] && multiMyBoard[r][c] && multiMyBoard[r][c].open && !multiMyBoard[r][c].mine) {
                count++;
            }
        }
    }
    return count;
}

function sendProgress() {
    if (!multiGameActive || multiGameEnded) return;

    // 防抖 300ms
    if (multiProgressDebounce) return;
    multiProgressDebounce = setTimeout(() => {
        multiProgressDebounce = null;
        multiMyOpenedCount = countMultiOpened();
        sendMessage({
            type: "cell_open",
            openedCount: multiMyOpenedCount,
            seconds: multiSecondsElapsed,
        });
    }, 300);
}


// =========================
// 多人对战 — 棋盘初始化
// =========================

function initMultiBoard(rows, cols) {
    multiMyBoard = [];
    for (let r = 0; r < rows; r++) {
        multiMyBoard[r] = [];
        for (let c = 0; c < cols; c++) {
            multiMyBoard[r][c] = new Cell(r, c);
        }
    }
}

function applyMineLayout(mineLayout) {
    // 先全部清雷
    for (let r = 0; r < multiRows; r++) {
        for (let c = 0; c < multiCols; c++) {
            multiMyBoard[r][c].mine = false;
        }
    }
    // 设置雷
    for (const { r, c } of mineLayout) {
        if (r >= 0 && r < multiRows && c >= 0 && c < multiCols) {
            multiMyBoard[r][c].mine = true;
        }
    }
    // 计算数字
    for (let r = 0; r < multiRows; r++) {
        for (let c = 0; c < multiCols; c++) {
            if (multiMyBoard[r][c].mine) continue;
            let count = 0;
            for (const [dr, dc] of DIRECTIONS) {
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < multiRows && nc >= 0 && nc < multiCols && multiMyBoard[nr][nc].mine) {
                    count++;
                }
            }
            multiMyBoard[r][c].number = count;
        }
    }
}

function renderMultiBoard() {
    const boardEl = document.getElementById("multi-board-self");
    if (!boardEl) return;

    boardEl.innerHTML = "";
    boardEl.style.display = "grid";
    const diffCfg = DIFFICULTY[multiCurrentDiff];
    const cellSize = diffCfg ? diffCfg.cellSize : (multiRows > 12 || multiCols > 20 ? 26 : multiRows > 9 ? 30 : 32);
    document.documentElement.style.setProperty("--cell-size", `${cellSize}px`);
    boardEl.style.gridTemplateColumns = `repeat(${multiCols}, ${cellSize}px)`;

    for (let r = 0; r < multiRows; r++) {
        for (let c = 0; c < multiCols; c++) {
            const cell = multiMyBoard[r][c];
            const el = document.createElement("div");
            el.classList.add("cell");
            el.dataset.row = r;
            el.dataset.col = c;

            el.addEventListener("click", () => multiOnCellClick(cell));
            el.addEventListener("contextmenu", (e) => {
                e.preventDefault();
                multiOnCellRightClick(cell);
            });
            addLongPressSupport(el, () => multiOnCellRightClick(cell));

            cell.element = el;
            boardEl.appendChild(el);
        }
    }
}

function multiUpdateCellDisplay(cell) {
    const el = cell.element;
    if (!el) return;

    el.classList.remove("open", "flag", "mine", "mine-death", "flag-wrong");
    el.textContent = "";

    if (cell.open) {
        el.classList.add("open");
        if (cell.mine) {
            el.classList.add("mine");
            el.textContent = "💣";
        } else if (cell.number > 0) {
            el.textContent = cell.number;
            el.classList.add(`n${cell.number}`);
        }
    } else if (cell.flag) {
        el.classList.add("flag");
        el.textContent = "🚩";
    }
}


// =========================
// 多人对战 — 游戏逻辑
// =========================

function multiOpenCell(cell) {
    if (!multiGameActive || multiGameEnded) return;
    if (cell.open || cell.flag) return;

    cell.open = true;

    if (cell.mine) {
        cell.element.classList.add("mine-death");
        sfxLose();
        multiOnLose();
        return;
    }

    multiUpdateCellDisplay(cell);

    if (cell.number === 0) {
        for (const [dr, dc] of DIRECTIONS) {
            const nr = cell.row + dr, nc = cell.col + dc;
            if (nr >= 0 && nr < multiRows && nc >= 0 && nc < multiCols) {
                multiOpenCell(multiMyBoard[nr][nc]);
            }
        }
    }
}

function multiOnCellClick(cell) {
    if (!multiGameActive || multiGameEnded) return;
    if (cell.open || cell.flag) return;

    if (multiMyFirstClick) {
        multiMyFirstClick = false;
        // 服务器已生成雷图，本地已应用，直接开始计时
        multiStartTimer();
    }

    sfxClick();
    multiOpenCell(cell);

    if (!multiGameEnded) {
        multiCheckWin();
        sendProgress();
    }
}

function multiOnCellRightClick(cell) {
    if (!multiGameActive || multiGameEnded) return;
    if (cell.open) return;

    cell.flag = !cell.flag;
    multiMyFlagCount += cell.flag ? 1 : -1;
    sfxFlag();
    multiUpdateCellDisplay(cell);

    const mineCountEl = document.getElementById("multi-mine-count");
    if (mineCountEl) {
        mineCountEl.querySelector(".led-value").textContent = fmtLED(multiMines - multiMyFlagCount);
    }

    sendMessage({
        type: "cell_flag",
        flagCount: multiMyFlagCount,
        seconds: multiSecondsElapsed,
    });
}

function multiCheckWin() {
    let allOpened = true;
    for (let r = 0; r < multiRows; r++) {
        for (let c = 0; c < multiCols; c++) {
            if (!multiMyBoard[r][c].mine && !multiMyBoard[r][c].open) {
                allOpened = false;
            }
        }
    }
    if (allOpened) {
        multiOnWin();
    }
}

function multiOnWin() {
    if (multiGameEnded) return;
    multiGameEnded = true;
    multiGameActive = false;
    multiStopTimer();

    // 自动插旗
    for (let r = 0; r < multiRows; r++) {
        for (let c = 0; c < multiCols; c++) {
            if (multiMyBoard[r][c].mine && !multiMyBoard[r][c].flag) {
                multiMyBoard[r][c].flag = true;
                multiUpdateCellDisplay(multiMyBoard[r][c]);
            }
        }
    }
    multiMyFlagCount = multiMines;
    const mineCountEl = document.getElementById("multi-mine-count");
    if (mineCountEl) {
        mineCountEl.querySelector(".led-value").textContent = fmtLED(0);
    }

    const faceEl = document.getElementById("multi-face");
    if (faceEl) faceEl.textContent = "😎";
    sfxWin();

    sendMessage({
        type: "game_result",
        result: "win",
        seconds: multiSecondsElapsed,
    });

    recordGame(true, multiSecondsElapsed, "multi");

    // 更新自己的对手卡片状态
    updateOwnStatusInOpponents("win");
}

function multiOnLose() {
    if (multiGameEnded) return;
    multiGameEnded = true;
    multiGameActive = false;
    multiStopTimer();

    // 翻开所有雷
    for (let r = 0; r < multiRows; r++) {
        for (let c = 0; c < multiCols; c++) {
            const cell = multiMyBoard[r][c];
            if (cell.mine) {
                cell.open = true;
                multiUpdateCellDisplay(cell);
            }
            if (cell.flag && !cell.mine) {
                cell.element.classList.add("flag-wrong");
                cell.element.textContent = "❌";
            }
        }
    }

    const faceEl = document.getElementById("multi-face");
    if (faceEl) faceEl.textContent = "😵";

    sendMessage({
        type: "game_result",
        result: "lose",
        seconds: multiSecondsElapsed,
    });

    recordGame(false, multiSecondsElapsed, "multi");

    // 更新自己的对手卡片状态
    updateOwnStatusInOpponents("lose");
}


// =========================
// 多人对战 — 计时器
// =========================

function multiStartTimer() {
    multiSecondsElapsed = 0;
    const timerEl = document.getElementById("multi-timer");
    if (timerEl) timerEl.querySelector(".led-value").textContent = "000";

    multiTimerInterval = setInterval(() => {
        multiSecondsElapsed++;
        if (multiSecondsElapsed > 999) multiSecondsElapsed = 999;
        const el = document.getElementById("multi-timer");
        if (el) el.querySelector(".led-value").textContent = fmtLED(multiSecondsElapsed);
    }, 1000);
}

function multiStopTimer() {
    clearInterval(multiTimerInterval);
    multiTimerInterval = null;
}


// =========================
// 多人对战 — 房间管理
// =========================

function showMultiLobby() {
    document.getElementById("multi-lobby").style.display = "";
    document.getElementById("multi-room").style.display = "none";
    document.getElementById("multi-game").style.display = "none";
    document.getElementById("multi-join-msg").textContent = "";
    document.getElementById("multi-join-msg").className = "multi-msg";
    document.getElementById("multi-room-input").value = "";
    document.getElementById("multi-created-info").style.display = "none";
    document.getElementById("multi-copy-ok").style.display = "none";
}

function showMultiRoom() {
    document.getElementById("multi-lobby").style.display = "none";
    document.getElementById("multi-room").style.display = "";
    document.getElementById("multi-game").style.display = "none";
    document.getElementById("multi-room-msg").textContent = "";
    document.getElementById("multi-room-msg").className = "multi-msg";
}

function showMultiGame() {
    document.getElementById("multi-lobby").style.display = "none";
    document.getElementById("multi-room").style.display = "none";
    document.getElementById("multi-game").style.display = "";
}

function renderPlayerList() {
    const listEl = document.getElementById("multi-player-list");
    if (!listEl) return;

    const countEl = document.getElementById("multi-player-count");
    if (countEl) countEl.textContent = multiPlayers.length;

    const startBtn = document.getElementById("multi-start-btn");
    const isHost = multiIsHost;
    if (startBtn) {
        startBtn.disabled = !(isHost && multiPlayers.length >= 2);
        startBtn.textContent = isHost
            ? (multiPlayers.length >= 2 ? "🚀 开始游戏" : "🚀 开始游戏 (需要至少2人)")
            : "🔒 等待房主开始...";
    }

    // 更新难度按钮状态 (只有房主可以点)
    const diffBtns = document.querySelectorAll("#multi-diff-bar .diff-btn");
    diffBtns.forEach(btn => {
        btn.disabled = !isHost;
        btn.style.opacity = isHost ? "" : "0.5";
        btn.style.cursor = isHost ? "" : "not-allowed";
        btn.classList.toggle("active", btn.dataset.level === multiCurrentDiff);
    });

    let html = "";
    for (const p of multiPlayers) {
        const isMe = p.id === multiMyPlayerId;
        const hostClass = p.isHost ? " is-host" : "";
        html += `<div class="multi-player-card${hostClass}">
            <div class="multi-player-avatar">${isMe ? "🧑" : "👤"}</div>
            <div class="multi-player-name">${escapeHtml(p.username)}</div>
            ${p.isHost ? '<span class="multi-player-badge host">房主</span>' : ""}
            ${isMe ? '<span class="multi-player-badge you">你</span>' : ""}
        </div>`;
    }

    listEl.innerHTML = html;
}

function resetMultiState() {
    multiRoomCode = null;
    multiIsHost = false;
    multiMyPlayerId = null;
    multiPlayers = [];
    multiGameActive = false;
    multiGameEnded = false;
    multiMineLayout = null;
    multiTotalCells = 0;
    multiMyBoard = [];
    multiMyFirstClick = true;
    multiSecondsElapsed = 0;
    multiMyFlagCount = 0;
    multiMyOpenedCount = 0;
    multiStopTimer();
    if (multiProgressDebounce) {
        clearTimeout(multiProgressDebounce);
        multiProgressDebounce = null;
    }

    const playAgainEl = document.getElementById("multi-play-again");
    if (playAgainEl) playAgainEl.style.display = "none";
    const rankingEl = document.getElementById("multi-ranking");
    if (rankingEl) rankingEl.style.display = "none";
    const rankingListEl = document.getElementById("multi-ranking-list");
    if (rankingListEl) rankingListEl.innerHTML = "";
    const opponentsEl = document.getElementById("multi-opponents-list");
    if (opponentsEl) opponentsEl.innerHTML = "";
}

function getMultiDifficulty() {
    const cfg = DIFFICULTY[multiCurrentDiff];
    return { rows: cfg.rows, cols: cfg.cols, mines: cfg.mines };
}


// =========================
// 多人对战 — 房间操作
// =========================

function handleCreateRoom() {
    if (!wsConnected) {
        showToast("请先连接到服务器", "error");
        return;
    }

    const diff = getMultiDifficulty();
    sendMessage({
        type: "create_room",
        username: getMultiUsername(),
        difficulty: diff,
    });
}

function handleJoinRoom() {
    if (!wsConnected) {
        showToast("请先连接到服务器", "error");
        return;
    }

    const codeInput = document.getElementById("multi-room-input");
    const code = (codeInput.value || "").toUpperCase().trim();
    if (!code || code.length < 4) {
        document.getElementById("multi-join-msg").textContent = "⚠ 请输入有效的房间码";
        document.getElementById("multi-join-msg").className = "multi-msg error";
        return;
    }

    document.getElementById("multi-join-msg").textContent = "";
    document.getElementById("multi-join-msg").className = "multi-msg";

    sendMessage({
        type: "join_room",
        roomCode: code,
        username: getMultiUsername(),
    });
}

function handleLeaveRoom() {
    sendMessage({ type: "leave_room" });
    resetMultiState();
    showMultiLobby();
}

function handleStartGame() {
    if (!multiIsHost) return;
    const diff = getMultiDifficulty();
    sendMessage({
        type: "start_game",
        difficulty: diff,
    });
}

function handlePlayAgain() {
    if (!multiIsHost) return;
    sendMessage({ type: "play_again" });
}


// =========================
// 多人对战 — 对手进度显示
// =========================

function renderOpponentCards() {
    const listEl = document.getElementById("multi-opponents-list");
    if (!listEl) return;

    const others = multiPlayers.filter(p => p.id !== multiMyPlayerId);
    if (others.length === 0) {
        listEl.innerHTML = '<div style="color:rgba(255,255,255,0.3);text-align:center;padding:12px;font-size:13px;">等待其他玩家...</div>';
        return;
    }

    let html = "";
    for (const p of others) {
        const nonMineCount = multiRows * multiCols - multiMines;
        const progress = nonMineCount > 0 ? Math.min(100, Math.round((p.openedCount / nonMineCount) * 100)) : 0;
        const statusClass = !p.alive ? "dead" : p.finished ? "finished" : "";
        const fillClass = !p.alive ? "dead" : p.finished ? "finished" : "";
        const statusIcon = !p.alive ? "💀" : p.finished ? "🏁" : "🟢";
        const statusText = !p.alive ? "已踩雷" : p.finished ? "已完成" : "进行中";

        html += `<div class="multi-opponent-card ${statusClass}" data-player-id="${p.id}">
            <div class="multi-opponent-header">
                <span class="multi-opponent-name">${escapeHtml(p.username)}</span>
                <span class="multi-opponent-status" title="${statusText}">${statusIcon}</span>
            </div>
            <div class="multi-progress-bar">
                <div class="multi-progress-fill ${fillClass}" style="width:${progress}%"></div>
            </div>
            <div style="display:flex;justify-content:space-between;">
                <span class="multi-progress-text">${progress}% (${p.openedCount}/${nonMineCount})</span>
                <span class="multi-opponent-timer">⏱ ${fmtLED(p.seconds)}</span>
            </div>
        </div>`;
    }

    listEl.innerHTML = html;
}

function updateOpponentCards() {
    const others = multiPlayers.filter(p => p.id !== multiMyPlayerId);
    const nonMineCount = multiRows * multiCols - multiMines;

    for (const p of others) {
        const card = document.querySelector(`.multi-opponent-card[data-player-id="${p.id}"]`);
        if (!card) { renderOpponentCards(); return; }

        const progress = nonMineCount > 0 ? Math.min(100, Math.round((p.openedCount / nonMineCount) * 100)) : 0;
        const fillEl = card.querySelector(".multi-progress-fill");
        const textEl = card.querySelector(".multi-progress-text");
        const timerEl = card.querySelector(".multi-opponent-timer");
        const statusEl = card.querySelector(".multi-opponent-status");

        if (fillEl) fillEl.style.width = progress + "%";
        if (textEl) textEl.textContent = `${progress}% (${p.openedCount}/${nonMineCount})`;
        if (timerEl) timerEl.textContent = `⏱ ${fmtLED(p.seconds)}`;

        if (!p.alive) {
            card.classList.add("dead");
            if (fillEl) fillEl.classList.add("dead");
            if (statusEl) { statusEl.textContent = "💀"; statusEl.title = "已踩雷"; }
        }
        if (p.finished && p.alive) {
            card.classList.add("finished");
            if (fillEl) fillEl.classList.add("finished");
            if (statusEl) { statusEl.textContent = "🏁"; statusEl.title = "已完成"; }
        }
    }
}

function updateOwnStatusInOpponents(result) {
    // 自己完成/失败后，更新对手列表中自己相关显示
    // 自己的状态已在 player_result 消息处理后更新
}

function renderRankings(rankings) {
    const rankingDiv = document.getElementById("multi-ranking");
    const listEl = document.getElementById("multi-ranking-list");
    if (!rankingDiv || !listEl) return;

    rankingDiv.style.display = "";
    const playAgainBtn = document.getElementById("multi-play-again");
    if (playAgainBtn) {
        playAgainBtn.style.display = multiIsHost ? "" : "none";
    }

    let html = "";
    const ranked = rankings.filter(r => r.rank !== null);
    const unranked = rankings.filter(r => r.rank === null);

    const all = [...ranked, ...unranked];
    for (const r of all) {
        const isMe = multiPlayers.find(p => p.id === multiMyPlayerId);
        const isMeName = isMe && isMe.username === r.username;
        const rankDisplay = r.rank || "-";
        const resultClass = r.result === "win" ? "win" : r.result === "lose" ? "lose" : "unfinished";
        const resultText = r.result === "win" ? `🏆 ${r.seconds}s` :
                           r.result === "lose" ? `💀 ${r.seconds}s` :
                           r.result === "forfeit" ? "🚫 弃权" : "⏳ 未完成";

        html += `<div class="multi-ranking-row">
            <div class="multi-ranking-rank">${rankDisplay}</div>
            <div class="multi-ranking-name">${escapeHtml(r.username)}${isMeName ? " (我)" : ""}</div>
            <div class="multi-ranking-result ${resultClass}">${resultText}</div>
        </div>`;
    }

    listEl.innerHTML = html;
}


// =========================
// 多人对战 — 服务器消息处理
// =========================

function handleServerMessage(event) {
    let msg;
    try {
        msg = JSON.parse(event.data);
    } catch (_) {
        return;
    }

    switch (msg.type) {

        case "room_created":
            multiRoomCode = msg.roomCode;
            multiIsHost = true;
            multiMyPlayerId = msg.players[0]?.id;
            multiPlayers = msg.players;
            multiCurrentDiff = "beginner";

            document.getElementById("multi-room-code-display").textContent = msg.roomCode;
            document.getElementById("multi-room-code-label").textContent = msg.roomCode;
            document.getElementById("multi-created-info").style.display = "";
            document.getElementById("multi-copy-ok").style.display = "none";

            renderPlayerList();
            showMultiRoom();
            showToast("房间创建成功！", "success");
            break;

        case "room_joined":
            multiRoomCode = msg.roomCode;
            multiIsHost = false;
            multiMyPlayerId = msg.yourId;
            multiPlayers = msg.players;

            // 同步难度
            if (msg.difficulty) {
                for (const [key, cfg] of Object.entries(DIFFICULTY)) {
                    if (cfg.rows === msg.difficulty.rows && cfg.cols === msg.difficulty.cols && cfg.mines === msg.difficulty.mines) {
                        multiCurrentDiff = key;
                        break;
                    }
                }
            }

            document.getElementById("multi-room-code-label").textContent = msg.roomCode;
            renderPlayerList();
            showMultiRoom();
            showToast("已加入房间！", "success");
            break;

        case "player_joined":
            multiPlayers = msg.players;
            renderPlayerList();
            showToast(`${msg.player.username} 加入了房间`, "info");
            break;

        case "player_left":
            multiPlayers = msg.players;
            // 检查自己是否变成房主
            multiIsHost = multiPlayers.some(p => p.id === multiMyPlayerId && p.isHost);
            renderPlayerList();

            if (multiGameActive) {
                renderOpponentCards();
            }
            break;

        case "game_started":
            multiMineLayout = msg.mineLayout;
            multiRows = msg.rows;
            multiCols = msg.cols;
            multiMines = msg.mines;
            multiTotalCells = multiRows * multiCols - multiMines;
            multiPlayers = msg.players;

            // 更新自己的 isHost 状态
            const me = multiPlayers.find(p => p.id === multiMyPlayerId);
            if (me) multiIsHost = me.isHost;

            // 重置游戏状态
            multiGameActive = true;
            multiGameEnded = false;
            multiMyFirstClick = true;
            multiSecondsElapsed = 0;
            multiMyFlagCount = 0;
            multiMyOpenedCount = 0;
            if (multiProgressDebounce) {
                clearTimeout(multiProgressDebounce);
                multiProgressDebounce = null;
            }
            multiStopTimer();

            // 初始化棋盘
            initMultiBoard(multiRows, multiCols);
            applyMineLayout(multiMineLayout);
            renderMultiBoard();

            // 更新 UI
            const faceEl = document.getElementById("multi-face");
            if (faceEl) faceEl.textContent = "😊";
            const mineCountEl = document.getElementById("multi-mine-count");
            if (mineCountEl) mineCountEl.querySelector(".led-value").textContent = fmtLED(multiMines);
            const timerEl = document.getElementById("multi-timer");
            if (timerEl) timerEl.querySelector(".led-value").textContent = "000";

            document.getElementById("multi-play-again").style.display = "none";
            document.getElementById("multi-ranking").style.display = "none";

            renderOpponentCards();
            showMultiGame();
            showToast("游戏开始！你先走！", "info");
            break;

        case "player_progress":
            // 更新对手进度
            const target = multiPlayers.find(p => p.id === msg.playerId);
            if (target) {
                target.openedCount = msg.openedCount;
                target.flagCount = msg.flagCount;
                target.seconds = msg.seconds;
                target.alive = msg.alive;
                target.finished = msg.finished;
            }
            updateOpponentCards();
            break;

        case "player_result":
            // 更新玩家结果
            const tp = multiPlayers.find(p => p.id === msg.playerId);
            if (tp) {
                tp.finished = true;
                tp.alive = (msg.result === "win");
                tp.seconds = msg.seconds;
            }

            updateOpponentCards();

            // 显示实时排名
            if (msg.rankings) {
                renderRankings(msg.rankings);
            }

            // 如果还没结束，提示
            if (!multiGameEnded && msg.playerId !== multiMyPlayerId) {
                const resultText = msg.result === "win" ? "完成了！🏁" :
                                   msg.result === "lose" ? "踩雷了💀" : "断线了🚫";
                showToast(`${msg.username} ${resultText}`, "info");
            }
            break;

        case "game_ended":
            if (msg.rankings) {
                renderRankings(msg.rankings);
            }
            if (!multiGameEnded) {
                multiGameActive = false;
                multiGameEnded = true;
                multiStopTimer();
            }
            showToast("游戏结束！", "info");
            break;

        case "room_reset":
            // 房主点了再来一局
            // 保存重置前需要保留的值
            const savedPlayerId = multiMyPlayerId;
            const roomCodeLabel = document.getElementById("multi-room-code-label");
            const savedRoomCode = multiRoomCode || (roomCodeLabel ? roomCodeLabel.textContent : "");

            if (msg.difficulty) {
                for (const [key, cfg] of Object.entries(DIFFICULTY)) {
                    if (cfg.rows === msg.difficulty.rows && cfg.cols === msg.difficulty.cols && cfg.mines === msg.difficulty.mines) {
                        multiCurrentDiff = key;
                        break;
                    }
                }
            }
            resetMultiState();
            multiMyPlayerId = savedPlayerId;
            multiRoomCode = savedRoomCode;
            multiPlayers = msg.players;
            // 更新 isHost
            const myself = multiPlayers.find(p => p.id === multiMyPlayerId);
            if (myself) multiIsHost = myself.isHost;
            renderPlayerList();
            showMultiRoom();
            showToast("房间已重置，准备新一局！", "success");
            break;

        case "difficulty_updated":
            if (msg.difficulty) {
                for (const [key, cfg] of Object.entries(DIFFICULTY)) {
                    if (cfg.rows === msg.difficulty.rows && cfg.cols === msg.difficulty.cols && cfg.mines === msg.difficulty.mines) {
                        multiCurrentDiff = key;
                        break;
                    }
                }
            }
            renderPlayerList();
            break;

        case "room_closed":
            showToast("房间已关闭: " + (msg.reason || "房主离开"), "error");
            resetMultiState();
            showMultiLobby();
            break;

        case "left_room":
            resetMultiState();
            showMultiLobby();
            break;

        // =========================
        // 好友挑战消息
        // =========================

        case "username_set":
            // 在线注册成功
            console.log("[好友] 在线注册成功: " + msg.username);
            break;

        case "challenge_sent":
            showToast("⚔️ 已向 " + msg.to + " 发起挑战！", "success");
            break;

        case "challenge_error":
            showToast("⚠ " + msg.message, "error");
            break;

        case "challenge_received": {
            // 收到好友挑战 — 弹出确认
            const fromName = msg.from;
            const diff = msg.difficulty || { rows: 9, cols: 9, mines: 10 };
            const diffLabel = getDifficultyLabel(diff);

            // 用浏览器 confirm 或 toast 提示
            const accepted = confirm(
                `⚔️ ${fromName} 向你发起扫雷挑战！\n\n` +
                `难度：${diffLabel}\n\n` +
                `点击"确定"接受挑战，"取消"则拒绝。`
            );

            sendMessage({
                type: "challenge_response",
                from: currentUser ? currentUser.username : "Guest",
                to: fromName,
                accepted: accepted,
                difficulty: diff,
            });

            if (accepted) {
                showToast("✅ 已接受挑战，正在进入房间...", "success");
            }
            break;
        }

        case "challenge_accepted": {
            // 双方进入私人房间 — 先确保连接
            showToast("⚔️ 挑战开始！进入房间 " + msg.roomCode, "success");

            // 自动切换到多人模式
            if (currentMode !== "multiplayer") {
                switchMode("multiplayer");
            }

            // 确保已连接到服务器
            if (!wsConnected) {
                connectToServer(getWsUrl());
                // 等待连接成功后加入房间
                const waitConnect = setInterval(() => {
                    if (wsConnected) {
                        clearInterval(waitConnect);
                        sendMessage({
                            type: "join_room",
                            roomCode: msg.roomCode,
                            username: currentUser ? currentUser.username : "Guest",
                        });
                    }
                }, 200);
                setTimeout(() => clearInterval(waitConnect), 8000);
            } else {
                // 直接加入房间
                sendMessage({
                    type: "join_room",
                    roomCode: msg.roomCode,
                    username: currentUser ? currentUser.username : "Guest",
                });
            }
            break;
        }

        case "challenge_declined":
            showToast("❌ " + (msg.message || (msg.from + " 拒绝了你的挑战")), "error");
            break;

        case "challenge_cancelled":
            showToast("ℹ️ " + msg.from + " 取消了挑战", "info");
            break;

        case "kicked":
            showToast("⚠ " + msg.message, "error");
            // 断开连接
            disconnectFromServer();
            break;

        case "error":
            showToast(msg.message, "error");
            // 在 lobby 阶段显示在对应的消息区
            var multiRoomEl = document.getElementById("multi-room");
            if (multiRoomEl && multiRoomEl.style.display !== "none") {
                var multiRoomMsgEl = document.getElementById("multi-room-msg");
                if (multiRoomMsgEl) {
                    multiRoomMsgEl.textContent = "⚠ " + msg.message;
                    multiRoomMsgEl.className = "multi-msg error";
                }
            }
            var multiLobbyEl = document.getElementById("multi-lobby");
            if (multiLobbyEl && multiLobbyEl.style.display !== "none") {
                var multiJoinMsgEl = document.getElementById("multi-join-msg");
                if (multiJoinMsgEl) {
                    multiJoinMsgEl.textContent = "⚠ " + msg.message;
                    multiJoinMsgEl.className = "multi-msg error";
                }
            }
            break;
    }
}

/** 获取难度可读名称 */
function getDifficultyLabel(diff) {
    if (!diff) return "9×9 · 10雷";
    for (const [key, cfg] of Object.entries(DIFFICULTY)) {
        if (cfg.rows === diff.rows && cfg.cols === diff.cols && cfg.mines === diff.mines) {
            return cfg.label + " (" + cfg.rows + "×" + cfg.cols + " · " + cfg.mines + "雷)";
        }
    }
    return diff.rows + "×" + diff.cols + " · " + diff.mines + "雷";
}


// =========================
// 多人对战 — 事件绑定
// =========================

document.getElementById("multi-connect-btn").addEventListener("click", () => {
    connectToServer(getWsUrl());
});

document.getElementById("multi-create-btn").addEventListener("click", handleCreateRoom);
document.getElementById("multi-join-btn").addEventListener("click", handleJoinRoom);

// 回车加入房间
document.getElementById("multi-room-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleJoinRoom();
});

// 复制房间码
document.getElementById("multi-copy-code").addEventListener("click", () => {
    const code = document.getElementById("multi-room-code-display").textContent;
    if (code && code !== "------") {
        navigator.clipboard.writeText(code).then(() => {
            document.getElementById("multi-copy-ok").style.display = "";
            setTimeout(() => {
                document.getElementById("multi-copy-ok").style.display = "none";
            }, 2000);
        }).catch(() => {
            showToast("复制失败，请手动复制", "error");
        });
    }
});

document.getElementById("multi-leave-btn").addEventListener("click", handleLeaveRoom);
document.getElementById("multi-start-btn").addEventListener("click", handleStartGame);
document.getElementById("multi-play-again").addEventListener("click", handlePlayAgain);

// 多人模式难度选择
document.querySelectorAll("#multi-diff-bar .diff-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        if (!multiIsHost) return;
        const level = btn.dataset.level;
        if (level === multiCurrentDiff) return;

        multiCurrentDiff = level;
        const diff = getMultiDifficulty();
        renderPlayerList();

        sendMessage({
            type: "update_difficulty",
            difficulty: diff,
        });
    });
});


// =========================
// 排行榜 (独立面板)
// =========================

const lbTabs        = document.querySelectorAll(".lb-tab");
const lbList        = document.getElementById("lb-list");
const lbEmpty       = document.getElementById("lb-empty");

let currentLbSort = "winrate";

function openLeaderboard() {
    document.getElementById("leaderboard-overlay").classList.add("open");
    document.getElementById("leaderboard-panel").classList.add("open");
    document.getElementById("leaderboard-toggle").style.opacity = "0";
    document.getElementById("leaderboard-toggle").style.pointerEvents = "none";
    renderLeaderboard();
}

function closeLeaderboard() {
    document.getElementById("leaderboard-overlay").classList.remove("open");
    document.getElementById("leaderboard-panel").classList.remove("open");
    document.getElementById("leaderboard-toggle").style.opacity = "";
    document.getElementById("leaderboard-toggle").style.pointerEvents = "";
}

async function renderLeaderboard() {
    let userList = [];

    // 1. 尝试从服务端拉取排行榜
    try {
        const base = window.location.origin;
        const res = await fetch(base + "/api/leaderboard?by=" + currentLbSort);
        const json = await res.json();
        if (json.ok && json.leaderboard) {
            userList = json.leaderboard.map(u => ({
                username: u.username,
                nickname: u.nickname || u.username,
                avatar: u.avatar || "👤",
                games: u.games,
                wins: u.wins,
                losses: u.losses,
                winrate: u.winRate,
                bestBeginner: u.bestTimes?.beginner ?? null,
                bestIntermediate: u.bestTimes?.intermediate ?? null,
                bestExpert: u.bestTimes?.expert ?? null,
            }));
        }
    } catch (_) { /* 忽略 */ }

    // 2. 服务端不可用 → 降级到 localStorage
    if (userList.length === 0) {
        const users = loadUsers();
        for (const [username, data] of Object.entries(users)) {
            const stats = data.stats;
            const winrate = stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : 0;
            userList.push({
                username,
                nickname: data.nickname || username,
                avatar: data.avatar || "👤",
                games: stats.games,
                wins: stats.wins,
                losses: stats.losses,
                winrate,
                bestBeginner: stats.bestTimes?.beginner ?? null,
                bestIntermediate: stats.bestTimes?.intermediate ?? null,
                bestExpert: stats.bestTimes?.expert ?? null,
            });
        }
    }

    if (userList.length === 0) {
        lbEmpty.style.display = "";
        lbList.style.display = "none";
        return;
    }

    lbEmpty.style.display = "none";
    lbList.style.display = "";

    // 排序
    switch (currentLbSort) {
        case "winrate":
            userList.sort((a, b) => b.winrate - a.winrate || b.wins - a.wins);
            break;
        case "wins":
            userList.sort((a, b) => b.wins - a.wins || b.winrate - a.winrate);
            break;
        case "beginner":
            userList.sort((a, b) => {
                if (a.bestBeginner === null && b.bestBeginner === null) return 0;
                if (a.bestBeginner === null) return 1;
                if (b.bestBeginner === null) return -1;
                return a.bestBeginner - b.bestBeginner;
            });
            break;
        case "intermediate":
            userList.sort((a, b) => {
                if (a.bestIntermediate === null && b.bestIntermediate === null) return 0;
                if (a.bestIntermediate === null) return 1;
                if (b.bestIntermediate === null) return -1;
                return a.bestIntermediate - b.bestIntermediate;
            });
            break;
        case "expert":
            userList.sort((a, b) => {
                if (a.bestExpert === null && b.bestExpert === null) return 0;
                if (a.bestExpert === null) return 1;
                if (b.bestExpert === null) return -1;
                return a.bestExpert - b.bestExpert;
            });
            break;
    }

    // 只显示前20名
    const top20 = userList.slice(0, 20);
    const currentUsername = currentUser ? currentUser.username : null;

    let html = "";
    top20.forEach((u, i) => {
        const isMe = u.username === currentUsername;
        let statText = "";
        switch (currentLbSort) {
            case "winrate":
                statText = u.winrate + "%";
                break;
            case "wins":
                statText = u.wins + " 胜";
                break;
            case "beginner":
                statText = u.bestBeginner !== null ? u.bestBeginner + " 秒" : "-";
                break;
            case "intermediate":
                statText = u.bestIntermediate !== null ? u.bestIntermediate + " 秒" : "-";
                break;
            case "expert":
                statText = u.bestExpert !== null ? u.bestExpert + " 秒" : "-";
                break;
        }

        const displayName = u.nickname && u.nickname !== u.username
            ? escapeHtml(u.nickname) + " @" + escapeHtml(u.username)
            : escapeHtml(u.username);
        html += `<div class="lb-row${isMe ? " me" : ""}">
            <div class="lb-rank">${i + 1}</div>
            <span class="lb-avatar-small">${escapeHtml(u.avatar || "👤")}</span>
            <div class="lb-name">${displayName}${isMe ? " (我)" : ""}</div>
            <div class="lb-stat">${statText}</div>
        </div>`;
    });

    lbList.innerHTML = html;
}

// 排行榜选项卡切换
lbTabs.forEach(tab => {
    tab.addEventListener("click", () => {
        lbTabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        currentLbSort = tab.dataset.lb;
        renderLeaderboard();
    });
});

// 排行榜按钮 & 面板事件
document.getElementById("leaderboard-toggle").addEventListener("click", openLeaderboard);
document.getElementById("leaderboard-close").addEventListener("click", closeLeaderboard);
document.getElementById("leaderboard-overlay").addEventListener("click", closeLeaderboard);
