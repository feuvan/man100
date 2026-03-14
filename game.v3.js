/* ============================================
   是男人就下100层 — 游戏引擎
   ============================================ */

(function () {
    'use strict';

    // ---- Canvas Setup ----
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    const W = 400;
    const H = 600;
    canvas.width = W;
    canvas.height = H;

    // ---- DOM Refs ----
    const startScreen = document.getElementById('start-screen');
    const gameoverScreen = document.getElementById('gameover-screen');
    const startBtn = document.getElementById('start-btn');
    const restartBtn = document.getElementById('restart-btn');
    const bestScoreStart = document.getElementById('best-score-start');
    const bestScoreEnd = document.getElementById('best-score-end');
    const finalScoreEl = document.getElementById('final-score');
    const newRecordEl = document.getElementById('new-record');

    // ---- Constants ----
    const GRAVITY = 0.45;
    const PLAYER_SPEED = 4.5;
    const PLAYER_W = 24;
    const PLAYER_H = 32;
    const PLATFORM_H = 10;
    const SPIKE_ZONE_H = 20;

    // Platform types
    const PLAT_NORMAL = 0;
    const PLAT_MOVING = 1;
    const PLAT_BREAKABLE = 2;
    const PLAT_SPIKE = 3;

    // ---- State ----
    let gameState = 'start'; // start | playing | gameover
    let player, platforms, score, bestScore, scrollSpeed, frameCount;
    let keys = {};
    let particles = [];

    // ---- Load Best Score ----
    bestScore = parseInt(localStorage.getItem('man100_best') || '0', 10);
    bestScoreStart.textContent = bestScore;

    // ---- Input ----
    document.addEventListener('keydown', (e) => {
        keys[e.key] = true;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
            e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
        }
    });
    document.addEventListener('keyup', (e) => {
        keys[e.key] = false;
    });

    // ---- Touch Controls (Virtual Buttons) ----
    const touchLeftBtn = document.getElementById('touch-left');
    const touchRightBtn = document.getElementById('touch-right');

    function bindTouchBtn(btn, key) {
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            keys[key] = true;
            btn.classList.add('pressed');
        });
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            keys[key] = false;
            btn.classList.remove('pressed');
        });
        btn.addEventListener('touchcancel', () => {
            keys[key] = false;
            btn.classList.remove('pressed');
        });
    }
    bindTouchBtn(touchLeftBtn, 'ArrowLeft');
    bindTouchBtn(touchRightBtn, 'ArrowRight');

    // ---- Buttons ----
    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', startGame);

    // ---- Initialize Game ----
    function startGame() {
        startScreen.classList.add('hidden');
        gameoverScreen.classList.add('hidden');

        player = {
            x: W / 2 - PLAYER_W / 2,
            y: H / 2,
            vx: 0,
            vy: 0,
            onGround: false,
            facing: 1, // 1 = right, -1 = left
            walkFrame: 0,
            walkTimer: 0,
            alive: true
        };

        platforms = [];
        particles = [];
        score = 0;
        scrollSpeed = 1.2;
        frameCount = 0;

        // Generate initial platforms
        // A safe starting platform directly under the player
        platforms.push(createPlatform(W / 2 - 40, H / 2 + PLAYER_H, 80, PLAT_NORMAL));

        // Fill screen with platforms
        for (let y = H / 2 + 80; y < H + 50; y += 50 + Math.random() * 20) {
            addRandomPlatform(y);
        }
        // A few above player too
        for (let y = H / 2 - 60; y > 60; y -= 50 + Math.random() * 20) {
            addRandomPlatform(y);
        }

        gameState = 'playing';
        requestAnimationFrame(gameLoop);
    }

    // ---- Platform Factory ----
    function createPlatform(x, y, w, type) {
        let plat = {
            x: x,
            y: y,
            w: w,
            h: PLATFORM_H,
            type: type,
            // Moving platform properties
            moveSpeed: (Math.random() * 1.5 + 0.8) * (Math.random() < 0.5 ? 1 : -1),
            // Breakable platform properties
            breaking: false,
            breakTimer: 0,
            broken: false,
            // Visual
            shimmer: Math.random() * Math.PI * 2
        };
        return plat;
    }

    function addRandomPlatform(y) {
        let w = 55 + Math.random() * 45;
        let x = Math.random() * (W - w);
        let type = getRandomPlatformType();
        platforms.push(createPlatform(x, y, w, type));
    }

    function getRandomPlatformType() {
        // Difficulty-based type distribution
        let difficultyFactor = Math.min(score / 100, 1); // 0 to 1 over 100 floors

        let r = Math.random();
        // As difficulty increases, more dangerous platforms
        let spikeChance = 0.05 + difficultyFactor * 0.2;    // 5% → 25%
        let breakChance = 0.08 + difficultyFactor * 0.18;    // 8% → 26%
        let moveChance = 0.15 + difficultyFactor * 0.1;      // 15% → 25%

        if (r < spikeChance) return PLAT_SPIKE;
        if (r < spikeChance + breakChance) return PLAT_BREAKABLE;
        if (r < spikeChance + breakChance + moveChance) return PLAT_MOVING;
        return PLAT_NORMAL;
    }

    // ---- Main Game Loop ----
    let lastTime = 0;
    function gameLoop(timestamp) {
        if (gameState !== 'playing') return;

        let dt = timestamp - lastTime;
        lastTime = timestamp;
        // Cap delta to prevent huge jumps
        if (dt > 50) dt = 50;

        frameCount++;
        update();
        render();
        requestAnimationFrame(gameLoop);
    }

    // ---- Update ----
    function update() {
        // Difficulty scaling
        scrollSpeed = 1.2 + Math.min(score / 50, 3.5);

        // --- Player Movement ---
        if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
            player.vx = -PLAYER_SPEED;
            player.facing = -1;
        } else if (keys['ArrowRight'] || keys['d'] || keys['D']) {
            player.vx = PLAYER_SPEED;
            player.facing = 1;
        } else {
            player.vx *= 0.7; // friction
        }

        // Walk animation
        if (Math.abs(player.vx) > 0.5) {
            player.walkTimer++;
            if (player.walkTimer > 6) {
                player.walkTimer = 0;
                player.walkFrame = (player.walkFrame + 1) % 4;
            }
        } else {
            player.walkFrame = 0;
            player.walkTimer = 0;
        }

        // Gravity
        player.vy += GRAVITY;
        if (player.vy > 12) player.vy = 12; // terminal velocity

        // Apply velocity
        player.x += player.vx;
        player.y += player.vy;
        player.onGround = false;

        // Wall collision (left/right) - 不能穿墙
        if (player.x < 0) player.x = 0;
        if (player.x + PLAYER_W > W) player.x = W - PLAYER_W;

        // --- Platform Collision (only when falling) ---
        if (player.vy >= 0) {
            for (let p of platforms) {
                if (p.broken) continue;
                if (collideWithPlatform(player, p)) {
                    // Spike platform = death
                    if (p.type === PLAT_SPIKE) {
                        die();
                        return;
                    }
                    // Breakable platform
                    if (p.type === PLAT_BREAKABLE && !p.breaking) {
                        p.breaking = true;
                        p.breakTimer = 20; // frames before breaking
                    }
                    player.y = p.y - PLAYER_H;
                    player.vy = 0;
                    player.onGround = true;

                    // If on a moving platform, move with it
                    if (p.type === PLAT_MOVING) {
                        player.x += p.moveSpeed;
                    }
                }
            }
        }

        // --- Scroll platforms up ---
        for (let p of platforms) {
            p.y -= scrollSpeed;

            // Moving platforms
            if (p.type === PLAT_MOVING && !p.broken) {
                p.x += p.moveSpeed;
                if (p.x <= 0 || p.x + p.w >= W) {
                    p.moveSpeed *= -1;
                }
                p.x = Math.max(0, Math.min(W - p.w, p.x));
            }

            // Breakable platform countdown
            if (p.breaking && !p.broken) {
                p.breakTimer--;
                if (p.breakTimer <= 0) {
                    p.broken = true;
                    // Break particles
                    for (let i = 0; i < 6; i++) {
                        particles.push({
                            x: p.x + Math.random() * p.w,
                            y: p.y,
                            vx: (Math.random() - 0.5) * 3,
                            vy: Math.random() * -3,
                            life: 20 + Math.random() * 15,
                            color: '#ffcc00',
                            size: 3 + Math.random() * 3
                        });
                    }
                }
            }
        }

        // Player also scrolls up
        player.y -= scrollSpeed;

        // --- Remove off-screen platforms, add new ones at bottom ---
        platforms = platforms.filter(p => p.y > -30);

        // Track the lowest platform
        let lowestY = 0;
        for (let p of platforms) {
            if (p.y > lowestY) lowestY = p.y;
        }

        // Add new platforms at the bottom
        while (lowestY < H + 20) {
            let gap = 40 + Math.random() * 30 + Math.min(score / 5, 25);
            lowestY += gap;
            addRandomPlatform(lowestY);
        }

        // --- Score ---
        // Increase score as platforms scroll
        if (frameCount % 30 === 0) {
            score++;
        }

        // --- Death Conditions ---
        // Hit the ceiling spikes
        if (player.y < SPIKE_ZONE_H) {
            die();
            return;
        }
        // Fall below the screen
        if (player.y > H + 50) {
            die();
            return;
        }

        // --- Update Particles ---
        for (let p of particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.15;
            p.life--;
        }
        particles = particles.filter(p => p.life > 0);
    }

    function collideWithPlatform(pl, plat) {
        let playerBottom = pl.y + PLAYER_H;
        let playerPrevBottom = playerBottom - pl.vy;
        let feetInRange = playerBottom >= plat.y && playerPrevBottom <= plat.y + 4;
        let horizontalOverlap = pl.x + PLAYER_W > plat.x + 4 && pl.x < plat.x + plat.w - 4;
        return feetInRange && horizontalOverlap;
    }

    function die() {
        player.alive = false;
        gameState = 'gameover';

        // Death particles
        for (let i = 0; i < 20; i++) {
            particles.push({
                x: player.x + PLAYER_W / 2,
                y: player.y + PLAYER_H / 2,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                life: 30 + Math.random() * 20,
                color: Math.random() < 0.5 ? '#ff3344' : '#ffcc00',
                size: 3 + Math.random() * 4
            });
        }

        // Render one last frame with particles
        renderDeathAnimation();
    }

    function renderDeathAnimation() {
        let deathFrames = 0;
        function deathLoop() {
            deathFrames++;
            for (let p of particles) {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.15;
                p.life--;
            }
            particles = particles.filter(p => p.life > 0);

            render();

            if (deathFrames < 40) {
                requestAnimationFrame(deathLoop);
            } else {
                showGameOver();
            }
        }
        requestAnimationFrame(deathLoop);
    }

    function showGameOver() {
        let isNewRecord = false;
        if (score > bestScore) {
            bestScore = score;
            localStorage.setItem('man100_best', bestScore.toString());
            isNewRecord = true;
        }

        finalScoreEl.textContent = score;
        bestScoreEnd.textContent = bestScore;
        bestScoreStart.textContent = bestScore;

        if (isNewRecord) {
            newRecordEl.classList.remove('hidden');
        } else {
            newRecordEl.classList.add('hidden');
        }

        gameoverScreen.classList.remove('hidden');
    }

    // ---- Render ----
    function render() {
        ctx.clearRect(0, 0, W, H);

        // Background gradient
        let bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        bgGrad.addColorStop(0, '#0a0a1e');
        bgGrad.addColorStop(1, '#151535');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        // Background grid lines (subtle)
        ctx.strokeStyle = 'rgba(255,255,255,0.02)';
        ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 25) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, H);
            ctx.stroke();
        }
        for (let y = 0; y < H; y += 25) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
        }

        // ---- Draw Platforms ----
        for (let p of platforms) {
            if (p.broken) continue;
            drawPlatform(p);
        }

        // ---- Draw Player ----
        if (player && player.alive) {
            drawPlayer();
        }

        // ---- Draw Particles ----
        for (let p of particles) {
            let alpha = p.life / 40;
            ctx.globalAlpha = Math.min(1, alpha);
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.size, p.size);
        }
        ctx.globalAlpha = 1;

        // ---- Draw Ceiling Spikes ----
        drawCeilingSpikes();

        // ---- HUD ----
        drawHUD();
    }

    function drawPlatform(p) {
        let colors = {
            [PLAT_NORMAL]: { top: '#00cc66', body: '#009944', glow: 'rgba(0,204,102,0.2)' },
            [PLAT_MOVING]: { top: '#3399ff', body: '#2266cc', glow: 'rgba(51,153,255,0.2)' },
            [PLAT_BREAKABLE]: { top: '#ffcc00', body: '#cc9900', glow: 'rgba(255,204,0,0.2)' },
            [PLAT_SPIKE]: { top: '#ff3344', body: '#cc1122', glow: 'rgba(255,51,68,0.2)' }
        };

        let c = colors[p.type];

        // Breaking animation - shake
        let shakeX = 0;
        if (p.breaking) {
            shakeX = (Math.random() - 0.5) * 4;
            // Transparency as it breaks
            ctx.globalAlpha = Math.max(0.3, p.breakTimer / 20);
        }

        // Glow
        ctx.shadowBlur = 8;
        ctx.shadowColor = c.glow;

        // Body
        ctx.fillStyle = c.body;
        roundRect(ctx, p.x + shakeX, p.y + 2, p.w, p.h - 2, 3);
        ctx.fill();

        // Top surface
        ctx.fillStyle = c.top;
        roundRect(ctx, p.x + shakeX, p.y, p.w, 4, 3);
        ctx.fill();

        ctx.shadowBlur = 0;

        // Spike platform — draw spikes on top
        if (p.type === PLAT_SPIKE) {
            ctx.fillStyle = '#ff3344';
            let spikeW = 8;
            let spikeH = 7;
            for (let sx = p.x + shakeX + 4; sx < p.x + shakeX + p.w - 4; sx += spikeW + 2) {
                ctx.beginPath();
                ctx.moveTo(sx, p.y);
                ctx.lineTo(sx + spikeW / 2, p.y - spikeH);
                ctx.lineTo(sx + spikeW, p.y);
                ctx.closePath();
                ctx.fill();
            }
        }

        // Moving platform — draw arrows
        if (p.type === PLAT_MOVING) {
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = '8px monospace';
            ctx.textAlign = 'center';
            let arrow = p.moveSpeed > 0 ? '►' : '◄';
            ctx.fillText(arrow, p.x + p.w / 2 + shakeX, p.y + 8);
        }

        // Breakable platform — draw cracks
        if (p.type === PLAT_BREAKABLE) {
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x + p.w * 0.3 + shakeX, p.y);
            ctx.lineTo(p.x + p.w * 0.35 + shakeX, p.y + p.h / 2);
            ctx.lineTo(p.x + p.w * 0.4 + shakeX, p.y + p.h);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(p.x + p.w * 0.7 + shakeX, p.y);
            ctx.lineTo(p.x + p.w * 0.65 + shakeX, p.y + p.h * 0.6);
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
    }

    function drawPlayer() {
        let px = Math.round(player.x);
        let py = Math.round(player.y);
        let f = player.facing;

        // Shadow under player
        ctx.fillStyle = 'rgba(0,255,136,0.1)';
        ctx.beginPath();
        ctx.ellipse(px + PLAYER_W / 2, py + PLAYER_H + 2, 10, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body (pixel art style character)
        ctx.save();
        ctx.translate(px + PLAYER_W / 2, py);
        ctx.scale(f, 1);
        ctx.translate(-PLAYER_W / 2, 0);

        // Head
        ctx.fillStyle = '#ffcc88';
        ctx.fillRect(6, 0, 12, 12);

        // Eyes
        ctx.fillStyle = '#222';
        ctx.fillRect(12, 3, 3, 3);
        ctx.fillRect(8, 3, 3, 3);

        // Mouth (small)
        ctx.fillStyle = '#cc6644';
        ctx.fillRect(9, 8, 5, 2);

        // Hair
        ctx.fillStyle = '#332211';
        ctx.fillRect(5, -2, 14, 4);
        ctx.fillRect(4, 0, 2, 6);

        // Body / shirt
        ctx.fillStyle = '#3388ff';
        ctx.fillRect(4, 12, 16, 10);

        // Belt
        ctx.fillStyle = '#222';
        ctx.fillRect(4, 20, 16, 2);
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(10, 20, 4, 2);

        // Legs with walk animation
        ctx.fillStyle = '#224488';
        let legOffset = 0;
        if (Math.abs(player.vx) > 0.5 && player.onGround) {
            let frames = [0, 2, 0, -2];
            legOffset = frames[player.walkFrame];
        }
        // Left leg
        ctx.fillRect(5, 22, 5, 10 + legOffset);
        // Right leg
        ctx.fillRect(14, 22, 5, 10 - legOffset);

        // Shoes
        ctx.fillStyle = '#cc4400';
        ctx.fillRect(4, 30 + legOffset, 7, 2);
        ctx.fillRect(13, 30 - legOffset, 7, 2);

        // Arms
        ctx.fillStyle = '#ffcc88';
        let armSwing = player.onGround && Math.abs(player.vx) > 0.5 ? legOffset : 0;
        ctx.fillRect(0, 14 - armSwing, 4, 8);
        ctx.fillRect(20, 14 + armSwing, 4, 8);

        ctx.restore();

        // Player glow effect
        ctx.shadowBlur = 12;
        ctx.shadowColor = 'rgba(0,255,136,0.3)';
        ctx.shadowBlur = 0;
    }

    function drawCeilingSpikes() {
        // Danger zone background
        let dangerGrad = ctx.createLinearGradient(0, 0, 0, SPIKE_ZONE_H + 10);
        dangerGrad.addColorStop(0, 'rgba(255,20,20,0.6)');
        dangerGrad.addColorStop(1, 'rgba(255,20,20,0)');
        ctx.fillStyle = dangerGrad;
        ctx.fillRect(0, 0, W, SPIKE_ZONE_H + 10);

        // Ceiling bar
        ctx.fillStyle = '#441111';
        ctx.fillRect(0, 0, W, 6);

        // Spikes
        ctx.fillStyle = '#ff2233';
        let spikeW = 14;
        let spikeH = SPIKE_ZONE_H - 6;
        for (let x = 0; x < W; x += spikeW) {
            ctx.beginPath();
            ctx.moveTo(x, 6);
            ctx.lineTo(x + spikeW / 2, 6 + spikeH);
            ctx.lineTo(x + spikeW, 6);
            ctx.closePath();
            ctx.fill();
        }

        // Shimmer effect
        let shimmer = Math.sin(frameCount * 0.08) * 0.15 + 0.15;
        ctx.fillStyle = `rgba(255,100,100,${shimmer})`;
        ctx.fillRect(0, 0, W, SPIKE_ZONE_H);
    }

    function drawHUD() {
        // Score background
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        roundRect(ctx, W - 110, 28, 100, 28, 6);
        ctx.fill();

        // Floor count
        ctx.fillStyle = '#00ff88';
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${score} 层`, W - 18, 47);

        // Best score
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        roundRect(ctx, 10, 28, 100, 28, 6);
        ctx.fill();

        ctx.fillStyle = '#ffcc00';
        ctx.textAlign = 'left';
        ctx.fillText(`最高:${bestScore}`, 18, 47);
    }

    // ---- Utility: Rounded Rect ----
    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    // ---- Responsive Scaling (desktop only, mobile is full-viewport via CSS) ----
    const wrapper = document.getElementById('game-wrapper');

    function isMobileLayout() {
        return window.matchMedia('(hover: none) and (pointer: coarse)').matches
            || window.innerWidth <= 600;
    }

    function resizeGame() {
        if (isMobileLayout()) {
            wrapper.style.transform = '';
            return;
        }
        const padding = 16;
        const maxW = window.innerWidth - padding * 2;
        const maxH = window.innerHeight - padding * 2;
        const scaleX = maxW / W;
        const scaleY = maxH / H;
        const scale = Math.min(scaleX, scaleY);
        wrapper.style.transform = `scale(${scale})`;
    }

    window.addEventListener('resize', resizeGame);
    resizeGame();

})();
