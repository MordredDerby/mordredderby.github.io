// ===== SPLASH SCREEN SYSTEM =====

class SplashScreen {
  constructor() {
    this.splashScreen = document.getElementById('splashScreen');
    this.mainGame = document.getElementById('mainGame');
    this.startButton = document.getElementById('startButton');
    this.loadingFill = document.querySelector('.loading-fill');
    this.loadingText = document.querySelector('.loading-text');

    this.assets = [
      // Background image
      'assets/images/Тайга.jpg',
      // Music tracks
      'assets/sounds/music/Through the Frosted Pines.mp3',
      'assets/sounds/music/Through the Frosted Pines (1).mp3',
      'assets/sounds/music/Whispers of the Tundra.mp3',
      'assets/sounds/music/Whispers of the Tundra (1).mp3',
      'assets/sounds/music/Untitled.mp3',
      'assets/sounds/music/Untitled (1).mp3',
      'assets/sounds/music/Untitled (2).mp3',
      // Sound effects
      'assets/sounds/bell.wav',
      'assets/sounds/bark.mp3',
      // Character sprite
      'assets/images/strelets.png'
    ];

    this.loadedAssets = 0;
    this.totalAssets = this.assets.length;

    this.init();
  }

  init() {
    // Start preloading assets
    this.preloadAssets();

    // Set up start button
    this.startButton.addEventListener('click', () => this.startGame());

    // Prevent context menu on right click during splash
    this.splashScreen.addEventListener('contextmenu', (e) => e.preventDefault());

    // Add keyboard support
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (!this.startButton.disabled) {
          this.startGame();
        }
      }
    });
  }

  preloadAssets() {
    this.updateLoadingProgress(0, 'Инициализация...');

    const loadPromises = this.assets.map((asset, index) => {
      return new Promise((resolve) => {
        const isImage = asset.endsWith('.jpg') || asset.endsWith('.png') || asset.endsWith('.svg');
        const isAudio = asset.endsWith('.mp3') || asset.endsWith('.wav');

        if (isImage) {
          const img = new Image();
          img.onload = () => {
            this.loadedAssets++;
            this.updateLoadingProgress(this.loadedAssets / this.totalAssets, `Загружено ${this.loadedAssets}/${this.totalAssets}`);
            resolve();
          };
          img.onerror = () => {
            console.warn(`Failed to preload image: ${asset}`);
            this.loadedAssets++;
            this.updateLoadingProgress(this.loadedAssets / this.totalAssets, `Ошибка загрузки ${asset}, продолжаем...`);
            resolve();
          };
          img.src = asset;
        } else if (isAudio) {
          const audio = new Audio();
          audio.preload = 'auto';
          audio.oncanplaythrough = () => {
            this.loadedAssets++;
            this.updateLoadingProgress(this.loadedAssets / this.totalAssets, `Загружено ${this.loadedAssets}/${this.totalAssets}`);
            resolve();
          };
          audio.onerror = () => {
            console.warn(`Failed to preload audio: ${asset}`);
            this.loadedAssets++;
            this.updateLoadingProgress(this.loadedAssets / this.totalAssets, `Ошибка загрузки ${asset}, продолжаем...`);
            resolve();
          };
          audio.src = asset;
        } else {
          // For other assets, just count them as loaded
          setTimeout(() => {
            this.loadedAssets++;
            this.updateLoadingProgress(this.loadedAssets / this.totalAssets, `Загружено ${this.loadedAssets}/${this.totalAssets}`);
            resolve();
          }, 100);
        }
      });
    });

    // When all assets are loaded (or failed to load)
    Promise.allSettled(loadPromises).then(() => {
      this.finishLoading();
    });
  }

  updateLoadingProgress(progress, text) {
    const percentage = Math.round(progress * 100);
    this.loadingFill.style.width = `${percentage}%`;
    this.loadingText.textContent = text || `Загрузка... ${percentage}%`;
  }

  finishLoading() {
    this.updateLoadingProgress(1, 'Готово! Нажмите для начала игры');

    // Enable start button
    this.startButton.disabled = false;
    this.startButton.style.cursor = 'pointer';
    this.startButton.style.opacity = '1';

    // Add pulse animation to start button
    this.startButton.style.animation = 'startButtonPulse 1.5s ease-in-out infinite';

    // Add CSS for pulse animation
    if (!document.querySelector('#splash-animations')) {
      const style = document.createElement('style');
      style.id = 'splash-animations';
      style.textContent = `
        @keyframes startButtonPulse {
          0%, 100% {
            transform: translateY(-3px) scale(1.05);
            box-shadow: 0 0 30px rgba(212, 175, 55, 0.5), 0 8px 25px rgba(0, 0, 0, 0.3);
          }
          50% {
            transform: translateY(-5px) scale(1.08);
            box-shadow: 0 0 40px rgba(212, 175, 55, 0.7), 0 12px 30px rgba(0, 0, 0, 0.4);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  startGame() {
    if (this.startButton.disabled) return;

    // Disable start button
    this.startButton.disabled = true;
    this.startButton.style.animation = 'none';
    this.startButton.textContent = 'ЗАПУСК...';

    // Start background music before transition
    if (typeof soundManager !== 'undefined') {
      soundManager.startMusic();
    }

    // Fade out splash screen
    this.splashScreen.style.opacity = '0';

    // Show main game after fade out
    setTimeout(() => {
      this.splashScreen.classList.add('hidden');
      this.mainGame.classList.remove('hidden');

      // Add game-loaded class to show sound controls
      document.body.classList.add('game-loaded');

      // Fade in main game
      setTimeout(() => {
        this.mainGame.style.opacity = '1';

        // Initialize main game
        if (typeof init === 'function') {
          init();
        }
      }, 100);
    }, 1000);
  }
}

// Initialize splash screen when DOM is ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  new SplashScreen();
} else {
  document.addEventListener('DOMContentLoaded', () => {
    new SplashScreen();
  });
}
