import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

const sanitizeFileName = (fileName) => {
    return fileName
        .replace(/[<>:"\/\\|?*\x00-\x1F]/g, '_')  // Заменяем недопустимые символы на "_"
        .replace(/[^\x00-\x7F]/g, '')  // Удаляем нелатинские символы, которые могут вызывать ошибки
        .trim();
};

const downloadAndExtractFile = async (url, outputDir, newFileNameWithoutExt) => {
    try {
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Ошибка загрузки: ${response.statusText}`);
        }
        const buffer = await response.buffer();

        const zipPath = path.join(outputDir, 'temp.zip');
        fs.writeFileSync(zipPath, buffer);

        const zip = new AdmZip(zipPath);
        const zipEntries = zip.getEntries();

        if (zipEntries.length !== 1) {
            throw new Error('Ожидался один файл в архиве');
        }

        const zipEntry = zipEntries[0];
        const originalFileName = zipEntry.entryName;
        const fileExtension = path.extname(originalFileName);  // Получаем расширение файла

        const sanitizedFileName = sanitizeFileName(newFileNameWithoutExt) + fileExtension;  // Добавляем расширение к новому имени
        const extractedFilePath = path.join(outputDir, sanitizedFileName);

        fs.writeFileSync(extractedFilePath, zipEntry.getData());
        console.log(`Файл сохранен: ${extractedFilePath}`);

        fs.unlinkSync(zipPath);
    } catch (error) {
        console.error('Ошибка:', error.message);
    }
};

// Пример использования функции
(async () => {
    const url = 'https://www.e-disclosure.ru/portal/FileLoad.ashx?Fileid=1850223';  // Замените на реальный URL
    const outputDir = './downloads';
    const newFileNameWithoutExt = 'MyNewFileName';  // Задайте любое имя без расширения
    await downloadAndExtractFile(url, outputDir, newFileNameWithoutExt);
})();
