require('dotenv').config();
const { Bot, InputFile } = require('grammy');
const { Client } = require('pg');
const ffmpeg = require('fluent-ffmpeg');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Установка пути к ffmpeg
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);

const bot = new Bot(process.env.BOT_API_KEY);

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

client.connect()
  .then(() => {
    console.log('Connected to PostgreSQL');
    client.query('LISTEN new_note');
  })
  .catch(err => console.error('Connection error', err.stack));

bot.command('start', async (ctx) => {
  await ctx.reply('Привет! Я - Бот, который поможет вам обрезать аудио файлы (WAV) по 6 секунд.');
});

bot.on("message:audio", async (ctx) => {
  const audio = ctx.message.audio;
  const fileId = audio.file_id;
  const file = await ctx.api.getFile(fileId);
  const fileLink = `https://api.telegram.org/file/bot${process.env.BOT_API_KEY}/${file.file_path}`;
  
  const inputFilePath = path.join(__dirname, `${fileId}.WAV`);
  const outputDir = path.join(__dirname, 'output');
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  // Функция для загрузки файла
  const downloadFile = (url, dest) => new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, response => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(dest);
      });
    }).on('error', err => {
      console.error('Error downloading file:', err);
      fs.unlink(dest);
      reject(err);
    });
  });

  // Функция для обрезки аудио
  const trimAudio = (inputPath, outputPath, startTime, duration) => {
    console.log('Trimming audio:', inputPath, outputPath, startTime, duration);
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(startTime)
        .duration(duration)
        .on('end', () => resolve())
        .on('error', err => reject(err))
        .save(outputPath);
    });
  };

  const duration = 6; // 6 секунд
  let startTime = 0;
  const outputFiles = [];

  try {
    // Загрузка файла аудио
    const downloadedFilePath = await downloadFile(fileLink, inputFilePath);

    while (true) {
      console.log('Обработка сегмента:', startTime, duration);
      const segmentFileId = uuidv4();
      const outputFilePath = path.join(outputDir, `${segmentFileId}.wav`);
      await trimAudio(downloadedFilePath, outputFilePath, startTime, duration);
      outputFiles.push(outputFilePath);

      await insertSegmentInfo(fileId, segmentFileId, startTime, duration);

      if (startTime + duration >= audio.duration) break;
      
      startTime += duration;
    }

    for (const outputFile of outputFiles) {
      console.log(`Отправка аудиофайла: ${outputFile}`);
      if (fs.existsSync(outputFile)) {
        try {
          const response = await ctx.replyWithAudio(new InputFile(outputFile));
          console.log('Аудио успешно отправлено:', response);
        } catch (error) {
          console.error('Ошибка при отправке аудио:', error);
        }
      } else {
        console.error(`Файл не существует: ${outputFile}`);
      }
    }
  } catch (err) {
    console.error('Ошибка при обработке аудио:', err);
    await ctx.reply('Произошла ошибка при обработке аудио.');
  } finally {
    fs.unlinkSync(inputFilePath);
    outputFiles.forEach(file => fs.unlinkSync(file));
  }
});

bot.on("message:file", async (ctx) => {
  const audio = ctx.message.file;
  const fileId = audio.file_id;
  const file = await ctx.api.getFile(fileId);
  const fileLink = `https://api.telegram.org/file/bot${process.env.BOT_API_KEY}/${file.file_path}`;
  
  const inputFilePath = path.join(__dirname, `${fileId}.WAV`);
  const outputDir = path.join(__dirname, 'output');
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  // Функция для загрузки файла
  const downloadFile = (url, dest) => new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, response => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(dest);
      });
    }).on('error', err => {
      console.error('Error downloading file:', err);
      fs.unlink(dest);
      reject(err);
    });
  });

  // Функция для обрезки аудио
  const trimAudio = (inputPath, outputPath, startTime, duration) => {
    console.log('Trimming audio:', inputPath, outputPath, startTime, duration);
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(startTime)
        .duration(duration)
        .on('end', () => resolve())
        .on('error', err => reject(err))
        .save(outputPath);
    });
  };

  const duration = 6; // 6 секунд
  let startTime = 0;
  const outputFiles = [];

  try {
    // Загрузка файла аудио
    const downloadedFilePath = await downloadFile(fileLink, inputFilePath);

    while (true) {
      console.log('Обработка сегмента:', startTime, duration);
      const segmentFileId = uuidv4();
      const outputFilePath = path.join(outputDir, `${segmentFileId}.wav`);
      await trimAudio(downloadedFilePath, outputFilePath, startTime, duration);
      outputFiles.push(outputFilePath);

      await insertSegmentInfo(fileId, segmentFileId, startTime, duration);

      if (startTime + duration >= audio.duration) break;
      
      startTime += duration;
    }

    for (const outputFile of outputFiles) {
      console.log(`Отправка аудиофайла: ${outputFile}`);
      if (fs.existsSync(outputFile)) {
        try {
          const response = await ctx.replyWithAudio(new InputFile(outputFile));
          console.log('Аудио успешно отправлено:', response);
        } catch (error) {
          console.error('Ошибка при отправке аудио:', error);
        }
      } else {
        console.error(`Файл не существует: ${outputFile}`);
      }
    }
  } catch (err) {
    console.error('Ошибка при обработке аудио:', err);
    await ctx.reply('Произошла ошибка при обработке аудио.');
  } finally {
    fs.unlinkSync(inputFilePath);
    outputFiles.forEach(file => fs.unlinkSync(file));
  }
});

async function insertSegmentInfo(originalFileId, segmentFileId, startTime, duration) {
  const query = 'INSERT INTO audio_segments (original_file_id, segment_file_id, segment_start_time, segment_duration) VALUES ($1, $2, $3, $4)';
  const values = [originalFileId, segmentFileId, startTime, duration];
  await client.query(query, values);
}

bot.catch((err) => {
  console.error('Ошибка в промежуточном ПО:', err);
});

bot.start();
