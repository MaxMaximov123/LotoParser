import fs from 'fs';
import path from 'path';
import Unrar from 'unrar'; // Используем библиотеку node-unrar-js
import AdmZip from 'adm-zip';          // Для создания ZIP архивов
import { createExtractorFromFile } from 'node-unrar-js'

const convertRarToZip = async (rarFilePath, outputDir, zipFileName) => {
    try {
        // Проверка на существование выходной директории
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Чтение данных RAR архива
        const tempExtractDir = path.join(outputDir, 'temp_extract');
        const rarBuffer = fs.readFileSync(rarFilePath);
        
        const extractor = await createExtractorFromFile({
            filepath: rarFilePath,
            targetPath: tempExtractDir
          });

        [...extractor.extract().files];


        // Создание ZIP архива
        const zip = new AdmZip();
        const files = fs.readdirSync(tempExtractDir);

        files.forEach(file => {
            const filePath = path.join(tempExtractDir, file);
            zip.addLocalFile(filePath);
        });

        const zipFilePath = path.join(outputDir, zipFileName);
        zip.writeZip(zipFilePath);

        console.log(`Архив успешно преобразован в ZIP: ${zipFilePath}`);

        // Очистка временной директории
        fs.rmSync(tempExtractDir, { recursive: true, force: true });
    } catch (error) {
        console.error('Ошибка при преобразовании RAR в ZIP:', error.message);
    }
};

// Пример использования
const rarFilePath = './test/temp.rar'; // Замените на путь к вашему RAR файлу
const outputDir = './test';      // Замените на путь к выходной директории
const zipFileName = 'temp.zip';            // Название выходного ZIP файла

convertRarToZip(rarFilePath, outputDir, zipFileName);
