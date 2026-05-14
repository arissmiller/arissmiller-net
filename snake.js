const canvas = document.getElementById("snakeCanvas");
const ctx = canvas.getContext("2d");

const gridHeight = 24;
const gridWidth = 24;
const squareSize = canvas.height / gridHeight;
let speedCellsPerSecond = 11;
let tickMs = 1000 / speedCellsPerSecond;
const startingLength = 2;
const difficultySpeeds = {
  easy: 6,
  medium: 11,
  hard: 17,
};

let snakeColor = "#df0101";
let foodColor = "#facc15";
let backgroundColor = "#1c1c1c";

let snake = [];
let previousSnake = [];
let size = startingLength;
let food = [];
let direction = "Right";
let nextDirection = "Right";
let gameRunning = false;
let lastTickTime = 0;

const scoreEl = document.getElementById("score");
const highScoreEl = document.getElementById("highScore");
const restartButton = document.getElementById("restartButton");
const themeInputs = {
  snake: document.getElementById("snakeColorPicker"),
  food: document.getElementById("foodColorPicker"),
  background: document.getElementById("backgroundColorPicker"),
};
const difficultyButtons = Array.from(document.querySelectorAll(".snake-difficulty-button"));
const highScoreStoragePrefix = "snake_high_score_";

let highScores = {
  easy: Number(localStorage.getItem(highScoreStoragePrefix + "easy") || "0"),
  medium: Number(localStorage.getItem(highScoreStoragePrefix + "medium") || "0"),
  hard: Number(localStorage.getItem(highScoreStoragePrefix + "hard") || "0"),
};
let selectedDifficulty = "medium";

const oppositeDirection = {
  Up: "Down",
  Down: "Up",
  Left: "Right",
  Right: "Left",
};

document.addEventListener("keydown", keyDownHandler, false);
if (restartButton) {
  restartButton.addEventListener("click", startGame);
}

initThemeEditor();
startGame();
requestAnimationFrame(gameLoop);

function cloneSnake(sourceSnake) {
  return sourceSnake.map(function (segment) {
    return [segment[0], segment[1]];
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hexToRgb(hexColor) {
  if (typeof hexColor !== "string") {
    return null;
  }

  let normalized = hexColor.trim().replace("#", "");
  if (normalized.length == 3) {
    normalized = normalized
      .split("")
      .map(function (part) {
        return part + part;
      })
      .join("");
  }

  if (normalized.length !== 6) {
    return null;
  }

  const asNumber = Number.parseInt(normalized, 16);
  if (Number.isNaN(asNumber)) {
    return null;
  }

  return {
    r: (asNumber >> 16) & 255,
    g: (asNumber >> 8) & 255,
    b: asNumber & 255,
  };
}

function srgbToLinear(channel) {
  const normalized = channel / 255;
  if (normalized <= 0.04045) {
    return normalized / 12.92;
  }
  return Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function relativeLuminance(rgb) {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function mixChannel(channel, target, amount) {
  return Math.round(channel + (target - channel) * amount);
}

function setSpeedFromDifficulty(difficulty) {
  speedCellsPerSecond = difficultySpeeds[difficulty] || difficultySpeeds.medium;
  tickMs = 1000 / speedCellsPerSecond;
}

function normalizedDifficultyLabel(difficulty) {
  if (difficulty == "easy") {
    return "Easy";
  }
  if (difficulty == "hard") {
    return "Hard";
  }
  return "Medium";
}

function getHighScoreForDifficulty(difficulty) {
  return Number.isFinite(highScores[difficulty]) ? highScores[difficulty] : 0;
}

function setHighScoreForDifficulty(difficulty, score) {
  highScores[difficulty] = score;
  localStorage.setItem(highScoreStoragePrefix + difficulty, String(score));
}

function updateDifficultyButtons() {
  difficultyButtons.forEach(function (button) {
    const isActive = button.dataset.difficulty == selectedDifficulty;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function setDifficulty(difficulty) {
  if (!difficultySpeeds[difficulty]) {
    return;
  }
  selectedDifficulty = difficulty;
  setSpeedFromDifficulty(selectedDifficulty);
  updateDifficultyButtons();
  updateStats();
}

function setDifficultyLocked(locked) {
  difficultyButtons.forEach(function (button) {
    button.disabled = locked;
  });
}

function getGridLineStyles(bgHexColor) {
  const bgRgb = hexToRgb(bgHexColor);
  if (!bgRgb) {
    return {
      minor: "rgba(195, 240, 255, 0.42)",
      major: "rgba(230, 248, 255, 0.62)",
    };
  }

  const luminance = relativeLuminance(bgRgb);
  const target = luminance < 0.5 ? 255 : 0;
  const minorMix = luminance < 0.5 ? 0.74 : 0.7;
  const majorMix = luminance < 0.5 ? 0.9 : 0.86;

  const minorRgb = {
    r: mixChannel(bgRgb.r, target, minorMix),
    g: mixChannel(bgRgb.g, target, minorMix),
    b: mixChannel(bgRgb.b, target, minorMix),
  };
  const majorRgb = {
    r: mixChannel(bgRgb.r, target, majorMix),
    g: mixChannel(bgRgb.g, target, majorMix),
    b: mixChannel(bgRgb.b, target, majorMix),
  };

  const contrastBoost = Math.abs(luminance - 0.5);
  const minorAlpha = clamp(0.34 + contrastBoost * 0.2, 0.3, 0.56);
  const majorAlpha = clamp(0.5 + contrastBoost * 0.26, 0.44, 0.78);

  return {
    minor: "rgba(" + minorRgb.r + ", " + minorRgb.g + ", " + minorRgb.b + ", " + minorAlpha.toFixed(3) + ")",
    major: "rgba(" + majorRgb.r + ", " + majorRgb.g + ", " + majorRgb.b + ", " + majorAlpha.toFixed(3) + ")",
  };
}

function initThemeEditor() {
  if (themeInputs.snake) {
    themeInputs.snake.value = snakeColor;
    themeInputs.snake.addEventListener("input", function (e) {
      snakeColor = e.target.value;
    });
  }

  if (themeInputs.food) {
    themeInputs.food.value = foodColor;
    themeInputs.food.addEventListener("input", function (e) {
      foodColor = e.target.value;
    });
  }

  if (themeInputs.background) {
    themeInputs.background.value = backgroundColor;
    themeInputs.background.addEventListener("input", function (e) {
      backgroundColor = e.target.value;
    });
  }

  difficultyButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      if (gameRunning) {
        return;
      }
      setDifficulty(button.dataset.difficulty);
    });
  });

  setDifficulty(selectedDifficulty);
}

function keyDownHandler(e) {
  if (e.key == "Enter" && !gameRunning) {
    startGame();
    return;
  }
  if (e.key == "Right" || e.key == "ArrowRight" || e.key == "d" || e.key == "D") {
    nextDirection = "Right";
  }
  if (e.key == "Left" || e.key == "ArrowLeft" || e.key == "a" || e.key == "A") {
    nextDirection = "Left";
  }
  if (e.key == "Up" || e.key == "ArrowUp" || e.key == "w" || e.key == "W") {
    nextDirection = "Up";
  }
  if (e.key == "Down" || e.key == "ArrowDown" || e.key == "s" || e.key == "S") {
    nextDirection = "Down";
  }
}

function scoreValue() {
  return snake.length - startingLength;
}

function updateStats() {
  if (scoreEl) {
    scoreEl.textContent = "Score: " + scoreValue();
  }
  if (highScoreEl) {
    highScoreEl.textContent =
      "High score (" +
      normalizedDifficultyLabel(selectedDifficulty) +
      "): " +
      getHighScoreForDifficulty(selectedDifficulty);
  }
}

function placeFood() {
  let foodX = 0;
  let foodY = 0;
  let hasConflict = true;

  while (hasConflict) {
    foodX = Math.floor(Math.random() * gridWidth);
    foodY = Math.floor(Math.random() * gridHeight);
    hasConflict = snake.some(function (segment) {
      return segment[0] == foodX && segment[1] == foodY;
    });
  }

  food[0] = foodX;
  food[1] = foodY;
}

function startGame() {
  setSpeedFromDifficulty(selectedDifficulty);
  snake = [
    [2, 1],
    [1, 1],
  ];
  previousSnake = cloneSnake(snake);
  size = startingLength;
  direction = "Right";
  nextDirection = "Right";
  gameRunning = true;
  lastTickTime = performance.now();
  setDifficultyLocked(true);
  placeFood();
  updateStats();
}

function canTurnTo(proposedDirection) {
  return snake.length <= 1 || oppositeDirection[direction] !== proposedDirection;
}

function getNextHead() {
  if (direction == "Up") {
    return [snake[0][0], snake[0][1] - 1];
  }
  if (direction == "Down") {
    return [snake[0][0], snake[0][1] + 1];
  }
  if (direction == "Left") {
    return [snake[0][0] - 1, snake[0][1]];
  }
  return [snake[0][0] + 1, snake[0][1]];
}

function hitsWall(head) {
  return head[0] >= gridWidth || head[0] < 0 || head[1] >= gridHeight || head[1] < 0;
}

function hitsBody(head, ignoreTail) {
  const checkLength = ignoreTail ? snake.length - 1 : snake.length;
  for (let i = 0; i < checkLength; i++) {
    if (head[0] == snake[i][0] && head[1] == snake[i][1]) {
      return true;
    }
  }
  return false;
}

function gameOver() {
  gameRunning = false;
  setDifficultyLocked(false);
  if (scoreValue() > getHighScoreForDifficulty(selectedDifficulty)) {
    setHighScoreForDifficulty(selectedDifficulty, scoreValue());
  }
  updateStats();
}

function moveSnake() {
  if (canTurnTo(nextDirection)) {
    direction = nextDirection;
  }

  const head = getNextHead();
  const ateFood = food[0] == head[0] && food[1] == head[1];

  // Moving into the current tail cell is valid if we are not growing this tick.
  if (hitsWall(head) || hitsBody(head, !ateFood)) {
    gameOver();
    return;
  }

  snake.unshift(head);

  if (ateFood) {
    placeFood();
  } else {
    snake.pop();
  }

  size = snake.length;
  updateStats();
}

function checkForVictory() {
  if (snake.length == gridHeight * gridWidth) {
    gameOver();
  }
}

function stepGame() {
  previousSnake = cloneSnake(snake);
  moveSnake();
  if (gameRunning) {
    checkForVictory();
  }
}

function drawTronGrid() {
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const gridStyles = getGridLineStyles(backgroundColor);

  // Static board-aligned grid so the background represents the playable cells.
  ctx.strokeStyle = gridStyles.minor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= canvas.width; x += squareSize) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
  }
  for (let y = 0; y <= canvas.height; y += squareSize) {
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
  }
  ctx.stroke();

  const majorStep = squareSize * 4;
  ctx.strokeStyle = gridStyles.major;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  for (let x = 0; x <= canvas.width; x += majorStep) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
  }
  for (let y = 0; y <= canvas.height; y += majorStep) {
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
  }
  ctx.stroke();
}

function roundedRectPath(x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawSnake(alpha) {
  const radius = squareSize * 0.22;
  for (let i = 0; i < snake.length; i++) {
    const current = snake[i];
    const previous = previousSnake[i] || previousSnake[previousSnake.length - 1] || current;
    const interpolatedX = (previous[0] + (current[0] - previous[0]) * alpha) * squareSize;
    const interpolatedY = (previous[1] + (current[1] - previous[1]) * alpha) * squareSize;

    roundedRectPath(interpolatedX, interpolatedY, squareSize, squareSize, radius);
    ctx.fillStyle = snakeColor;
    ctx.shadowBlur = 8;
    ctx.shadowColor = snakeColor;
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

function getSnakeEyeColor() {
  const snakeRgb = hexToRgb(snakeColor);
  if (!snakeRgb) {
    return "rgba(10, 16, 28, 0.95)";
  }
  const snakeLuminance = relativeLuminance(snakeRgb);
  const lightFaceLuminance = relativeLuminance({ r: 245, g: 250, b: 255 });
  const darkFaceLuminance = relativeLuminance({ r: 10, g: 16, b: 28 });
  const lightContrast =
    (Math.max(snakeLuminance, lightFaceLuminance) + 0.05) /
    (Math.min(snakeLuminance, lightFaceLuminance) + 0.05);
  const darkContrast =
    (Math.max(snakeLuminance, darkFaceLuminance) + 0.05) /
    (Math.min(snakeLuminance, darkFaceLuminance) + 0.05);

  return lightContrast >= darkContrast ? "rgba(245, 250, 255, 0.98)" : "rgba(10, 16, 28, 0.98)";
}

function getInterpolatedHead(alpha) {
  const currentHead = snake[0];
  const previousHead = previousSnake[0] || currentHead;
  return {
    x: (previousHead[0] + (currentHead[0] - previousHead[0]) * alpha) * squareSize,
    y: (previousHead[1] + (currentHead[1] - previousHead[1]) * alpha) * squareSize,
  };
}

function getDirectionVector() {
  if (direction == "Left") {
    return { x: -1, y: 0 };
  }
  if (direction == "Up") {
    return { x: 0, y: -1 };
  }
  if (direction == "Down") {
    return { x: 0, y: 1 };
  }
  return { x: 1, y: 0 };
}

function getDirectionAngle() {
  if (direction == "Left") {
    return Math.PI;
  }
  if (direction == "Up") {
    return -Math.PI / 2;
  }
  if (direction == "Down") {
    return Math.PI / 2;
  }
  return 0;
}

function drawSnakeFace(alpha) {
  if (!snake.length) {
    return;
  }

  const head = getInterpolatedHead(alpha);
  const eyeColor = getSnakeEyeColor();
  const s = squareSize;
  const eyeRadius = Math.max(1, s * 0.095);
  const eyeX = -s * 0.08;
  const eyeOffsetY = s * 0.18;

  ctx.save();
  ctx.translate(head.x + s / 2, head.y + s / 2);
  ctx.rotate(getDirectionAngle());

  // Eyes are shifted slightly backward to leave room for a smile near the front.
  ctx.fillStyle = eyeColor;
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(eyeX, -eyeOffsetY, eyeRadius, 0, 2 * Math.PI);
  ctx.fill();
  ctx.closePath();

  ctx.beginPath();
  ctx.arc(eyeX, eyeOffsetY, eyeRadius, 0, 2 * Math.PI);
  ctx.fill();
  ctx.closePath();

  // Right-facing half-ellipse smile, rotated with the head direction.
  ctx.strokeStyle = eyeColor;
  ctx.lineWidth = Math.max(1.2, s * 0.07);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.ellipse(s * 0.17, 0, s * 0.15, s * 0.12, 0, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.closePath();

  ctx.restore();
}

function getTongueFlickProgress(now) {
  // Brief flick every ~2.7s, represented as a triangular pulse (0..1..0).
  const cycleMs = 2700;
  const activeMs = 170;
  const phase = now % cycleMs;
  if (phase > activeMs) {
    return 0;
  }
  const half = activeMs / 2;
  if (phase <= half) {
    return phase / half;
  }
  return (activeMs - phase) / half;
}

function drawSnakeTongue(now, alpha) {
  if (!gameRunning || !snake.length) {
    return;
  }

  const flick = getTongueFlickProgress(now);
  if (flick <= 0) {
    return;
  }

  const head = getInterpolatedHead(alpha);
  const dir = getDirectionVector();
  const perp = { x: -dir.y, y: dir.x };

  const centerX = head.x + squareSize / 2;
  const centerY = head.y + squareSize / 2;
  const mouthX = centerX + dir.x * squareSize * 0.34;
  const mouthY = centerY + dir.y * squareSize * 0.34;
  const tongueLength = squareSize * (0.1 + 0.42 * flick);
  const tipX = mouthX + dir.x * tongueLength;
  const tipY = mouthY + dir.y * tongueLength;
  const forkSize = squareSize * (0.05 + 0.08 * flick);

  ctx.strokeStyle = "rgba(255, 165, 170, 0.92)";
  ctx.lineWidth = Math.max(1.1, squareSize * 0.06);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.moveTo(mouthX, mouthY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX + perp.x * forkSize, tipY + perp.y * forkSize);
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - perp.x * forkSize, tipY - perp.y * forkSize);
  ctx.stroke();
}

function drawFood() {
  ctx.beginPath();
  ctx.arc(
    food[0] * squareSize + squareSize / 2,
    food[1] * squareSize + squareSize / 2,
    squareSize * 0.48,
    0,
    2 * Math.PI,
  );
  ctx.fillStyle = foodColor;
  ctx.shadowBlur = 14;
  ctx.shadowColor = foodColor;
  ctx.fill();
  ctx.closePath();
  ctx.shadowBlur = 0;
}

function drawGameOverOverlay() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#f8fafc";
  ctx.textAlign = "center";
  ctx.font = "28px 'Press Start 2P'";
  ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 28);
  ctx.font = "12px 'Press Start 2P'";
  ctx.fillText("PRESS ENTER TO RESTART", canvas.width / 2, canvas.height / 2 + 18);
}

function render(now, alpha) {
  drawTronGrid();
  drawSnake(alpha);
  drawSnakeFace(alpha);
  drawSnakeTongue(now, alpha);
  drawFood();

  if (!gameRunning) {
    drawGameOverOverlay();
  }
}

function gameLoop(now) {
  if (!lastTickTime) {
    lastTickTime = now;
  }

  if (gameRunning) {
    while (now - lastTickTime >= tickMs) {
      stepGame();
      lastTickTime += tickMs;
      if (!gameRunning) {
        break;
      }
    }
  }

  const alpha = gameRunning ? Math.min((now - lastTickTime) / tickMs, 1) : 1;
  render(now, alpha);

  requestAnimationFrame(gameLoop);
}
