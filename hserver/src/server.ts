import express, { Request, Response } from 'express';
import axios from 'axios';
import { API_CONFIG } from './config/api';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.text({ limit: '5mb' }));

// Конфигурация
const CONFIG = {
  API_KEY: API_CONFIG.API_KEY,
  FOLDER_ID: API_CONFIG.FOLDER_ID,
  TTS_URL: 'https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize'
};

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
    // Ошибка от Yandex API
    return {
      type: 'yandex_api_error',
      status: error.response.status,
      statusText: error.response.statusText,
      data: typeof error.response.data === 'object' 
        ? { message: error.response.data.message || String(error.response.data) }
        : String(error.response.data)
    };
  } else if (error.request) {
    // Сетевая ошибка
    return {
      type: 'network_error',
      message: error.message
    };
  } else {
    // Другие ошибки
    return {
      type: 'internal_error',
      message: error.message
    };
  }
}

app.post('/synthesize', async (req: Request, res: Response) => {
  try {
    const text = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ 
        error: 'Text is required and must be a string' 
      });
    }

    if (Buffer.byteLength(text, 'utf8') > 5 * 1024 * 1024) {
      return res.status(413).json({ 
        error: 'Text exceeds 5MB limit' 
      });
    }

    console.log(`Synthesizing text length: ${text.length} characters`);

    console.log(CONFIG.API_KEY)
    console.log(CONFIG.FOLDER_ID)

    const response = await axios({
      method: 'post',
      url: CONFIG.TTS_URL,
      headers: {
        'Authorization': `Api-Key ${CONFIG.API_KEY}`
        // 'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: new URLSearchParams({
        folderId: CONFIG.FOLDER_ID,
        lang: 'ru-RU',
        text: text,
        voice: 'alena',
        format: 'mp3',
        sampleRateHertz: '24000'
      }),
      responseType: 'stream'
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="speech.mp3"');
    response.data.pipe(res);

  } catch (error: any) {
    console.error('TTS Error occurred');
    
    // Безопасное извлечение информации об ошибке
    const errorInfo = getSafeErrorInfo(error);
    
    // Логируем детали для отладки
    console.error('Error details:', JSON.stringify(errorInfo));
    
    // Отправляем безопасный ответ
    if (errorInfo.type === 'yandex_api_error') {
      res.status(errorInfo.status).json({
        error: 'TTS service error',
        details: errorInfo
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        details: errorInfo
      });
    }
  }
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    config: {
      hasApiKey: !!CONFIG.API_KEY && CONFIG.API_KEY !== 'your_yandex_api_key_here',
      hasFolderId: !!CONFIG.FOLDER_ID && CONFIG.FOLDER_ID !== 'your_folder_id_here'
    }
  });
});

// Глобальный обработчик ошибок для предотвращения падения сервера
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.listen(PORT, () => {
  console.log(`TTS Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

export default app;