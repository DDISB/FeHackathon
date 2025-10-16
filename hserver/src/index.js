// const gtts = require('gtts');
// const fs = require('fs');
// const path = require('path');

// // Функция для преобразования текста в речь
// function textToSpeech(text, filename = 'speech.mp3') {
//     return new Promise((resolve, reject) => {
//         try {
//             // Создаем экземпляр gtts с русским языком
//             const speech = new gtts(text, 'ru');
            
//             // Сохраняем в файл
//             speech.save(filename, (err) => {
//                 if (err) {
//                     reject(err);
//                 } else {
//                     console.log(`Аудиофайл сохранен как: ${filename}`);
//                     resolve(filename);
//                 }
//             });
//         } catch (error) {
//             reject(error);
//         }
//     });
// }

// // Функция для проверки существования файла
// function fileExists(filePath) {
//     return fs.existsSync(filePath);
// }

// // Основная функция
// async function main() {
//     const text = 'Привет, мир! Это пример преобразования текста в речь на русском языке.';
//     const outputFile = 'russian_speech.mp3';
    
//     try {
//         console.log('Начинаем преобразование текста в речь...');
//         console.log(`Текст: "${text}"`);
        
//         // Преобразуем текст в речь
//         const result = await textToSpeech(text, outputFile);
        
//         // Проверяем, что файл создан
//         if (fileExists(result)) {
//             const fileSize = fs.statSync(result).size;
//             console.log(`Файл успешно создан! Размер: ${fileSize} байт`);
//             console.log(`Полный путь: ${path.resolve(result)}`);
//         } else {
//             console.log('Ошибка: файл не был создан');
//         }
        
//     } catch (error) {
//         console.error('Произошла ошибка:', error.message);
//     }
// }

// // Альтернативный вариант с потоковой записью
// function textToSpeechStream(text, filename = 'speech_stream.mp3') {
//     return new Promise((resolve, reject) => {
//         try {
//             const speech = new gtts(text, 'ru');
//             const writeStream = fs.createWriteStream(filename);
            
//             speech.stream().pipe(writeStream);
            
//             writeStream.on('finish', () => {
//                 console.log(`Аудиофайл (поток) сохранен как: ${filename}`);
//                 resolve(filename);
//             });
            
//             writeStream.on('error', (err) => {
//                 reject(err);
//             });
            
//         } catch (error) {
//             reject(error);
//         }
//     });
// }

// // Пример использования с разными текстами
// async function multipleExamples() {
//     const examples = [
//         {
//             text: 'Добро пожаловать в наш сервис преобразования текста в речь.',
//             filename: 'welcome.mp3'
//         },
//         {
//             text: 'Сегодня прекрасная погода для прогулки в парке.',
//             filename: 'weather.mp3'
//         },
//         {
//             text: 'Спасибо за использование нашего приложения.',
//             filename: 'thanks.mp3'
//         }
//     ];
    
//     for (const example of examples) {
//         try {
//             await textToSpeech(example.text, example.filename);
//             console.log(`✓ Создан файл: ${example.filename}`);
//         } catch (error) {
//             console.error(`✗ Ошибка при создании ${example.filename}:`, error.message);
//         }
//     }
// }

// // Запуск основной программы
// main();

// // Раскомментируйте для запуска примера с несколькими файлами:
// // multipleExamples();


const gtts = require('gtts');

class AdvancedTTS {
    constructor() {
        this.voices = {
            'russian_female': 'ru',
            'russian_male': 'ru' // gtts не различает пол
        };
    }

    async synthesize(text, options = {}) {
        const {
            voice = 'russian_female',
            speed = 1.0,
            filename = 'output.mp3'
        } = options;

        return new Promise((resolve, reject) => {
            try {
                const speech = new gtts(text, this.voices[voice]);
                
                // Здесь можно добавить дополнительную обработку
                speech.save(filename, (err) => {
                    if (err) reject(err);
                    else {
                        console.log(`Создан файл: ${filename} с голосом: ${voice}`);
                        resolve(filename);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }
}

// Использование
async function demo() {
    const tts = new AdvancedTTS();
    
    await tts.synthesize('Привет мир!', {
        voice: 'russian_female',
        filename: 'female_voice.mp3'
    });
}