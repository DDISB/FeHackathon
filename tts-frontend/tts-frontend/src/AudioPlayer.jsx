import React, { useState, useRef, useEffect } from 'react';
import './AudioPlayer.css';

const AudioPlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(120); // 2:00 в секундах
  const audioRef = useRef(null);

  // Обработчик изменения времени воспроизведения
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
    };
  }, []);

  // Форматирование времени в мм:сс
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Переключение воспроизведения/паузы
  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Обработчик изменения позиции прогресс-бара
  const handleProgressChange = (e) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = (e.target.value / 100) * duration;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Расчет прогресса в процентах
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="audio-player">
      {/* Скрытый audio элемент */}
      <audio
        ref={audioRef}
        src="/path-to-your-audio-file.mp3" // Замените на ваш путь к аудиофайлу
        preload="metadata"
      />
      
      {/* Заголовок */}
      <div className="audio-title">
        <h3>Аудио 1 — Список сокращений</h3>
      </div>

      {/* Чекбокс */}
      <div className="audio-checkbox">
        <input type="checkbox" id="audio-check" />
        <label htmlFor="audio-check"></label>
      </div>

      {/* Основные элементы управления */}
      <div className="audio-controls">
        {/* Кнопка воспроизведения/паузы */}
        <button 
          className={`play-pause-btn ${isPlaying ? 'playing' : ''}`}
          onClick={togglePlayPause}
          aria-label={isPlaying ? 'Пауза' : 'Воспроизведение'}
        >
          <span className="play-icon">▶</span>
          <span className="pause-icon">❚❚</span>
        </button>

        {/* Прогресс-бар */}
        <div className="progress-container">
          <input
            type="range"
            className="progress-bar"
            min="0"
            max="100"
            value={progress}
            onChange={handleProgressChange}
            aria-label="Прогресс воспроизведения"
          />
        </div>

        {/* Время */}
        <div className="time-display">
          <span>{formatTime(currentTime)}/{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;