(() => {
  "use strict";

  const SIZES = [5, 6, 7, 8];
  const DIFFICULTY = { 5: "标准", 6: "进阶", 7: "挑战", 8: "极限" };
  const BEST_KEY = "schulte-table.best.v1";
  const SIZE_KEY = "schulte-table.size.v1";

  const board = document.getElementById("board");
  const overlay = document.getElementById("overlay");
  const idlePanel = document.getElementById("idlePanel");
  const pausedPanel = document.getElementById("pausedPanel");
  const donePanel = document.getElementById("donePanel");
  const timerEl = document.getElementById("timer");
  const errorsEl = document.getElementById("errors");
  const progressEl = document.getElementById("progress");
  const progressBar = document.getElementById("progressBar");
  const nextEl = document.getElementById("nextNumber");
  const nextLabelEl = document.getElementById("nextLabel");
  const setupNote = document.getElementById("setupNote");
  const idleSize = document.getElementById("idleSize");
  const bestTimeEl = document.getElementById("bestTime");
  const primaryBtn = document.getElementById("primaryBtn");
  const resetBtn = document.getElementById("resetBtn");
  const resultTimeEl = document.getElementById("resultTime");
  const resultErrorsEl = document.getElementById("resultErrors");
  const recordBadge = document.getElementById("recordBadge");
  const resultNote = document.getElementById("resultNote");
  const live = document.getElementById("live");
  const sizeButtons = Array.from(document.querySelectorAll(".size-btn"));

  const state = {
    size: 5,
    numbers: [],
    next: 1,
    errors: 0,
    phase: "idle", // idle | running | paused | finished
    startedAt: 0,
    elapsedBase: 0,
    rafId: 0,
    lastTimerText: "",
    completed: new Set(),
    activeCell: null,
  };

  let bestData = loadBests();

  /* ---------- Storage ---------- */

  function loadBests() {
    try {
      const parsed = JSON.parse(localStorage.getItem(BEST_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveBests() {
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify(bestData));
    } catch {
      /* Storage can be unavailable in private mode. */
    }
  }

  function loadSavedSize() {
    try {
      const saved = Number(localStorage.getItem(SIZE_KEY));
      return SIZES.includes(saved) ? saved : 5;
    } catch {
      return 5;
    }
  }

  function saveSize(size) {
    try {
      localStorage.setItem(SIZE_KEY, String(size));
    } catch {
      /* Ignore storage failures. */
    }
  }

  function getBestRecord(size) {
    const record = bestData[String(size)];
    return record && Number.isFinite(record.time) && record.time >= 0 ? record : null;
  }

  /* ---------- Helpers ---------- */

  function shuffledNumbers(total) {
    const values = Array.from({ length: total }, (_, index) => index + 1);
    for (let i = values.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    return values;
  }

  function formatTime(milliseconds) {
    const totalCentiseconds = Math.max(0, Math.floor(milliseconds / 10));
    const centiseconds = totalCentiseconds % 100;
    const totalSeconds = Math.floor(totalCentiseconds / 100);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60);

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
      2,
      "0"
    )}.${String(centiseconds).padStart(2, "0")}`;
  }

  function getElapsed() {
    if (state.phase === "running") {
      return state.elapsedBase + (performance.now() - state.startedAt);
    }
    return state.elapsedBase;
  }

  function setTimer(milliseconds) {
    const text = formatTime(milliseconds);
    if (text !== state.lastTimerText) {
      timerEl.textContent = text;
      state.lastTimerText = text;
    }
  }

  function announce(message) {
    live.textContent = "";
    window.setTimeout(() => {
      live.textContent = message;
    }, 40);
  }

  function totalCells() {
    return state.size * state.size;
  }

  function clearActiveCell() {
    if (!state.activeCell) return;

    state.activeCell.classList.remove("is-correct", "is-wrong");
    state.activeCell.setAttribute(
      "aria-label",
      `数字 ${state.activeCell.dataset.number}`
    );
    state.activeCell = null;
  }

  function markActiveCell(cell, feedbackClass) {
    clearActiveCell();

    void cell.offsetWidth;
    cell.classList.add(feedbackClass);
    cell.setAttribute(
      "aria-label",
      `数字 ${cell.dataset.number}，${
        feedbackClass === "is-correct" ? "正确" : "错误"
      }`
    );
    state.activeCell = cell;
  }

  /* ---------- Rendering ---------- */

  function renderBoard() {
    board.style.setProperty("--n", String(state.size));
    board.setAttribute("aria-label", `${state.size} × ${state.size} 舒尔特方格`);

    const fragment = document.createDocumentFragment();
    state.numbers.forEach((number) => {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.dataset.number = String(number);
      cell.textContent = String(number);
      cell.setAttribute("aria-label", `数字 ${number}`);
      fragment.appendChild(cell);
    });

    board.replaceChildren(fragment);
  }

  function updateHud() {
    const total = totalCells();
    const completed = Math.min(Math.max(state.next - 1, 0), total);

    errorsEl.textContent = String(state.errors);
    progressEl.textContent = `${completed} / ${total}`;
    progressBar.style.width = `${(completed / total) * 100}%`;
    nextEl.textContent = completed === total ? "✓" : String(state.next);
    nextLabelEl.textContent = completed === total ? "完成" : "下一个";
    idleSize.textContent = `${state.size} × ${state.size} · ${DIFFICULTY[state.size]}`;
    setupNote.textContent = `共 ${total} 格`;
  }

  function renderBest() {
    const record = getBestRecord(state.size);
    bestTimeEl.textContent = record ? formatTime(record.time) : "—";
  }

  function syncSizeButtons() {
    sizeButtons.forEach((button) => {
      const isActive = Number(button.dataset.size) === state.size;
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function syncControls() {
    const labels = {
      idle: "开始训练",
      running: "暂停",
      paused: "继续",
      finished: "再来一局",
    };
    primaryBtn.textContent = labels[state.phase];
    resetBtn.disabled = state.phase === "idle";
  }

  function setPhase(phase) {
    state.phase = phase;
    const locked = phase !== "running";

    board.classList.toggle("is-obscured", locked);
    board.toggleAttribute("inert", locked);
    board.setAttribute("aria-hidden", String(locked));

    overlay.classList.toggle("is-visible", locked);
    overlay.setAttribute("aria-hidden", String(!locked));

    idlePanel.hidden = phase !== "idle";
    pausedPanel.hidden = phase !== "paused";
    donePanel.hidden = phase !== "finished";
  }

  function focusPrimary() {
    primaryBtn.focus({ preventScroll: true });
  }

  /* ---------- Clock ---------- */

  function tick() {
    if (state.phase !== "running") return;
    setTimer(getElapsed());
    state.rafId = window.requestAnimationFrame(tick);
  }

  function startClock() {
    state.startedAt = performance.now();
    window.cancelAnimationFrame(state.rafId);
    state.rafId = window.requestAnimationFrame(tick);
  }

  function stopClock() {
    window.cancelAnimationFrame(state.rafId);
    state.rafId = 0;
  }

  /* ---------- Game flow ---------- */

  function startRun() {
    const total = totalCells();

    stopClock();
    state.numbers = shuffledNumbers(total);
    state.next = 1;
    state.errors = 0;
    state.elapsedBase = 0;
    state.startedAt = 0;
    state.lastTimerText = "";
    state.completed.clear();
    state.activeCell = null;

    renderBoard();
    setTimer(0);
    updateHud();
    setPhase("running");
    syncControls();
    startClock();
    announce("训练开始，请找到数字 1");
  }

  function pauseRun() {
    if (state.phase !== "running") return;

    state.elapsedBase = getElapsed();
    stopClock();
    setPhase("paused");
    syncControls();
    setTimer(state.elapsedBase);
    focusPrimary();
    announce(`已暂停，当前用时 ${formatTime(state.elapsedBase)}`);
  }

  function resumeRun() {
    if (state.phase !== "paused") return;

    setPhase("running");
    syncControls();
    startClock();
    announce(`继续训练，请找到数字 ${state.next}`);
  }

  function finishRun() {
    const finalTime = getElapsed();
    const previousBest = getBestRecord(state.size);
    const isRecord =
      !previousBest || finalTime < previousBest.time;

    state.elapsedBase = finalTime;
    stopClock();

    if (isRecord) {
      bestData[String(state.size)] = {
        time: finalTime,
        errors: state.errors,
        date: Date.now(),
      };
      saveBests();
    }

    renderBest();
    resultTimeEl.textContent = formatTime(finalTime);
    resultErrorsEl.textContent = `${state.errors} 次错误`;
    recordBadge.hidden = !isRecord;
    recordBadge.textContent = previousBest ? "新纪录" : "首个记录";
    resultNote.textContent = isRecord
      ? `已保存为 ${state.size} × ${state.size} 最佳成绩`
      : `本尺寸最佳 ${formatTime(previousBest.time)}`;

    setPhase("finished");
    syncControls();
    setTimer(finalTime);
    updateHud();

    if (isRecord) {
      bestTimeEl.classList.remove("is-flash");
      void bestTimeEl.offsetWidth;
      bestTimeEl.classList.add("is-flash");
    }

    focusPrimary();
    announce(
      `训练完成，用时 ${formatTime(finalTime)}，错误 ${state.errors} 次。${
        isRecord ? "刷新了最佳成绩。" : ""
      }`
    );
  }

  function resetRound() {
    stopClock();
    state.next = 1;
    state.errors = 0;
    state.elapsedBase = 0;
    state.startedAt = 0;
    state.lastTimerText = "";
    state.completed.clear();
    state.activeCell = null;
    state.numbers = shuffledNumbers(totalCells());

    renderBoard();
    setTimer(0);
    updateHud();
    renderBest();
    setPhase("idle");
    syncControls();
    bestTimeEl.classList.remove("is-flash");
    announce("已重置，点击开始训练");
  }

  function changeSize(size) {
    if (!SIZES.includes(size) || size === state.size) return;

    state.size = size;
    saveSize(size);
    syncSizeButtons();
    resetRound();
  }

  function registerError(cell) {
    state.errors += 1;
    errorsEl.textContent = String(state.errors);

    errorsEl.classList.remove("is-bump");
    void errorsEl.offsetWidth;
    errorsEl.classList.add("is-bump");

    markActiveCell(cell, "is-wrong");
    announce(`错误，请继续寻找数字 ${state.next}`);
  }

  function handleBoardClick(event) {
    const cell = event.target.closest(".cell");
    if (!cell || !board.contains(cell) || state.phase !== "running") return;

    const value = Number(cell.dataset.number);
    if (state.completed.has(value)) return;

    if (value !== state.next) {
      registerError(cell);
      return;
    }

    state.completed.add(value);
    markActiveCell(cell, "is-correct");
    state.next += 1;
    updateHud();

    if (state.next > totalCells()) {
      finishRun();
    } else {
      announce(`正确，下一个数字是 ${state.next}`);
    }
  }

  /* ---------- Events ---------- */

  primaryBtn.addEventListener("click", () => {
    if (state.phase === "idle" || state.phase === "finished") {
      startRun();
    } else if (state.phase === "running") {
      pauseRun();
    } else if (state.phase === "paused") {
      resumeRun();
    }
  });

  resetBtn.addEventListener("click", resetRound);
  board.addEventListener("click", handleBoardClick);

  sizeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      changeSize(Number(button.dataset.size));
    });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.phase === "running") {
      pauseRun();
    }
  });

  /* ---------- Init ---------- */

  state.size = loadSavedSize();
  state.numbers = shuffledNumbers(totalCells());

  syncSizeButtons();
  renderBoard();
  renderBest();
  updateHud();
  setPhase("idle");
  syncControls();
})();
