// ===== СИСТЕМА УПРАВЛЕНИЯ ЗВУКОМ =====

class SoundManager {
  constructor() {
    this.sounds = {};
    this.musicTracks = [];
    this.currentMusicIndex = 0;
    this.musicVolume = 0.3;
    this.sfxVolume = 0.7;
    this.musicEnabled = true;
    this.sfxEnabled = true;
    this.musicPlaying = false;
    this.audioPrimed = false;

    this.init();
  }

  init() {
    // Загружаем сохраненные настройки
    this.loadSettings();

    // Создаем элементы управления звуком
    this.createSoundControls();

    // Настраиваем разблокировку аудио
    this.setupAudioUnlock();

    // Загружаем звуки
    this.loadSounds();
  }

  createSoundControls() {
    // Создаем контейнер для кнопок управления звуком
    const soundControls = document.createElement('div');
    soundControls.className = 'sound-controls';
    soundControls.innerHTML = `
      <button id="musicToggle" class="sound-btn" title="Музыка">
        <span class="sound-icon">🎵</span>
      </button>
      <button id="sfxToggle" class="sound-btn" title="Звуки">
        <span class="sound-icon">🔊</span>
      </button>
    `;

    // Добавляем в правый верхний угол
    document.body.appendChild(soundControls);

    // Подключаем обработчики
    const musicBtn = document.getElementById('musicToggle');
    const sfxBtn = document.getElementById('sfxToggle');

    musicBtn.addEventListener('click', () => this.toggleMusic());
    sfxBtn.addEventListener('click', () => this.toggleSFX());

    this.musicButton = musicBtn;
    this.sfxButton = sfxBtn;
    this.updateSoundButtons();
  }

  updateSoundButtons() {
    if (this.musicButton) {
      this.musicButton.classList.toggle('disabled', !this.musicEnabled);
      this.musicButton.querySelector('.sound-icon').textContent = this.musicEnabled ? '🎵' : '🎵';
    }
    if (this.sfxButton) {
      this.sfxButton.classList.toggle('disabled', !this.sfxEnabled);
      this.sfxButton.querySelector('.sound-icon').textContent = this.sfxEnabled ? '🔊' : '🔇';
    }
  }

  loadSounds() {
    // Загружаем основные звуки
    this.sounds = {
      achievement: document.getElementById('sound-achievement'),
      crit: document.getElementById('sound-crit'),
    };

    // Подготавливаем аудио элементы
    Object.values(this.sounds).forEach((audio) => {
      if (!audio) return;
      audio.preload = 'auto';
      audio.volume = this.sfxVolume;
      if (typeof audio.load === 'function') {
        try { audio.load(); } catch (err) {
          console.warn('Не удалось подготовить звук', err);
        }
      }
    });

    // Загружаем музыку из папки
    this.loadMusicTracks();
  }

  loadMusicTracks() {
    // Загружаем плейлист из JSON файла
    fetch('./playlist.json')
      .then(response => response.json())
      .then(data => {
        if (data.musicTracks && Array.isArray(data.musicTracks)) {
          this.musicTracks = data.musicTracks.map(track => track.src);
          this.musicSettings = data.settings || {};

          // Применяем настройки из JSON
          if (this.musicSettings.volume !== undefined) {
            this.musicVolume = this.musicSettings.volume;
          }
          if (this.musicSettings.shuffle !== undefined) {
            this.shuffleEnabled = this.musicSettings.shuffle;
          }

          this.initMusicPlayer();
        } else {
          console.warn('Неверный формат плейлиста в JSON');
          this.initMusicPlayer();
        }
      })
      .catch(err => {
        console.warn('Не удалось загрузить плейлист:', err);
        // Fallback: проверяем аудио элементы в HTML
        this.musicTracks = [];
        const musicElements = document.querySelectorAll('audio[id^="music-"]');
        musicElements.forEach(audio => {
          if (audio.src) {
            this.musicTracks.push(audio.src);
          }
        });
        this.initMusicPlayer();
      });
  }

  initMusicPlayer() {
    if (this.musicTracks.length > 0) {
      this.createMusicPlayer();
      // Don't auto-start music - wait for splash screen to trigger it
      // if (this.musicEnabled) {
      //   this.startMusic();
      // }
    }
  }

  createMusicPlayer() {
    // Создаем аудио элемент для музыки
    this.musicAudio = new Audio();
    this.musicAudio.volume = this.musicVolume;
    this.musicAudio.loop = false; // Не зацикливаем, переключаем треки
    this.musicAudio.preload = 'auto';

    this.musicAudio.addEventListener('ended', () => {
      this.playNextTrack();
    });

    this.musicAudio.addEventListener('error', (e) => {
      console.warn('Ошибка воспроизведения музыки:', e);
      this.playNextTrack();
    });
  }

  playNextTrack() {
    if (this.musicTracks.length === 0) return;

    this.currentMusicIndex = (this.currentMusicIndex + 1) % this.musicTracks.length;
    this.musicAudio.src = this.musicTracks[this.currentMusicIndex];

    if (this.musicEnabled && this.musicPlaying) {
      this.musicAudio.play().catch(err => {
        console.warn('Не удалось воспроизвести музыкальный трек:', err);
      });
    }
  }

  startMusic() {
    if (this.musicTracks.length === 0 || !this.musicEnabled) return;

    this.musicPlaying = true;
    this.currentMusicIndex = Math.floor(Math.random() * this.musicTracks.length);
    this.musicAudio.src = this.musicTracks[this.currentMusicIndex];

    this.musicAudio.play().then(() => {
      this.playNextTrack();
    }).catch(err => {
      console.warn('Не удалось запустить музыку:', err);
    });
  }

  stopMusic() {
    this.musicPlaying = false;
    if (this.musicAudio) {
      this.musicAudio.pause();
      this.musicAudio.currentTime = 0;
    }
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    this.updateSoundButtons();

    if (this.musicEnabled) {
      if (this.musicTracks.length > 0) {
        this.startMusic();
      }
    } else {
      this.stopMusic();
    }

    // Сохраняем настройки
    this.saveSettings();
  }

  toggleSFX() {
    this.sfxEnabled = !this.sfxEnabled;
    this.updateSoundButtons();

    // Обновляем громкость всех звуков
    Object.values(this.sounds).forEach(audio => {
      if (audio) {
        audio.volume = this.sfxEnabled ? this.sfxVolume : 0;
      }
    });

    // Сохраняем настройки
    this.saveSettings();
  }

  playSound(soundName) {
    if (!this.sfxEnabled) return;

    const audio = this.sounds[soundName];
    if (!audio) return;

    try {
      audio.currentTime = 0;
      audio.volume = this.sfxVolume;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    } catch (err) {
      console.warn('Не удалось воспроизвести звук', err);
    }
  }

  primeAudioPlayback() {
    if (this.audioPrimed) return;
    this.audioPrimed = true;

    Object.values(this.sounds).forEach((audio) => {
      if (!audio) return;
      const wasMuted = audio.muted;
      audio.muted = true;
      try {
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.then === 'function') {
          playPromise
            .then(() => {
              audio.pause();
              audio.currentTime = 0;
              audio.muted = wasMuted;
            })
            .catch(() => {
              if (typeof audio.pause === 'function') {
                try { audio.pause(); } catch {}
              }
              audio.currentTime = 0;
              audio.muted = wasMuted;
            });
        } else {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = wasMuted;
        }
      } catch (err) {
        if (typeof audio.pause === 'function') {
          try { audio.pause(); } catch {}
        }
        audio.currentTime = 0;
        audio.muted = wasMuted;
      }
    });
  }

  setupAudioUnlock() {
    const unlock = () => {
      this.primeAudioPlayback();
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
  }

  saveSettings() {
    try {
      const settings = {
        musicEnabled: this.musicEnabled,
        sfxEnabled: this.sfxEnabled,
        musicVolume: this.musicVolume,
        sfxVolume: this.sfxVolume
      };
      localStorage.setItem('yasakClickerSoundSettings', JSON.stringify(settings));
    } catch (e) {
      console.warn('Не удалось сохранить настройки звука:', e);
    }
  }

  loadSettings() {
    try {
      const settings = JSON.parse(localStorage.getItem('yasakClickerSoundSettings') || '{}');
      this.musicEnabled = settings.musicEnabled !== undefined ? settings.musicEnabled : true;
      this.sfxEnabled = settings.sfxEnabled !== undefined ? settings.sfxEnabled : true;
      this.musicVolume = settings.musicVolume !== undefined ? settings.musicVolume : 0.3;
      this.sfxVolume = settings.sfxVolume !== undefined ? settings.sfxVolume : 0.7;
    } catch (e) {
      console.warn('Не удалось загрузить настройки звука:', e);
    }
  }
}

// Создаем глобальный экземпляр
const soundManager = new SoundManager();

// Экспортируем функции для обратной совместимости
function playSound(soundName) {
  soundManager.playSound(soundName);
}

function primeAudioPlayback() {
  soundManager.primeAudioPlayback();
}

function setupAudioUnlock() {
  soundManager.setupAudioUnlock();
}
