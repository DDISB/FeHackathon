// src/App.tsx
import React, { useEffect, useMemo, useState } from "react";
import './styles.css';
import './AudioPlayer.css';

// ---------------- Types from backend ----------------
export type Chapter = {
  index: number;
  title: string;
  words: number;
  minutes: number;
  audioFile: string;
  audioPath: string;
};

export type RecordListItem = {
  id: string;
  index: number;
  originalName: string;
  chapterCount: number;
  createdAt: string;
};

export type RecordDetail = {
  id: string;
  index: number;
  originalName: string;
  chapterCount: number;
  createdAt: string;
  chapters: Chapter[];
};

// ---------------- Audio Player Component ----------------
const AudioPlayer: React.FC<{ src: string; title: string }> = ({ src, title }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  const playbackRates = [
    { value: 0.5, label: '0.5x' },
    { value: 0.75, label: '0.75x' },
    { value: 1, label: '1x' },
    { value: 1.25, label: '1.25x' },
    { value: 1.5, label: '1.5x' },
    { value: 2, label: '2x' }
  ];

  // Инициализация и обновление времени
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      setDuration(audio.duration);
      setIsLoaded(true);
    };
    const handleEnded = () => setIsPlaying(false);
    const handleLoadStart = () => setIsLoaded(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadstart', handleLoadStart);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadstart', handleLoadStart);
    };
  }, [src]);

  // Форматирование времени в мм:сс
  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
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
      audio.play().catch(error => {
        console.error("Error playing audio:", error);
      });
    }
    setIsPlaying(!isPlaying);
  };

  // Обработчик изменения позиции прогресс-бара
  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = (parseFloat(e.target.value) / 100) * duration;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Изменение скорости воспроизведения
  const handleSpeedChange = (rate: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  };

  // Скачивание аудиофайла
  const handleDownload = async () => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Получаем имя файла из URL или используем заголовок
      const fileName = src.split('/').pop() || `${title.replace(/[^a-zA-Z0-9]/g, '_')}.mp3`;
      link.download = fileName;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      // Fallback: открываем в новой вкладке если скачивание не работает
      window.open(src, '_blank');
    }
  };

  // Закрытие меню скорости при клике вне его
  React.useEffect(() => {
    const handleClickOutside = () => {
      setShowSpeedMenu(false);
    };

    if (showSpeedMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [showSpeedMenu]);

  // Расчет прогресса в процентах
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="audio-player">
      {/* Скрытый audio элемент */}
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
      />
      
      {/* Заголовок */}
      <div className="audio-title">
        <h4>{title}</h4>
      </div>

      {/* Основные элементы управления */}
      <div className="audio-controls">
        {/* Кнопка воспроизведения/паузы */}
        <button 
          className={`play-pause-btn ${isPlaying ? 'playing' : ''}`}
          onClick={togglePlayPause}
          disabled={!isLoaded}
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
            value={isLoaded ? progress : 0}
            onChange={handleProgressChange}
            disabled={!isLoaded}
            aria-label="Прогресс воспроизведения"
          />
        </div>

        {/* Время */}
        <div className="time-display">
          <span>
            {isLoaded ? `${formatTime(currentTime)} / ${formatTime(duration)}` : "Загрузка..."}
          </span>
        </div>

        {/* Кнопка скорости с выпадающим меню */}
        <div className="speed-menu-container">
          <button 
            className="speed-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowSpeedMenu(!showSpeedMenu);
            }}
            disabled={!isLoaded}
            aria-label={`Скорость воспроизведения: ${playbackRate}x`}
            title="Изменить скорость"
          >
            {playbackRate}x
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="speed-chevron">
              <path d="M7 10l5 5 5-5z"/>
            </svg>
          </button>

          {showSpeedMenu && (
            <div className="speed-menu" onClick={(e) => e.stopPropagation()}>
              {playbackRates.map((rate) => (
                <button
                  key={rate.value}
                  className={`speed-menu-item ${playbackRate === rate.value ? 'active' : ''}`}
                  onClick={() => handleSpeedChange(rate.value)}
                >
                  {rate.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Кнопка скачивания */}
        <button 
          className="download-btn"
          onClick={handleDownload}
          disabled={!isLoaded}
          aria-label="Скачать аудиофайл"
          title="Скачать"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

// ---------------- Helpers ----------------
const toApi = (p: string) => `https://hakaton-privalenkov.amvera.io${p.startsWith("/") ? p : `/${p}`}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleString();

// Функция для нормализации русских букв в поиске
const normalizeRussianText = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[ё]/g, 'е')
    .replace(/[ъь]/g, '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // удаляем диакритические знаки
};

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// Новая функция для загрузки файлов с FormData
async function uploadFile(url: string, formData: FormData): Promise<{ id: string }> {
  const res = await fetch(url, {
    method: "POST",
    body: formData,
    // Не устанавливаем Content-Type вручную для FormData - браузер сделает это сам с boundary
  });
  
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  
  return res.json();
}

// ---------------- Modal Component ----------------
const UploadModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (id: string) => void;
}> = ({ isOpen, onClose, onUploadSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const canSubmit = useMemo(() => {
    return !uploading && !!file;
  }, [uploading, file]);

  const resetForm = () => {
    setFile(null);
    setError(null);
    setDragOver(false);
    setUploadProgress(0);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validateFile = (file: File | null): string | null => {
    if (!file) return "Файл не выбран";
    
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    const allowedExtensions = ['.pdf', '.docx', '.txt'];
    
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension || '')) {
      return "Допустимы только файлы PDF, DOCX и TXT";
    }
    
    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      return "Файл слишком большой (максимум 50MB)";
    }
    
    return null;
  };

  const handleFileSelect = (selectedFile: File | null) => {
    setFile(selectedFile);
    setError(null);
    
    if (selectedFile) {
      const validationError = validateFile(selectedFile);
      if (validationError) {
        setError(validationError);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    handleFileSelect(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const removeFile = () => {
    setFile(null);
    setError(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Валидация
    const fileError = validateFile(file);
    if (fileError) {
      setError(fileError);
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    
    try {
      const fd = new FormData();
      
      if (file) {
        fd.append("file", file);
      }
      
      // Фиксированные значения
      fd.append("voice", "ermil");
      fd.append("role", "neutral");
      
      console.log("Отправка данных:", {
        fileName: file?.name
      });

      // Имитация прогресса загрузки
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Используем новую функцию для загрузки
      const result = await uploadFile(toApi("/upload"), fd);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      console.log("Успешный ответ:", result);

      // Небольшая задержка для отображения 100% прогресса
      setTimeout(() => {
        onUploadSuccess(result.id);
        handleClose();
      }, 500);
      
    } catch (e: any) {
      console.error("Ошибка загрузки:", e);
      const errorMessage = e?.message || "Ошибка загрузки";
      setError(errorMessage.includes("Failed to fetch") 
        ? "Ошибка соединения с сервером. Проверьте интернет-соединение." 
        : errorMessage
      );
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Создать аудиодокумент</h2>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>
        
        <form onSubmit={onSubmit}>
          {error && (
            <div className="error-message" style={{ margin: '10px 0', padding: '10px', background: '#fee', color: '#c33', borderRadius: '4px' }}>
              ⚠️ {error}
            </div>
          )}

          <div className="form-field">
            <div className="file-upload-container">
              <input 
                type="file" 
                id="file-upload"
                accept=".pdf,.docx,.txt" 
                onChange={handleFileChange}
                className="file-upload-input"
                disabled={uploading}
              />
              
              {!file ? (
                <label 
                  htmlFor="file-upload"
                  className={`file-upload-label ${dragOver ? 'drag-over' : ''} ${error ? 'file-upload-error' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <svg className="file-upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14,2 14,8 20,8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10,9 9,9 8,9" />
                  </svg>
                  
                  <div className="file-upload-text">
                    <div className="file-upload-title">Выберите файл или перетащите его сюда</div>
                    <div className="file-upload-subtitle">Поддерживаются PDF, DOCX, TXT файлы</div>
                  </div>
                  
                  <div className="file-upload-formats">Макс. размер: 50MB</div>
                  
                  <div className="file-upload-btn">
                    Выбрать файл
                  </div>
                </label>
              ) : (
                <div className="file-info">
                  <svg className="file-info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14,2 14,8 20,8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10,9 9,9 8,9" />
                  </svg>
                  
                  <div className="file-info-content">
                    <div className="file-info-name">{file.name}</div>
                    <div className="file-info-size">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                  
                  {!uploading && (
                    <button 
                      type="button" 
                      className="file-remove-btn"
                      onClick={removeFile}
                      aria-label="Удалить файл"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>

            {uploading && (
              <div className="upload-progress">
                <div className="progress-bar-container">
                  <div 
                    className="progress-bar-fill" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <div className="progress-text">
                  {uploadProgress < 100 ? 'Загрузка...' : 'Обработка...'} {uploadProgress}%
                </div>
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={handleClose}
              disabled={uploading}
            >
              Отмена
            </button>
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={!canSubmit || uploading}
            >
              {uploading && <span className="upload-loading"></span>}
              {uploading ? "Обработка…" : "Создать аудио"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ---------------- Main App ----------------
export default function App() {
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [filterMode, setFilterMode] = useState<"my" | "all">("my");
  const [searchQuery, setSearchQuery] = useState("");

  const [list, setList] = useState<RecordListItem[] | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listErr, setListErr] = useState<string | null>(null);

  const [record, setRecord] = useState<RecordDetail | null>(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordErr, setRecordErr] = useState<string | null>(null);

  useEffect(() => {
    const m = location.hash.match(/id=([^&]+)/);
    if (m && m[1]) {
      const id = decodeURIComponent(m[1]);
      setSelectedRecordId(id);
      openRecord(id);
    }
  }, []);

  const loadList = async () => {
    setListLoading(true);
    setListErr(null);
    try {
      const data = await fetchJSON<{ items: RecordListItem[] }>(toApi("/records"));
      setList(data.items);
    } catch (e: any) {
      setListErr(e?.message || "Не удалось загрузить список");
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    loadList();
  }, []);

  const openRecord = async (id: string) => {
    setSelectedRecordId(id);
    window.location.hash = `#id=${encodeURIComponent(id)}`;
    setRecord(null);
    setRecordErr(null);
    setRecordLoading(true);
    try {
      const data = await fetchJSON<RecordDetail>(toApi(`/records/${id}`));
      setRecord(data);
    } catch (e: any) {
      setRecordErr(e?.message || "Не удалось получить запись");
    } finally {
      setRecordLoading(false);
    }
  };

  const handleUploadSuccess = (id: string) => {
    loadList();
    openRecord(id);
  };

  const filteredList = useMemo(() => {
    if (!list) return null;
    if (!searchQuery.trim()) return list;
    
    const normalizedQuery = normalizeRussianText(searchQuery);
    return list.filter(item => {
      const normalizedName = normalizeRussianText(item.originalName);
      return normalizedName.includes(normalizedQuery);
    });
  }, [list, searchQuery]);

  const CopyBtn: React.FC<{ text: string; label?: string }> = ({ text, label }) => {
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(text);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch {
        prompt("Скопируйте ссылку:", text);
      }
    };

    return (
      <button
        className={`btn-primary ${isCopied ? 'copied' : ''}`}
        type="button"
        onClick={handleCopy}
      >
        {isCopied ? "Скопировано!" : (label || "Copy")}
      </button>
    );
  };

  return (
    <div className="app-container">

      <div className="side-wall-image"></div>
      <header className="app-header">
        <h1>FE-голос</h1>
      </header>

      <div className="app-layout">
        {/* Left Panel - Document List */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="filter-toggle">
              <button 
                className={`filter-toggle-btn ${filterMode === 'my' ? 'active' : ''}`}
                onClick={() => setFilterMode('my')}
              >
                Мои
              </button>
              <button 
                className={`filter-toggle-btn ${filterMode === 'all' ? 'active' : ''}`}
                onClick={() => setFilterMode('all')}
              >
                Все
              </button>
            </div>
            <div className="search-container">
              <input
                type="text"
                placeholder="Поиск"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
            <button 
              className="btn-primary" 
              onClick={() => setShowUploadModal(true)}
            >
              + Добавить файл
            </button>
          </div>

          {/* Header row for document list */}
          <div className="document-list-header">
            <div className="header-number">№</div>
            <div className="header-name">Название</div>
            <div className="header-audio">Аудио</div>
          </div>

          <div className="document-list-container">
            {listLoading && <div className="loading">Загрузка…</div>}
            {listErr && <div className="error-message">⚠️ {listErr}</div>}
            
            {!listLoading && !listErr && filteredList && filteredList.length === 0 && (
              <div className="empty-state">
                <p>{searchQuery ? "Ничего не найдено" : "Пока пусто. Загрузите первый документ."}</p>
              </div>
            )}

            {filteredList && filteredList.length > 0 && (
              <div className="document-list">
                {filteredList.map((it) => (
                  <div 
                    key={it.id} 
                    className={`document-item ${selectedRecordId === it.id ? 'selected' : ''}`}
                    onClick={() => openRecord(it.id)}
                  >
                    <div className="document-number">{it.index}</div>
                    <div className="document-info">
                      <h3 className="document-title" title={it.originalName}>
                        {it.originalName}
                      </h3>
                      <div className="document-meta">
                        <span className="created-date">{fmtDate(it.createdAt)}</span>
                      </div>
                    </div>
                    <div className="document-audio-count">{it.chapterCount}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Right Panel - Record Details */}
        <main className="content">
          <div className="content-card">
            {!selectedRecordId ? (
              <div className="empty-content">
                <h2>Выберите документ</h2>
                <p>Выберите документ из списка слева чтобы просмотреть детали и прослушать аудио</p>
              </div>
            ) : (
              <>
                

                {recordLoading && <div className="loading">Загрузка…</div>}
                {recordErr && <div className="error-message">⚠️ {recordErr}</div>}

                {record && (
                  <div className="record-info">
                    <div className="content-header">
                      <h2>{record.originalName}</h2>
                      {record && (
                        <CopyBtn 
                        text={`${location.origin}${location.pathname}#id=${encodeURIComponent(record.id)}`} 
                        label="Поделиться" 
                        />
                      )}
                    </div>
                    <div className="record-meta">
                      </div>
                    
                    <div className="chapters-section">
                      <ol className="chapters-list">
                        {record.chapters.map((ch) => {
                          const src = toApi(ch.audioPath);
                          return (
                            <li key={ch.index} className="chapter-item">
                              <AudioPlayer 
                                src={src}
                                title={`Глава ${ch.index}: ${ch.title}`}
                              />
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      <UploadModal 
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadSuccess={handleUploadSuccess}
      />
    </div>
  );
}