import express, { Request, Response } from 'express';
import axios from 'axios';
import { API_CONFIG } from './config/api';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.text({ type: 'text/plain', limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Конфигурация
const CONFIG = {
  API_KEY: API_CONFIG.API_KEY,
  FOLDER_ID: API_CONFIG.FOLDER_ID,
  TTS_URL: 'https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize'
};

console.log(CONFIG.API_KEY)
console.log(CONFIG.FOLDER_ID)

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

app.post('/synthesize-form', async (req: Request, res: Response) => {
  try {   
    const { text, voice = 'zaermilhar', emotion = '' } = req.body;

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

    const requestData = new URLSearchParams({
      text: trimmedText,
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

    const audioBuffer = Buffer.from(response.data);
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
});

export default app;