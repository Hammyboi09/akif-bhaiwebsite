import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, RotateCcw, Trophy, Trash2 } from 'lucide-react';

// Responsive game dimensions
const getGameDimensions = () => {
  const isMobile = window.innerWidth < 768;
  return {
    width: isMobile ? Math.min(360, window.innerWidth - 10) : 500,
    height: 500,
  };
};

const DUSTBIN_WIDTH = 80;
const DUSTBIN_HEIGHT = 80;
const WASTE_SIZE = 35; // Slightly smaller for mobile
const DUSTBIN_SPEED = 15; // Faster for better mobile responsiveness
const BASE_WASTE_FALL_SPEED = 1.5; // Reduced for smoother animation
const SPEED_INCREASE_INTERVAL = 10;
const GROUND_HEIGHT = 20; // Height of the ground/street area

interface Position {
  x: number;
  y: number;
}

interface WasteItem {
  id: number;
  x: number;
  y: number;
  vx: number; // velocity x for deflection
  vy: number; // velocity y for deflection
  rotation: number; // rotation angle for animation
  rotationSpeed: number; // rotation speed
  type: string;
  image: string;
  isDeflected: boolean;
}

const WASTE_TYPES = [
  { type: 'plastic-bottle', image: '/assets/soft plastic.png' },
  { type: 'plastic-bag', image: '/assets/can.png' },
  { type: 'plastic-cup', image: '/assets/pet bottle.png' },
  { type: 'plastic-container', image: '/assets/paper.png' },
  { type: 'plastic-straw', image: '/assets/crumbled paper.png' },
  { type: 'plastic-wrapper', image: '/assets/soda glass.png' },
];

const PlogRunGame: React.FC = () => {
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();
  const lastWasteSpawn = useRef<number>(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const keysPressed = useRef<Set<string>>(new Set());

  const [gameDimensions, setGameDimensions] = useState(getGameDimensions());

  const [gameState, setGameState] = useState({
    dustbinX: 0,
    wasteItems: [] as WasteItem[],
    score: 0,
    gameOver: false,
    isPlaying: false,
    gameStarted: false,
    currentSpeed: BASE_WASTE_FALL_SPEED,
  });

  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('plogRunHighScore');
    return saved ? parseInt(saved, 10) : 0;
  });

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const newDimensions = getGameDimensions();
      setGameDimensions(newDimensions);
      setGameState((prev) => ({
        ...prev,
        dustbinX: Math.min(prev.dustbinX, newDimensions.width - DUSTBIN_WIDTH),
      }));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize dustbin position
  useEffect(() => {
    setGameState((prev) => ({
      ...prev,
      dustbinX: gameDimensions.width / 2 - DUSTBIN_WIDTH / 2,
    }));
  }, [gameDimensions.width]);

  const getCurrentSpeed = useCallback((score: number) => {
    const speedLevel = Math.floor(score / SPEED_INCREASE_INTERVAL);
    return BASE_WASTE_FALL_SPEED + speedLevel * 0.5;
  }, []);

  const spawnWaste = useCallback(() => {
    const now = Date.now();
    const spawnInterval = Math.max(
      1200,
      2500 - Math.floor(gameState.score / SPEED_INCREASE_INTERVAL) * 150
    );

    if (now - lastWasteSpawn.current > spawnInterval) {
      const wasteType =
        WASTE_TYPES[Math.floor(Math.random() * WASTE_TYPES.length)];
      const newWaste: WasteItem = {
        id: now,
        x: Math.random() * (gameDimensions.width - WASTE_SIZE),
        y: -WASTE_SIZE,
        vx: 0,
        vy: getCurrentSpeed(gameState.score),
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 4, // Random rotation speed between -2 and 2
        type: wasteType.type,
        image: wasteType.image,
        isDeflected: false,
      };

      setGameState((prev) => ({
        ...prev,
        wasteItems: [...prev.wasteItems, newWaste],
      }));
      lastWasteSpawn.current = now;
    }
  }, [gameDimensions.width, gameState.score, getCurrentSpeed]);

  const checkCollision = (waste: WasteItem, dustbinX: number) => {
    const dustbinTop = gameDimensions.height - DUSTBIN_HEIGHT - GROUND_HEIGHT;
    const dustbinBottom = gameDimensions.height - GROUND_HEIGHT;
    const dustbinLeft = dustbinX;
    const dustbinRight = dustbinX + DUSTBIN_WIDTH;

    const wasteLeft = waste.x;
    const wasteRight = waste.x + WASTE_SIZE;
    const wasteTop = waste.y;
    const wasteBottom = waste.y + WASTE_SIZE;

    // Check if waste is at dustbin level
    if (wasteBottom >= dustbinTop && wasteTop <= dustbinBottom) {
      // Check for any overlap between waste and dustbin
      if (wasteRight > dustbinLeft && wasteLeft < dustbinRight) {
        // Calculate the overlap area
        const overlapLeft = Math.max(wasteLeft, dustbinLeft);
        const overlapRight = Math.min(wasteRight, dustbinRight);
        const overlapWidth = overlapRight - overlapLeft;

        // Calculate what percentage of the waste is inside the dustbin
        const overlapPercentage = overlapWidth / WASTE_SIZE;

        if (overlapPercentage >= 0.6) {
          return 'caught';
        } else {
          return 'deflected';
        }
      }
    }

    return 'none';
  };

  const updateGame = useCallback(() => {
    setGameState((prev) => {
      if (!prev.isPlaying || prev.gameOver) return prev;

      // Move dustbin based on keys pressed
      let newDustbinX = prev.dustbinX;
      if (keysPressed.current.has('ArrowLeft')) {
        newDustbinX = Math.max(0, prev.dustbinX - DUSTBIN_SPEED);
      }
      if (keysPressed.current.has('ArrowRight')) {
        newDustbinX = Math.min(
          gameDimensions.width - DUSTBIN_WIDTH,
          prev.dustbinX + DUSTBIN_SPEED
        );
      }

      // Calculate current speed based on score
      const currentSpeed = getCurrentSpeed(prev.score);

      // Update waste items
      const updatedWasteItems: WasteItem[] = [];
      let newScore = prev.score;
      let gameOver = false;

      prev.wasteItems.forEach((waste) => {
        let newWaste = { ...waste };

        if (!waste.isDeflected) {
          // Normal falling waste
          newWaste.y += currentSpeed;
          newWaste.rotation += newWaste.rotationSpeed; // Add rotation to falling waste

          const collision = checkCollision(newWaste, newDustbinX);

          if (collision === 'caught') {
            // Waste caught successfully
            newScore += 1;
            return;
          } else if (collision === 'deflected') {
            // Waste hit the edge, deflect it
            const dustbinCenterX = newDustbinX + DUSTBIN_WIDTH / 2;
            const wasteCenterX = newWaste.x + WASTE_SIZE / 2;
            const deflectionDirection = wasteCenterX < dustbinCenterX ? -1 : 1;

            newWaste.isDeflected = true;
            newWaste.vx = deflectionDirection * (2 + Math.random() * 2); // Random deflection speed
            newWaste.vy = currentSpeed * 0.7; // Reduce vertical speed slightly
            newWaste.rotationSpeed =
              deflectionDirection * (5 + Math.random() * 10); // Random rotation
          }
        }

        if (waste.isDeflected) {
          // Update deflected waste with physics
          newWaste.x += newWaste.vx;
          newWaste.y += newWaste.vy;
          newWaste.rotation += newWaste.rotationSpeed;

          // Apply gravity to deflected waste
          newWaste.vy += 0.2;

          // Apply air resistance to horizontal movement
          newWaste.vx *= 0.98;

          // Bounce off walls
          if (
            newWaste.x <= 0 ||
            newWaste.x >= gameDimensions.width - WASTE_SIZE
          ) {
            newWaste.vx *= -0.7;
            newWaste.x = Math.max(
              0,
              Math.min(gameDimensions.width - WASTE_SIZE, newWaste.x)
            );
          }
        }

        // Check if waste hit the ground
        if (newWaste.y >= gameDimensions.height - GROUND_HEIGHT - WASTE_SIZE) {
          gameOver = true;
          return;
        }

        // Keep waste that's still in play
        if (newWaste.y < gameDimensions.height) {
          updatedWasteItems.push(newWaste);
        }
      });

      if (gameOver) {
        const newHighScore = Math.max(newScore, highScore);
        if (newHighScore > highScore) {
          setHighScore(newHighScore);
          localStorage.setItem('plogRunHighScore', newHighScore.toString());
        }
      }

      return {
        ...prev,
        dustbinX: newDustbinX,
        wasteItems: updatedWasteItems,
        score: newScore,
        gameOver,
        isPlaying: !gameOver,
        currentSpeed,
      };
    });
  }, [highScore, gameDimensions.width, gameDimensions.height, getCurrentSpeed]);

  const gameLoop = useCallback(() => {
    updateGame();
    spawnWaste();
    animationFrameRef.current = requestAnimationFrame(gameLoop);
  }, [updateGame, spawnWaste]);

  const startGame = useCallback(() => {
    setGameState({
      dustbinX: gameDimensions.width / 2 - DUSTBIN_WIDTH / 2,
      wasteItems: [],
      score: 0,
      gameOver: false,
      isPlaying: true,
      gameStarted: true,
      currentSpeed: BASE_WASTE_FALL_SPEED,
    });
    lastWasteSpawn.current = Date.now();
    keysPressed.current.clear();
  }, [gameDimensions.width]);

  const resetGame = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setGameState({
      dustbinX: gameDimensions.width / 2 - DUSTBIN_WIDTH / 2,
      wasteItems: [],
      score: 0,
      gameOver: false,
      isPlaying: false,
      gameStarted: false,
      currentSpeed: BASE_WASTE_FALL_SPEED,
    });
    keysPressed.current.clear();
  }, [gameDimensions.width]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        keysPressed.current.add(e.key);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Touch controls for mobile
  useEffect(() => {
    const gameArea = gameAreaRef.current;
    if (!gameArea) return;

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!touchStartRef.current || !gameState.isPlaying) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;

      if (Math.abs(deltaX) > 5) { // More sensitive for mobile
        setGameState((prev) => {
          let newX = prev.dustbinX;
          if (deltaX < 0) {
            newX = Math.max(0, prev.dustbinX - DUSTBIN_SPEED * 2);
          } else {
            newX = Math.min(
              gameDimensions.width - DUSTBIN_WIDTH,
              prev.dustbinX + DUSTBIN_SPEED * 2
            );
          }
          return { ...prev, dustbinX: newX };
        });
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      touchStartRef.current = null;
    };

    gameArea.addEventListener('touchstart', handleTouchStart, {
      passive: false,
    });
    gameArea.addEventListener('touchmove', handleTouchMove, { passive: false });
    gameArea.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      gameArea.removeEventListener('touchstart', handleTouchStart);
      gameArea.removeEventListener('touchmove', handleTouchMove);
      gameArea.removeEventListener('touchend', handleTouchEnd);
    };
  }, [gameState.isPlaying, gameDimensions.width]);

  // Game loop
  useEffect(() => {
    if (gameState.isPlaying && !gameState.gameOver) {
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState.isPlaying, gameState.gameOver, gameLoop]);

  const speedLevel = Math.floor(gameState.score / SPEED_INCREASE_INTERVAL) + 1;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-blue-300 via-green-200 to-green-400 p-2 sm:p-4">
      <div
        className="bg-white rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden border border-green-200 w-full max-w-md sm:max-w-none"
        style={{ width: gameDimensions.width }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-300 to-sky-400 text-white p-3 sm:p-4 md:p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between mb-3 sm:mb-4">
            <div className="text-center sm:text-left mb-2 sm:mb-0">
              <h1
                className="text-xl sm:text-2xl md:text-3xl font-bold italic text-white"
                style={{ textShadow: '2px 2px 4px #1e40af' }}
              >
                CATCH IT
              </h1>
              <p className="text-sky-100 text-xs sm:text-sm md:text-base mt-1 mb-3 sm:mb-4 md:mb-0">
                Keep The Streets Clean or Game Over!
              </p>
            </div>

            {/* Scoreboard in Header */}
            <div className="flex items-center gap-3 sm:gap-4 md:gap-6 bg-white bg-opacity-20 rounded-lg px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:ml-8">
              <div className="text-center">
                <div className="flex items-center gap-1 sm:gap-2 text-sm sm:text-base md:text-lg">
                  <Trophy className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-yellow-300" />
                  <span className="font-bold text-white">
                    {gameState.score}
                  </span>
                </div>
                <div className="text-xs sm:text-sm text-sky-100">Score</div>
              </div>
              <div className="text-center">
                <div className="text-sm sm:text-base md:text-lg font-bold text-white">
                  {highScore}
                </div>
                <div className="text-xs sm:text-sm text-sky-100">Best</div>
              </div>
              <div className="text-center">
                <div className="text-sm sm:text-base md:text-lg font-bold text-white">
                  {speedLevel}x
                </div>
                <div className="text-xs sm:text-sm text-sky-100">Speed</div>
              </div>
            </div>
          </div>
        </div>

        {/* Game Area */}
        <div className="relative">
          <div
            ref={gameAreaRef}
            className="relative overflow-hidden w-full"
            style={{
              width: gameDimensions.width,
              height: gameDimensions.height,
            }}
          >
            {/* City Background */}
            <div className="absolute inset-0">
              <img
                src="/assets/Backdrop-01.png"
                alt="City Background"
                className="absolute inset-0 w-full h-full object-cover object-left"
              />

              {/* Street */}
              <div
                className="absolute bottom-0 w-full bg-gray-800"
                style={{ height: GROUND_HEIGHT }}
              >
                {/* Street lines */}
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-yellow-400 opacity-60"></div>
                <div
                  className="absolute top-1/2 left-0 w-full h-0.5 bg-yellow-400 opacity-60"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(to right, transparent, transparent 10px, yellow 10px, yellow 20px)',
                    transform: 'translateY(-1px)',
                  }}
                ></div>
              </div>
            </div>

            {/* Custom Blue Recycling Dustbin */}
            <div
              className="absolute transition-all duration-100 z-10"
              style={{
                left: gameState.dustbinX,
                bottom: GROUND_HEIGHT,
                width: DUSTBIN_WIDTH,
                height: DUSTBIN_HEIGHT,
              }}
            >
              <img
                src="/assets/Bin.png"
                alt="Recycling Dustbin"
                className="w-full h-full object-contain"
              />
            </div>

            {/* Waste Items */}
            {gameState.wasteItems.map((waste) => (
              <div
                key={waste.id}
                className="absolute text-2xl md:text-3xl z-5 transition-transform duration-75"
                style={{
                  left: waste.x,
                  top: waste.y,
                  width: WASTE_SIZE,
                  height: WASTE_SIZE,
                  transform: `rotate(${waste.rotation}deg)`,
                  filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4)) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6))',
                }}

              >
                <img
                  src={waste.image}
                  alt={waste.type}
                  className="w-full h-full object-contain"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
            ))}

            {/* Game Start/Over Overlay */}
            {(!gameState.gameStarted || gameState.gameOver) && (
              <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center z-30">
                <div className="bg-white rounded-xl p-4 sm:p-6 md:p-8 text-center shadow-xl max-w-xs sm:max-w-sm mx-2 sm:mx-4">
                  {!gameState.gameStarted ? (
                    <>
                      <Trash2 className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 text-green-600 mx-auto mb-3 sm:mb-4" />
                      <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 mb-2">
                        Ready to Play?
                      </h2>
                      <p className="text-gray-600 mb-3 sm:mb-4 text-xs sm:text-sm md:text-base">
                        Keep the streets clean! 
                        <span className="hidden sm:inline"> Use arrow keys or</span>
                        <span className="sm:hidden"> </span>
                        Swipe to move the recycling bin. Catch waste in the center - edge hits deflect!
                      </p>
                      <p className="text-blue-600 text-xs sm:text-sm mb-3 sm:mb-4 font-semibold">
                        💡 Speed increases every 10 items collected!
                      </p>
                      <button
                        onClick={startGame}
                        className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white px-4 sm:px-6 md:px-8 py-2 sm:py-2 md:py-3 rounded-lg font-semibold transition-colors flex items-center gap-2 mx-auto text-sm md:text-base touch-manipulation"
                      >
                        <Play className="w-4 h-4 md:w-5 md:h-5" />
                        Start Playing
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="text-red-500 text-3xl sm:text-4xl md:text-6xl mb-3 sm:mb-4">
                        🌍💔
                      </div>
                      <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 mb-2">
                        Streets Polluted!
                      </h2>
                      <p className="text-gray-600 mb-2 text-xs sm:text-sm md:text-base">
                        Waste hit the ground!
                      </p>
                      <p className="text-base sm:text-lg md:text-xl font-semibold text-green-600 mb-2">
                        Items Collected: {gameState.score}
                      </p>
                      <p className="text-xs sm:text-sm text-blue-600 mb-3 sm:mb-4">
                        Reached Speed Level: {speedLevel}
                      </p>
                      {gameState.score === highScore && gameState.score > 0 && (
                        <p className="text-yellow-600 font-semibold mb-3 sm:mb-4 text-xs sm:text-sm md:text-base">
                          🎉 New Record! 🎉
                        </p>
                      )}
                      <div className="flex gap-2 sm:gap-3 justify-center">
                        <button
                          onClick={startGame}
                          className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white px-3 sm:px-4 md:px-6 py-2 rounded-lg font-semibold transition-colors flex items-center gap-1 sm:gap-2 text-xs sm:text-sm md:text-base touch-manipulation"
                        >
                          <Play className="w-4 h-4" />
                          Try Again
                        </button>
                        <button
                          onClick={resetGame}
                          className="bg-gray-600 hover:bg-gray-700 active:bg-gray-800 text-white px-3 sm:px-4 md:px-6 py-2 rounded-lg font-semibold transition-colors flex items-center gap-1 sm:gap-2 text-xs sm:text-sm md:text-base touch-manipulation"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Reset
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Controls Info */}
        <div className="bg-gray-50 px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-center border-t border-gray-200">
          <div className="text-xs sm:text-sm text-gray-600">
            <span className="hidden sm:inline">Use ← → arrow keys or </span>
            <span className="font-semibold">Swipe left/right</span> to move • 
            <span className="hidden sm:inline"> Catch waste in center - edge hits deflect!</span>
            <span className="sm:hidden"> Center catches only!</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlogRunGame;