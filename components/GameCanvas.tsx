import React, { useRef, useEffect, useCallback } from 'react';
import { CANVAS_WIDTH, CANVAS_HEIGHT, GRAVITY, EXPLOSION_RADIUS, TANK_SIZE, PARTICLE_COUNT, PARTICLE_LIFE, SKY_GRADIENT_START, SKY_GRADIENT_END, TERRAIN_GRASS_COLOR, TERRAIN_DIRT_START, TERRAIN_DIRT_END } from '../constants';
import { GameStatus, Player, Projectile, Particle, TurnResult } from '../types';
import { playShootSound, playExplosionSound, playImpactSound, playMissileWhistle } from '../utils/sound';

interface GameCanvasProps {
  players: Player[];
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
  currentPlayerIndex: number;
  setCurrentPlayerIndex: React.Dispatch<React.SetStateAction<number>>;
  status: GameStatus;
  setStatus: React.Dispatch<React.SetStateAction<GameStatus>>;
  wind: number;
  onTurnComplete: (result: TurnResult) => void;
  triggerFire: boolean;
  setTriggerFire: (val: boolean) => void;
  onTerrainChange: (heightMap: number[]) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  players,
  setPlayers,
  currentPlayerIndex,
  setCurrentPlayerIndex,
  status,
  setStatus,
  wind,
  onTurnComplete,
  triggerFire,
  setTriggerFire,
  onTerrainChange
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const terrainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stopWhistleRef = useRef<(() => void) | null>(null);
  
  const gameState = useRef({
    players: players,
    currentPlayerIndex: currentPlayerIndex,
    status: status,
    wind: wind,
    projectile: null as Projectile | null,
    particles: [] as Particle[],
    screenShake: 0,
  });

  useEffect(() => { gameState.current.players = players; }, [players]);
  useEffect(() => { gameState.current.currentPlayerIndex = currentPlayerIndex; }, [currentPlayerIndex]);
  useEffect(() => { gameState.current.status = status; }, [status]);
  useEffect(() => { gameState.current.wind = wind; }, [wind]);

  // --- Helper: Get Terrain Height (Single Point) ---
  const getTerrainHeight = useCallback((x: number, ctx: CanvasRenderingContext2D): number => {
    try {
        const checkX = Math.max(0, Math.min(Math.floor(x), CANVAS_WIDTH - 1));
        const pixelData = ctx.getImageData(checkX, 0, 1, CANVAS_HEIGHT).data;
        for (let y = 0; y < CANVAS_HEIGHT; y++) {
            if (pixelData[y * 4 + 3] > 200) return y;
        }
    } catch (e) {
        return CANVAS_HEIGHT;
    }
    return CANVAS_HEIGHT; 
  }, []);

  // --- Helper: Capture current height map for AI ---
  const updateHeightMap = useCallback(() => {
    if (!terrainCanvasRef.current) return;
    const ctx = terrainCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    const width = CANVAS_WIDTH;
    const height = CANVAS_HEIGHT;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const map: number[] = new Array(width);

    for(let x = 0; x < width; x++) {
        let surfaceY = height; 
        for(let y = 0; y < height; y++) {
            const alphaIndex = (y * width + x) * 4 + 3;
            if (data[alphaIndex] > 200) {
                surfaceY = y;
                break;
            }
        }
        map[x] = surfaceY;
    }
    onTerrainChange(map);
  }, [onTerrainChange]);

  // --- Helper: Remove floating islands of dirt ---
  const removeFloatingTerrain = useCallback((ctx: CanvasRenderingContext2D) => {
     const width = CANVAS_WIDTH;
     const height = CANVAS_HEIGHT;
     const imageData = ctx.getImageData(0, 0, width, height);
     const data = imageData.data;
     let modified = false;

     // Scan columns
     for (let x = 0; x < width; x += 2) {
        let foundSky = false;
        // Scan from bottom up
        for (let y = height - 1; y >= 0; y--) {
            const index = (y * width + x) * 4 + 3; 
            const isSolid = data[index] > 50;

            if (!isSolid) {
                foundSky = true;
            } else if (foundSky && isSolid) {
                const idx = (y * width + x) * 4;
                data[idx+3] = 0; 
                if (x > 0) data[((y * width + x - 1) * 4) + 3] = 0;
                modified = true;
            }
        }
     }
     if (modified) {
         ctx.putImageData(imageData, 0, 0);
     }
  }, []);

  // --- Terrain Generation ---
  const generateTerrain = useCallback(() => {
    if (!terrainCanvasRef.current) {
      const tc = document.createElement('canvas');
      tc.width = CANVAS_WIDTH;
      tc.height = CANVAS_HEIGHT;
      terrainCanvasRef.current = tc;
    }
    
    const ctx = terrainCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 1. Generate Base Surface Shape (Jagged Mountains)
    const frequencies = [0.003, 0.01, 0.02, 0.08]; 
    const amplitudes = [200, 80, 40, 15]; 
    const phases = frequencies.map(() => Math.random() * Math.PI * 2);
    const baseHeight = CANVAS_HEIGHT * 0.7; 
    
    const surfaceY: number[] = [];

    ctx.beginPath();
    ctx.moveTo(0, CANVAS_HEIGHT);
    let x = 0;
    while (x <= CANVAS_WIDTH) {
      let noise = 0;
      frequencies.forEach((freq, i) => {
        noise += Math.sin(x * freq + phases[i]) * amplitudes[i];
      });
      
      let y = baseHeight + noise;
      y = Math.max(100, Math.min(CANVAS_HEIGHT - 50, y));
      
      surfaceY[x] = y;
      if (x > 0 && x % 2 === 0) surfaceY[x-1] = y; 
      
      ctx.lineTo(x, y);
      x += 2;
    }
    ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.lineTo(0, CANVAS_HEIGHT);
    ctx.closePath();

    // 2. Fill: Realistic Earth Gradient
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    grad.addColorStop(0, TERRAIN_DIRT_START); 
    grad.addColorStop(1, TERRAIN_DIRT_END); 
    ctx.fillStyle = grad;
    ctx.fill();

    // 3. Add Texture (Noise)
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    for (let i = 0; i < 3000; i++) {
        const tx = Math.random() * CANVAS_WIDTH;
        const ty = Math.random() * CANVAS_HEIGHT;
        const size = Math.random() * 3 + 1;
        ctx.fillRect(tx, ty, size, size);
    }
    ctx.globalCompositeOperation = 'source-over';

    // 4. Draw Grass Layer
    ctx.lineCap = 'round';
    ctx.strokeStyle = TERRAIN_GRASS_COLOR;
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let lx = 0; lx <= CANVAS_WIDTH; lx+=2) {
        if (lx === 0) ctx.moveTo(lx, surfaceY[lx]);
        else ctx.lineTo(lx, surfaceY[lx] || CANVAS_HEIGHT);
    }
    ctx.stroke();
    
    // Add random darker grass tufts
    ctx.strokeStyle = '#3f6212'; // Darker green
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let lx = 0; lx <= CANVAS_WIDTH; lx+=15) {
        if (Math.random() > 0.5) {
            const y = surfaceY[lx];
            ctx.moveTo(lx, y + 2);
            ctx.lineTo(lx, y + 6);
        }
    }
    ctx.stroke();

    // 5. Draw Tiny Trees (Destructible)
    for (let t = 0; t < 50; t++) {
        const tx = Math.floor(Math.random() * (CANVAS_WIDTH - 20) + 10);
        const ty = surfaceY[tx];
        
        // Don't draw trees on extremely steep slopes or in water/pits
        if (ty && ty < CANVAS_HEIGHT - 20) {
             const height = Math.random() * 10 + 10;
             const width = height * 0.4;
             
             // Trunk
             ctx.fillStyle = '#3f2e18';
             ctx.fillRect(tx - 1, ty - height * 0.3, 2, height * 0.3);

             // Foliage (Triangle)
             ctx.fillStyle = Math.random() > 0.5 ? '#166534' : '#14532d'; // Varying green
             ctx.beginPath();
             ctx.moveTo(tx - width, ty - height * 0.3);
             ctx.lineTo(tx + width, ty - height * 0.3);
             ctx.lineTo(tx, ty - height);
             ctx.fill();
        }
    }

    removeFloatingTerrain(ctx);
    updateHeightMap();

  }, [updateHeightMap, removeFloatingTerrain]);

  useEffect(() => {
    generateTerrain();
  }, [generateTerrain]);


  // --- Physics & Destruction ---
  const explode = (x: number, y: number) => {
    if (!terrainCanvasRef.current) return;
    const ctx = terrainCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    if (stopWhistleRef.current) {
        stopWhistleRef.current();
        stopWhistleRef.current = null;
    }

    playExplosionSound();
    gameState.current.screenShake = 15;

    // 1. Destroy Terrain
    ctx.globalCompositeOperation = 'destination-out';
    const clusters = 12;
    for(let i=0; i<clusters; i++) {
        const angle = (Math.PI * 2 / clusters) * i;
        const dist = Math.random() * (EXPLOSION_RADIUS * 0.5);
        const ex = x + Math.cos(angle) * dist;
        const ey = y + Math.sin(angle) * dist;
        const r = EXPLOSION_RADIUS * (0.6 + Math.random() * 0.4);
        
        ctx.beginPath();
        ctx.arc(ex, ey, r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // Burn marks on edges of crater
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.arc(x, y, EXPLOSION_RADIUS + 5, 0, Math.PI*2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    removeFloatingTerrain(ctx);
    updateHeightMap();

    // 2. Debris Particles
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 2;
      // Mix of Dirt, Stone, and Fire colors
      const type = Math.random();
      let color = '#574a35'; // Dirt
      if (type > 0.7) color = '#3f2e18'; // Dark Dirt
      else if (type > 0.9) color = '#9ca3af'; // Grey Stone
      else if (type < 0.2) color = '#ea580c'; // Fire

      gameState.current.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: PARTICLE_LIFE + Math.random() * 20,
        color: color,
        size: Math.random() * 4 + 2 // Chunky debris
      });
    }

    // 3. Damage Calculation
    const currentPlayers = [...gameState.current.players];
    let hitId: number | undefined;
    let dmg = 0;
    let missed = true;
    let minDistance = Infinity;
    const shooterId = gameState.current.players[gameState.current.currentPlayerIndex].id;

    currentPlayers.forEach((p) => {
        if (p.isDead) return;
        const dist = Math.sqrt(Math.pow(p.x - x, 2) + Math.pow(p.y - y, 2));
        
        if (p.id !== shooterId) {
            if (dist < minDistance) minDistance = dist;
        }

        if (dist < EXPLOSION_RADIUS + TANK_SIZE) {
            const damage = Math.floor(((EXPLOSION_RADIUS + TANK_SIZE - dist) / (EXPLOSION_RADIUS + TANK_SIZE)) * 45);
            p.health = Math.max(0, p.health - damage);
            if (p.health === 0) p.isDead = true;
            
            if (p.id !== shooterId) {
                hitId = p.id;
                dmg = damage;
                missed = false;
            }
        }
    });

    setPlayers(currentPlayers);
    onTurnComplete({
        hitPlayerId: hitId,
        damage: dmg,
        missed,
        distanceFromTarget: minDistance,
        shooterName: gameState.current.players[gameState.current.currentPlayerIndex].name
    });
  };

  const fireProjectile = useCallback(() => {
    playShootSound();
    
    if (stopWhistleRef.current) stopWhistleRef.current();
    stopWhistleRef.current = playMissileWhistle(); // Start whistle and store stop fn

    const player = gameState.current.players[gameState.current.currentPlayerIndex];
    const rad = (player.angle * Math.PI) / 180;
    const powerScale = player.power * 0.25;
    
    const muzzleLen = 30;
    const mx = player.x + Math.cos(rad) * muzzleLen;
    const my = player.y - 15 - Math.sin(rad) * muzzleLen; 

    gameState.current.projectile = {
      x: mx,
      y: my,
      vx: Math.cos(rad) * powerScale,
      vy: -Math.sin(rad) * powerScale, 
      active: true
    };
    setStatus(GameStatus.PROJECTILE_ACTIVE);
    
    // Muzzle Flash Particle
    gameState.current.particles.push({
        x: mx, y: my, vx: 0, vy: 0, life: 10, color: '#fcd34d', size: 10
    });

  }, [setStatus]);

  useEffect(() => {
    if (triggerFire && status === GameStatus.IDLE) {
      fireProjectile();
      setTriggerFire(false);
    }
  }, [triggerFire, status, fireProjectile, setTriggerFire]);


  // --- Render Loop ---
  const requestRef = useRef<number>(0);

  const drawBackground = (ctx: CanvasRenderingContext2D) => {
    // Realistic Sky Gradient
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    grad.addColorStop(0, SKY_GRADIENT_START); 
    grad.addColorStop(1, SKY_GRADIENT_END);   
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Simple Sun/Moon glow
    const sunGrad = ctx.createRadialGradient(100, 100, 0, 100, 100, 60);
    sunGrad.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    sunGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0,0, 200, 200);
  };

  const loop = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const terrainCanvas = terrainCanvasRef.current;
    const terrainCtx = terrainCanvas?.getContext('2d', { willReadFrequently: true });

    if (!canvas || !ctx || !terrainCanvas || !terrainCtx) {
        requestRef.current = requestAnimationFrame(loop);
        return;
    }

    const { wind, players, currentPlayerIndex, status: currentStatus } = gameState.current;

    // Screen Shake Offset
    let shakeX = 0;
    let shakeY = 0;
    if (gameState.current.screenShake > 0) {
        shakeX = (Math.random() * 2 - 1) * gameState.current.screenShake;
        shakeY = (Math.random() * 2 - 1) * gameState.current.screenShake;
        gameState.current.screenShake *= 0.9;
        if(gameState.current.screenShake < 0.5) gameState.current.screenShake = 0;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // --- Draw Scene ---
    drawBackground(ctx);
    ctx.drawImage(terrainCanvas, 0, 0);

    // Draw Players
    const activePlayers = [...players];
    
    activePlayers.forEach((p, index) => {
      if (p.isDead) return;

      const groundY = getTerrainHeight(p.x, terrainCtx);
      
      if (p.y < groundY - 1) {
          p.y += 4; 
          if (p.y > groundY) p.y = groundY; 
      } else if (p.y > groundY) {
          p.y = groundY;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      
      // AI Label
      if (p.isAI) {
         ctx.font = 'bold 10px sans-serif';
         ctx.fillStyle = '#ef4444';
         ctx.textAlign = 'center';
         ctx.fillText("CPU", 0, -55);
      }

      // Draw Tank (Realistic Style)
      
      // 1. Treads
      ctx.fillStyle = '#1f2937'; // Dark Grey
      ctx.fillRect(-20, -6, 40, 6);
      // Tread details
      ctx.fillStyle = '#374151';
      for(let i=-18; i<18; i+=6) ctx.fillRect(i, -5, 4, 4);

      // 2. Chassis
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(-18, -6);
      ctx.lineTo(-14, -18);
      ctx.lineTo(14, -18);
      ctx.lineTo(18, -6);
      ctx.fill();
      
      // 3. Turret Base
      ctx.beginPath();
      ctx.arc(0, -18, 8, Math.PI, 0);
      ctx.fill();
      
      // 4. Cannon Barrel
      ctx.save();
      ctx.translate(0, -18);
      ctx.rotate(-p.angle * Math.PI / 180); 
      ctx.fillStyle = '#4b5563'; // Gunmetal
      ctx.fillRect(0, -4, 30, 8);
      // Muzzle tip
      ctx.fillStyle = '#111827'; 
      ctx.fillRect(28, -5, 4, 10);
      ctx.restore();

      // Health Bar
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(-20, -40, 40, 4);
      ctx.fillStyle = p.health > 30 ? '#22c55e' : '#ef4444';
      ctx.fillRect(-20, -40, 40 * (p.health / 100), 4);

      // Current Player Arrow
      if (p.id === players[currentPlayerIndex].id && currentStatus === GameStatus.IDLE) {
          const floatY = Math.sin(Date.now() / 200) * 5;
          ctx.fillStyle = '#fbbf24'; 
          ctx.beginPath();
          ctx.moveTo(0, -65 + floatY);
          ctx.lineTo(-6, -75 + floatY);
          ctx.lineTo(6, -75 + floatY);
          ctx.fill();
      }

      ctx.restore();
      gameState.current.players[index] = p;
    });

    // Draw Projectile
    const proj = gameState.current.projectile;
    if (proj && proj.active) {
      const prevX = proj.x;
      const prevY = proj.y;

      proj.x += proj.vx + wind; 
      proj.y += proj.vy;
      proj.vy += GRAVITY;

      // Draw Shell
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, 3, 0, Math.PI * 2);
      ctx.fill();

      // Draw Smoke Trail (add new smoke particle)
      if (Math.random() > 0.2) {
          gameState.current.particles.push({
             x: prevX,
             y: prevY,
             vx: (Math.random() - 0.5) * 0.5,
             vy: (Math.random() - 0.5) * 0.5,
             life: 20,
             color: `rgba(150, 150, 150, 0.4)`,
             size: Math.random() * 3 + 2
          });
      }

      let hit = false;

      // Boundary Checks
      if (proj.x < 0 || proj.x > CANVAS_WIDTH || proj.y > CANVAS_HEIGHT + 500) {
        if (stopWhistleRef.current) {
            stopWhistleRef.current();
            stopWhistleRef.current = null;
        }
        playImpactSound();
        proj.active = false;
        setStatus(GameStatus.IDLE);
        onTurnComplete({ missed: true, shooterName: players[currentPlayerIndex].name });
      }
      else if (proj.x >= 0 && proj.x < CANVAS_WIDTH && proj.y >= 0) {
        
        // Raycast Collision
        const steps = Math.ceil(Math.sqrt(Math.pow(proj.x - prevX, 2) + Math.pow(proj.y - prevY, 2)));
        const dx = (proj.x - prevX) / steps;
        const dy = (proj.y - prevY) / steps;
        
        for (let s = 0; s <= steps; s++) {
            const checkX = prevX + dx * s;
            const checkY = prevY + dy * s;
            
            // Player Collision
            for (const p of activePlayers) {
                if (p.isDead) continue;
                const dist = Math.sqrt(Math.pow(p.x - checkX, 2) + Math.pow(p.y - checkY, 2));
                if (dist < TANK_SIZE) {
                    hit = true;
                    proj.x = p.x;
                    proj.y = p.y - 10;
                    break;
                }
            }
            if (hit) break;

            // Terrain Collision
            if (checkY >= 0 && checkY < CANVAS_HEIGHT) {
                 const pixel = terrainCtx.getImageData(Math.floor(checkX), Math.floor(checkY), 1, 1).data;
                 if (pixel[3] > 20) {
                    hit = true;
                    proj.x = checkX;
                    proj.y = checkY;
                    break;
                 }
            }
        }

        if (hit) {
            proj.active = false;
            setStatus(GameStatus.EXPLODING);
            explode(proj.x, proj.y);
        }
      }
    }

    // Draw Particles (Standard Alpha Blending)
    const parts = gameState.current.particles;
    if (parts.length > 0) {
      parts.forEach((pt) => {
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vy += GRAVITY * 0.1; // Light gravity for smoke/debris
        pt.life--;
        
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        
        // Parse color to handle RGBA strings vs Hex
        ctx.fillStyle = pt.color;
        
        // If it's a hex color, we apply global alpha. If rgba string, we trust it or apply opacity.
        // Simple life fade:
        ctx.globalAlpha = Math.max(0, pt.life / PARTICLE_LIFE);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      
      gameState.current.particles = parts.filter(pt => pt.life > 0);

      if (gameState.current.particles.length === 0 && currentStatus === GameStatus.EXPLODING) {
        setStatus(GameStatus.IDLE);
      }
    }

    ctx.restore(); // Restore shake
    requestRef.current = requestAnimationFrame(loop);
  }, [setStatus, onTurnComplete, getTerrainHeight, explode]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [loop]);

  return (
    <div className="relative border-4 border-slate-700 rounded-lg overflow-hidden shadow-xl">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="block w-full h-full object-cover bg-sky-900"
      />
    </div>
  );
};