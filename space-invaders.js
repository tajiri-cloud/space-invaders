// ===== Canvas setup =====
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ===== Game state =====
let gameState = 'start'; // 'start', 'playing', 'paused', 'gameover'
let score = 0;
let lives = 3;
let level = 1;
let highScore = localStorage.getItem('spaceInvadersHighScore') || 0;

// ===== Game objects =====
let player;
let enemies = [];
let playerBullets = [];
let enemyBullets = [];
let barriers = [];
let powerUps = [];
let particles = [];
let ufo = null;
let enemyDirection = 1; // 1 for right, -1 for left
let enemyMoveCounter = 0;

// ===== Input handling =====
const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.key] = true;

    if (e.key === ' ' && gameState === 'playing') {
        e.preventDefault();
        player.shoot();
    }

    if (e.key === 'p' || e.key === 'P') {
        if (gameState === 'playing') {
            gameState = 'paused';
        } else if (gameState === 'paused') {
            gameState = 'playing';
        }
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// ===== Audio Context (simple beep sounds) =====
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(frequency, duration, type = 'square') {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + duration);
}

// ===== Player class =====
class Player {
    constructor() {
        this.width = 40;
        this.height = 30;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = canvas.height - 60;
        this.speed = 5;
        this.shootCooldown = 0;
        this.powerUpType = null;
        this.powerUpTimer = 0;
    }

    update() {
        if (keys['ArrowLeft'] && this.x > 0) {
            this.x -= this.speed;
        }
        if (keys['ArrowRight'] && this.x < canvas.width - this.width) {
            this.x += this.speed;
        }

        if (this.shootCooldown > 0) {
            this.shootCooldown--;
        }

        if (this.powerUpTimer > 0) {
            this.powerUpTimer--;
            if (this.powerUpTimer === 0) {
                this.powerUpType = null;
            }
        }
    }

    draw() {
        ctx.fillStyle = this.powerUpType ? '#ffff00' : '#00ff00';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.fillRect(this.x + 15, this.y - 10, 10, 10);

        if (this.powerUpType) {
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x - 5, this.y - 5, this.width + 10, this.height + 10);
        }
    }

    shoot() {
        if (this.shootCooldown === 0) {
            if (this.powerUpType === 'rapidFire') {
                playerBullets.push(new Bullet(this.x + this.width / 2 - 2, this.y, -7, '#00ff00'));
                this.shootCooldown = 10;
            } else if (this.powerUpType === 'spread') {
                playerBullets.push(new Bullet(this.x + this.width / 2 - 2, this.y, -7, '#00ff00'));
                playerBullets.push(new Bullet(this.x + this.width / 2 - 2, this.y, -7, '#00ff00', -2));
                playerBullets.push(new Bullet(this.x + this.width / 2 - 2, this.y, -7, '#00ff00', 2));
                this.shootCooldown = 30;
            } else {
                playerBullets.push(new Bullet(this.x + this.width / 2 - 2, this.y, -7, '#00ff00'));
                this.shootCooldown = 20;
            }
            playSound(400, 0.1);
        }
    }

    hit() {
        lives--;
        createExplosion(this.x + this.width / 2, this.y + this.height / 2, '#00ff00');
        playSound(100, 0.3);

        if (lives > 0) {
            this.x = canvas.width / 2 - this.width / 2;
            this.powerUpType = null;
            this.powerUpTimer = 0;
        }
    }
}

// ===== Enemy class =====
class Enemy {
    constructor(x, y, type) {
        this.width = 30;
        this.height = 25;
        this.x = x;
        this.y = y;
        this.type = type; // 0, 1, 2 (different enemy types)
        this.moveDown = false;
    }

    draw() {
        const colors = ['#ff0000', '#ff8800', '#ffff00'];
        ctx.fillStyle = colors[this.type];

        if (this.type === 0) {
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.fillRect(this.x + 5, this.y - 5, 5, 5);
            ctx.fillRect(this.x + 20, this.y - 5, 5, 5);
        } else if (this.type === 1) {
            ctx.fillRect(this.x + 5, this.y, this.width - 10, this.height);
            ctx.fillRect(this.x, this.y + 5, this.width, this.height - 10);
        } else {
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    shoot() {
        enemyBullets.push(new Bullet(this.x + this.width / 2 - 2, this.y + this.height, 4, '#ff0000'));
        playSound(200, 0.1);
    }
}

// ===== Bullet class =====
class Bullet {
    constructor(x, y, speedY, color, speedX = 0) {
        this.x = x;
        this.y = y;
        this.width = 4;
        this.height = 10;
        this.speedY = speedY;
        this.speedX = speedX;
        this.color = color;
    }

    update() {
        this.y += this.speedY;
        this.x += this.speedX;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    isOffScreen() {
        return this.y < 0 || this.y > canvas.height || this.x < 0 || this.x > canvas.width;
    }
}

// ===== Barrier class =====
class Barrier {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 80;
        this.height = 60;
        this.blocks = [];

        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 8; col++) {
                if (row >= 4 && (col <= 1 || col >= 6)) continue;
                this.blocks.push({
                    x: this.x + col * 10,
                    y: this.y + row * 10,
                    width: 10,
                    height: 10,
                    active: true
                });
            }
        }
    }

    draw() {
        ctx.fillStyle = '#00ffff';
        this.blocks.forEach(block => {
            if (block.active) {
                ctx.fillRect(block.x, block.y, block.width, block.height);
            }
        });
    }

    checkCollision(bullet) {
        for (let block of this.blocks) {
            if (block.active &&
                bullet.x < block.x + block.width &&
                bullet.x + bullet.width > block.x &&
                bullet.y < block.y + block.height &&
                bullet.y + bullet.height > block.y) {
                block.active = false;
                return true;
            }
        }
        return false;
    }
}

// ===== UFO (Bonus Enemy) class =====
class UFO {
    constructor() {
        this.width = 50;
        this.height = 25;
        this.x = -this.width;
        this.y = 30;
        this.speed = 2;
        this.points = [100, 200, 300][Math.floor(Math.random() * 3)];
    }

    update() {
        this.x += this.speed;
    }

    draw() {
        ctx.fillStyle = '#ff00ff';
        ctx.fillRect(this.x + 10, this.y, 30, 10);
        ctx.fillRect(this.x, this.y + 10, this.width, 15);
    }

    isOffScreen() {
        return this.x > canvas.width;
    }
}

// ===== PowerUp class =====
class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 20;
        this.type = type; // 'rapidFire', 'spread', 'extraLife'
        this.speed = 2;
    }

    update() {
        this.y += this.speed;
    }

    draw() {
        const colors = {
            'rapidFire': '#ffff00',
            'spread': '#ff00ff',
            'extraLife': '#00ffff'
        };

        ctx.fillStyle = colors[this.type];
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.width / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        const labels = {'rapidFire': 'R', 'spread': 'S', 'extraLife': '♥'};
        ctx.fillText(labels[this.type], this.x, this.y + 4);
    }

    isOffScreen() {
        return this.y > canvas.height;
    }
}

// ===== Particle class (for explosions) =====
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4;
        this.life = 30;
        this.color = color;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.life / 30;
        ctx.fillRect(this.x, this.y, 3, 3);
        ctx.globalAlpha = 1;
    }
}

function createExplosion(x, y, color) {
    for (let i = 0; i < 15; i++) {
        particles.push(new Particle(x, y, color));
    }
}

// ===== Game functions =====
function initGame() {
    player = new Player();
    enemies = [];
    playerBullets = [];
    enemyBullets = [];
    barriers = [];
    powerUps = [];
    particles = [];
    ufo = null;
    enemyDirection = 1;
    enemyMoveCounter = 0;

    createEnemies();
    createBarriers();

    updateUI();
}

function createEnemies() {
    enemies = [];
    const rows = 3 + level;
    const cols = 8 + Math.min(level, 3);
    const startX = 50;
    const startY = 50;
    const spacingX = 50;
    const spacingY = 45;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const type = row < 1 ? 2 : row < 3 ? 1 : 0;
            enemies.push(new Enemy(
                startX + col * spacingX,
                startY + row * spacingY,
                type
            ));
        }
    }
}

function createBarriers() {
    barriers = [];
    const numBarriers = 4;
    const spacing = canvas.width / (numBarriers + 1);

    for (let i = 0; i < numBarriers; i++) {
        barriers.push(new Barrier(
            spacing * (i + 1) - 40,
            canvas.height - 150
        ));
    }
}

function moveEnemies() {
    enemyMoveCounter++;
    const moveSpeed = Math.max(30 - level * 3, 10); // Faster movement as level increases

    if (enemyMoveCounter < moveSpeed) {
        return; // Don't move every frame
    }

    enemyMoveCounter = 0;
    let shouldMoveDown = false;

    // Check if any enemy has reached the edge
    for (let enemy of enemies) {
        if ((enemy.x <= 10 && enemyDirection < 0) ||
            (enemy.x >= canvas.width - enemy.width - 10 && enemyDirection > 0)) {
            shouldMoveDown = true;
            break;
        }
    }

    enemies.forEach(enemy => {
        if (shouldMoveDown) {
            enemy.y += 15 + level * 2; // Move down more each level
        } else {
            enemy.x += enemyDirection * (8 + level * 1.5); // Faster horizontal movement
        }

        // Enemies shoot more frequently
        if (Math.random() < 0.003 * (1 + level * 0.3)) {
            enemy.shoot();
        }
    });

    if (shouldMoveDown) {
        enemyDirection *= -1; // Change direction after moving down
    }
}

function checkCollisions() {
    playerBullets.forEach((bullet, bulletIndex) => {
        enemies.forEach((enemy, enemyIndex) => {
            if (bullet.x < enemy.x + enemy.width &&
                bullet.x + bullet.width > enemy.x &&
                bullet.y < enemy.y + enemy.height &&
                bullet.y + bullet.height > enemy.y) {

                enemies.splice(enemyIndex, 1);
                playerBullets.splice(bulletIndex, 1);

                score += (enemy.type + 1) * 10 * level;
                createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#ff8800');
                playSound(300, 0.2);

                if (Math.random() < 0.1) {
                    const types = ['rapidFire', 'spread', 'extraLife'];
                    powerUps.push(new PowerUp(
                        enemy.x + enemy.width / 2,
                        enemy.y + enemy.height,
                        types[Math.floor(Math.random() * types.length)]
                    ));
                }

                updateUI();
            }
        });

        barriers.forEach(barrier => {
            if (barrier.checkCollision(bullet)) {
                playerBullets.splice(bulletIndex, 1);
            }
        });

        if (ufo &&
            bullet.x < ufo.x + ufo.width &&
            bullet.x + bullet.width > ufo.x &&
            bullet.y < ufo.y + ufo.height &&
            bullet.y + bullet.height > ufo.y) {

            score += ufo.points;
            createExplosion(ufo.x + ufo.width / 2, ufo.y + ufo.height / 2, '#ff00ff');
            playSound(500, 0.3, 'sine');
            playerBullets.splice(bulletIndex, 1);
            ufo = null;
            updateUI();
        }
    });

    enemyBullets.forEach((bullet, bulletIndex) => {
        if (bullet.x < player.x + player.width &&
            bullet.x + bullet.width > player.x &&
            bullet.y < player.y + player.height &&
            bullet.y + bullet.height > player.y) {

            player.hit();
            enemyBullets.splice(bulletIndex, 1);
            updateUI();

            if (lives === 0) {
                gameOver();
            }
        }

        barriers.forEach(barrier => {
            if (barrier.checkCollision(bullet)) {
                enemyBullets.splice(bulletIndex, 1);
            }
        });
    });

    powerUps.forEach((powerUp, index) => {
        if (powerUp.x - powerUp.width / 2 < player.x + player.width &&
            powerUp.x + powerUp.width / 2 > player.x &&
            powerUp.y - powerUp.height / 2 < player.y + player.height &&
            powerUp.y + powerUp.height / 2 > player.y) {

            if (powerUp.type === 'extraLife') {
                lives++;
            } else {
                player.powerUpType = powerUp.type;
                player.powerUpTimer = 600;
            }

            playSound(600, 0.2, 'sine');
            powerUps.splice(index, 1);
            updateUI();
        }
    });

    enemies.forEach(enemy => {
        if (enemy.y + enemy.height >= player.y) {
            gameOver();
        }
    });
}

function spawnUFO() {
    if (!ufo && Math.random() < 0.002) {
        ufo = new UFO();
        playSound(800, 0.1, 'sawtooth');
    }
}

function levelUp() {
    level++;
    createEnemies();
    createBarriers();
    player.x = canvas.width / 2 - player.width / 2;
    playerBullets = [];
    enemyBullets = [];
    playSound(700, 0.5, 'sine');
    updateUI();
}

function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('lives').textContent = lives;
    document.getElementById('level').textContent = level;
    document.getElementById('highScore').textContent = highScore;
}

function drawHUD() {
    ctx.fillStyle = '#00ff00';
    ctx.font = 'bold 20px Courier New';
    ctx.textAlign = 'left';

    // Score display
    ctx.fillText(`スコア: ${score}`, 10, 25);

    // Lives display with hearts
    ctx.fillText(`ライフ: `, 250, 25);
    for (let i = 0; i < lives; i++) {
        ctx.fillText('♥', 330 + i * 25, 25);
    }

    // Level display
    ctx.fillText(`レベル: ${level}`, 500, 25);

    // High score display
    ctx.fillText(`ハイスコア: ${highScore}`, 650, 25);

    // Power-up indicator
    if (player && player.powerUpType) {
        ctx.fillStyle = '#ffff00';
        const powerUpNames = {
            'rapidFire': '連射',
            'spread': '拡散',
            'extraLife': 'ライフ'
        };
        const timeLeft = Math.ceil(player.powerUpTimer / 60);
        ctx.fillText(`パワーアップ: ${powerUpNames[player.powerUpType]} (${timeLeft}秒)`, 10, 580);
    }
}

function gameOver() {
    gameState = 'gameover';

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('spaceInvadersHighScore', highScore);
    }

    document.getElementById('finalScore').textContent = `スコア: ${score}`;
    document.getElementById('highScoreDisplay').textContent = `ハイスコア: ${highScore}`;
    document.getElementById('gameOverTitle').textContent = 'GAME OVER';
    document.getElementById('gameOverScreen').classList.remove('hidden');
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'playing') {
        player.update();
        player.draw();

        moveEnemies();
        enemies.forEach(enemy => enemy.draw());

        playerBullets.forEach((bullet, index) => {
            bullet.update();
            bullet.draw();
            if (bullet.isOffScreen()) {
                playerBullets.splice(index, 1);
            }
        });

        enemyBullets.forEach((bullet, index) => {
            bullet.update();
            bullet.draw();
            if (bullet.isOffScreen()) {
                enemyBullets.splice(index, 1);
            }
        });

        barriers.forEach(barrier => barrier.draw());

        powerUps.forEach((powerUp, index) => {
            powerUp.update();
            powerUp.draw();
            if (powerUp.isOffScreen()) {
                powerUps.splice(index, 1);
            }
        });

        particles.forEach((particle, index) => {
            particle.update();
            particle.draw();
            if (particle.life <= 0) {
                particles.splice(index, 1);
            }
        });

        if (ufo) {
            ufo.update();
            ufo.draw();
            if (ufo.isOffScreen()) {
                ufo = null;
            }
        }

        spawnUFO();
        checkCollisions();

        if (enemies.length === 0) {
            levelUp();
        }

        // Draw HUD on top of everything
        drawHUD();
    } else if (gameState === 'paused') {
        player.draw();
        enemies.forEach(enemy => enemy.draw());
        playerBullets.forEach(bullet => bullet.draw());
        enemyBullets.forEach(bullet => bullet.draw());
        barriers.forEach(barrier => barrier.draw());

        // Draw HUD before pause overlay
        drawHUD();

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#00ff00';
        ctx.font = '48px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('一時停止', canvas.width / 2, canvas.height / 2);
    }

    requestAnimationFrame(gameLoop);
}

function startGame() {
    document.getElementById('startScreen').classList.add('hidden');
    score = 0;
    lives = 3;
    level = 1;
    gameState = 'playing';
    initGame();
}

function restartGame() {
    document.getElementById('gameOverScreen').classList.add('hidden');
    score = 0;
    lives = 3;
    level = 1;
    gameState = 'playing';
    initGame();
}

highScore = parseInt(highScore) || 0;
updateUI();
gameLoop();
