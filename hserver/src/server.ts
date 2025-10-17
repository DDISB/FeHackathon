import express, { Request, Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import { API_CONFIG } from './config/api';
import path from 'path';
import multer from 'multer';
const pdfParse = require('pdf-parse');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.text({ type: 'text/plain', limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  if (req.headers['content-type'] && req.headers['content-type'].startsWith('multipart/form-data')) {
    // Multer будет обрабатывать это
    next();
  } else {
    // Другие парсеры обработают это
    next();
  }
});

// Настройка multer для загрузки файлов
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1 * 1024 * 1024, // 1 MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Конфигурация
const CONFIG = {
  API_KEY: API_CONFIG.API_KEY,
  FOLDER_ID: API_CONFIG.FOLDER_ID,
  TTS_URL: 'https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize'
};


// Создаем папку audio если её нет
const AUDIO_DIR = path.join(__dirname, 'audio');
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  console.log(`Created audio directory: ${AUDIO_DIR}`);
}

// Проверка API ключей
if (!CONFIG.API_KEY || CONFIG.API_KEY === 'your_yandex_api_key_here') {
  console.error('ERROR: API_KEY not configured! Check src/config/api.ts');
  process.exit(1);
}

if (!CONFIG.FOLDER_ID || CONFIG.FOLDER_ID === 'your_folder_id_here') {
  console.error('ERROR: FOLDER_ID not configured! Check src/config/api.ts');
  process.exit(1);
}

// Функция для безопасного извлечения информации об ошибке
function getSafeErrorInfo(error: any) {
  if (error.response) {
    let errorData = error.response.data;
    let message = 'Unknown API error';
    
    if (typeof errorData === 'string') {
      try {
        const parsed = JSON.parse(errorData);
        message = parsed.message || parsed.error || message;
      } catch {
        message = errorData;
      }
    } else if (errorData && typeof errorData === 'object') {
      message = errorData.message || errorData.error || JSON.stringify(errorData);
    }
    
    return {
      type: 'yandex_api_error',
      status: error.response.status,
      statusText: error.response.statusText,
      message: message
    };
  } else if (error.request) {
    return {
      type: 'network_error',
      message: error.message
    };
  } else {
    return {
      type: 'internal_error',
      message: error.message
    };
  }
}

// Функция для сохранения аудиофайла
function saveAudioToFile(audioBuffer: Buffer, text: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `tts_${timestamp}.mp3`;
  const filepath = path.join(AUDIO_DIR, filename);
  
  fs.writeFileSync(filepath, audioBuffer);
  console.log(`Audio saved: ${filepath}`);
  return filepath;
}

// Функция для парсинга PDF
async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    
    if (!data.text || data.text.trim().length === 0) {
      throw new Error('PDF file does not contain any extractable text');
    }
    
    // Очищаем текст от лишних пробелов и переносов строк
    const cleanedText = data.text
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log(`PDF parsed successfully. Text length: ${cleanedText.length} characters`);
    
    return cleanedText;
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Функция для синтеза речи
async function synthesizeSpeech(text: string, voice: string = 'ermil', emotion: string = ''): Promise<Buffer> {
  const requestData = new URLSearchParams({
    text: text,
    lang: 'ru-RU',
    voice: voice,
    format: 'mp3',
    emotion: emotion,
    folderId: CONFIG.FOLDER_ID
  });

  const response = await axios({
    method: 'post',
    url: CONFIG.TTS_URL,
    headers: {
      'Authorization': `Bearer ${CONFIG.API_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'x-folder-id': CONFIG.FOLDER_ID
    },
    data: requestData,
    responseType: 'arraybuffer',
    timeout: 30000
  });

  return Buffer.from(response.data);
}

// Существующий эндпоинт для текста
app.post('/synthesize-form', async (req: Request, res: Response) => {
  try {   
    const { text, voice = 'zahar', emotion = '' } = req.body;

    // Валидация
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ 
        error: 'Text parameter is required and must be a string' 
      });
    }

    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
      return res.status(400).json({ 
        error: 'Text cannot be empty or whitespace only' 
      });
    }

    if (trimmedText.length > 5000) {
      return res.status(400).json({ 
        error: 'Text too long. Maximum 5000 characters allowed.' 
      });
    }

    // Доступные голоса для проверки
    const availableVoices = ['zahar', 'ermil', 'jane', 'omazh', 'alena', 'filipp'];
    if (!availableVoices.includes(voice)) {
      return res.status(400).json({ 
        error: `Invalid voice. Available voices: ${availableVoices.join(', ')}` 
      });
    }

    console.log(`Synthesizing from form: "${trimmedText.substring(0, 50)}..." with voice: ${voice}`);

    const audioBuffer = await synthesizeSpeech(trimmedText, voice, emotion);
    const savedFilePath = saveAudioToFile(audioBuffer, trimmedText);
    
    console.log(`Audio response size: ${audioBuffer.length} bytes`);
    console.log(`File saved locally: ${savedFilePath}`);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="speech.mp3"');
    res.send(audioBuffer);

  } catch (error: any) {
    console.error('TTS Error occurred');
    const errorInfo = getSafeErrorInfo(error);
    console.error('Error details:', errorInfo);
    
    if (errorInfo.type === 'yandex_api_error') {
      res.status(errorInfo.status).json({
        error: 'TTS service error',
        message: errorInfo.message,
        status: errorInfo.status
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: errorInfo.message
      });
    }
  }
});

// Новый эндпоинт для PDF файлов
app.post('/synthesize-pdf', upload.single('pdf'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'PDF file is required'
      });
    }

    const { voice = 'ermil', emotion = '' } = req.body;
    
    console.log(`Processing PDF file: ${req.file.originalname}, size: ${req.file.size} bytes`);

    // Парсим PDF
    const text = await parsePDF(req.file.buffer);
    
    // Валидация извлеченного текста
    if (text.length === 0) {
      return res.status(400).json({
        error: 'No text could be extracted from the PDF file'
      });
    }

    if (text.length > 5000) {
      return res.status(400).json({
        error: `Extracted text too long (${text.length} characters). Maximum 5000 characters allowed.`
      });
    }

    // Доступные голоса для проверки
    const availableVoices = ['zahar', 'ermil', 'jane', 'omazh', 'alena', 'filipp'];
    if (!availableVoices.includes(voice)) {
      return res.status(400).json({ 
        error: `Invalid voice. Available voices: ${availableVoices.join(', ')}` 
      });
    }

    console.log(`Synthesizing from PDF: "${text.substring(0, 50)}..." with voice: ${voice}`);

    // Синтезируем речь
    const audioBuffer = await synthesizeSpeech(text, voice, emotion);
    const savedFilePath = saveAudioToFile(audioBuffer, `pdf_${req.file.originalname}`);
    
    console.log(`Audio response size: ${audioBuffer.length} bytes`);
    console.log(`File saved locally: ${savedFilePath}`);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="speech_from_pdf.mp3"');
    res.send(audioBuffer);

  } catch (error: any) {
    console.error('PDF TTS Error occurred');
    
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'File too large. Maximum size is 1MB.'
        });
      }
    }

    const errorInfo = getSafeErrorInfo(error);
    console.error('Error details:', errorInfo);
    
    if (errorInfo.type === 'yandex_api_error') {
      res.status(errorInfo.status).json({
        error: 'TTS service error',
        message: errorInfo.message,
        status: errorInfo.status
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: errorInfo.message
      });
    }
  }
});


// app.get('/health', (req: Request, res: Response) => {
//   // Проверяем существует ли папка audio и можем ли мы в неё писать
//   let audioDirStatus = 'ok';
//   try {
//     const testFile = path.join(AUDIO_DIR, 'test.txt');
//     fs.writeFileSync(testFile, 'test');
//     fs.unlinkSync(testFile);
//   } catch (error) {
//     audioDirStatus = 'error: ' + error;
//   }

//   res.json({ 
//     status: 'OK', 
//     timestamp: new Date().toISOString(),
//     audio_dir: AUDIO_DIR,
//     audio_dir_status: audioDirStatus,
//     config: {
//       hasApiKey: !!CONFIG.API_KEY && CONFIG.API_KEY !== 'your_yandex_api_key_here',
//       hasFolderId: !!CONFIG.FOLDER_ID && CONFIG.FOLDER_ID !== 'your_folder_id_here',
//       apiKeyPrefix: CONFIG.API_KEY?.substring(0, 10) + '...'
//     }
//   });
// });

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.listen(PORT, () => {
  console.log(`TTS Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Audio files will be saved to: ${AUDIO_DIR}`);
  console.log(`PDF to Speech endpoint available at: http://localhost:${PORT}/synthesize-pdf`);
});

export default app;