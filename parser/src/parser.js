import config from './config.js';
import moment from 'moment';
import 'moment-timezone';
import puppeteer from 'puppeteer';
import fs, { chownSync } from 'fs';
import { JSDOM } from 'jsdom';
import * as cheerio from 'cheerio';
import MD5 from "crypto-js/md5.js";
import unzipper from 'unzipper';
import path from 'path';
import fetch from 'node-fetch';
import AdmZip from 'adm-zip';
import { dirname } from 'path';
import { URL } from 'url';
import { fileURLToPath } from 'url';
import HttpsProxyAgent from 'https-proxy-agent';
import ProxyChain from 'proxy-chain';
import UserAgent from 'user-agents';
// import Unrar from 'unrar';
// import Unrar from 'unrar-js';
// import Unrar from 'node-unrar';
// import Unrar from 'node-unrar-js';
// import Unrar from 'unrar';
import unrar from 'unrar-js';
import logger from './logger.js';
import { createExtractorFromFile } from 'node-unrar-js'
// const { extract } = pkg; 

const __dirname = dirname(fileURLToPath(import.meta.url + '/..'));
const __filename = fileURLToPath(import.meta.url);

export default class Parser {
  postKeys = [];
  browser = null;
  page = null;
  totalHeight = 0;
  isScanning = true;
  restartSycles = 0;

  constructor({ restartTime, isFirstIterationNews, isFirstIterationReports }) {
    this.restartTime = restartTime;
    this.isFirstIterationNews = isFirstIterationNews;
    this.isFirstIterationReports = isFirstIterationReports;

    this.start().catch((error) => {
      logger.error(error);
    });
  }

  async waitForTimeout(time) {
    await new Promise((resolve) => setTimeout(resolve, time));
  }

  sanitizeFileName(fileName) {
    return fileName
      .replace(/[<>:"\/\\|?*\x00-\x1F]/g, '_')  // Заменяем недопустимые символы на "_"
      .replace(/[^\x00-\x7F]/g, '')  // Удаляем нелатинские символы, которые могут вызывать ошибки
      .trim();
  }

  postRequest(url, data) {
    return new Promise((resolve, reject) => {
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: JSON.stringify(data)
      };

      fetch(url, options)
        .then(response => response.json())
        .then(result => {
          resolve(result);
        })
        .catch(error => {
          reject(error);
        });
    })
  }

  async downloadAndExtractFile(url, outputDir, newFileNameWithoutExt) {
    await this.waitForTimeout(500);
    let zipPath;
    try {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      if (
        fs.existsSync(`${outputDir}/${newFileNameWithoutExt}.pdf`) || 
        fs.existsSync(`${outputDir}/${newFileNameWithoutExt}.doc`) ||
        fs.existsSync(`${outputDir}/${newFileNameWithoutExt}.xls`) ||
        fs.existsSync(`${outputDir}/${newFileNameWithoutExt}.docx`) ||
        fs.existsSync(`${outputDir}/${newFileNameWithoutExt}.xlsx`) ||
        fs.existsSync(`${outputDir}/${newFileNameWithoutExt}.rtf`) ||
        fs.existsSync(`${outputDir}/${newFileNameWithoutExt}.tif`)
        ) {
        return;
      }

      let randomIndexPage = Math.floor(Math.random() * Object.values(this.pagesReportsProxies).length);
      let page = Object.values(this.pagesReportsProxies)[randomIndexPage];

      const response = await page.evaluate(async (url) => {
        const res = await fetch(url, { timeout: 60000 });
        const buffer = await res.arrayBuffer(); // возвращаемый массив байтов
        return Array.from(new Uint8Array(buffer)); // преобразуем в массив чисел
      }, url, { timeout: 120000 });

      const buffer = Buffer.from(response);

      try {

        zipPath = path.join(outputDir, `temp_${newFileNameWithoutExt}.zip`);
        fs.writeFileSync(zipPath, buffer);

        const zip = new AdmZip(zipPath);
        const zipEntries = zip.getEntries();

        if (zipEntries.length === 0) {
          throw new Error('Архив пустой');
        }

        const zipEntry = zipEntries[0];
        const originalFileName = zipEntry.entryName;
        const fileExtension = path.extname(originalFileName);

        const sanitizedFileName = this.sanitizeFileName(newFileNameWithoutExt) + fileExtension;
        const extractedFilePath = path.join(outputDir, sanitizedFileName);

        fs.writeFileSync(extractedFilePath, zipEntry.getData());
      } catch (e) {
        logger.error('ERROR with zip', url, e.message)
        try {
          fs.unlinkSync(zipPath);
          const tempExtractDir = path.join(outputDir, `temp_${newFileNameWithoutExt}`);
          const tempPath = path.join(outputDir, `temp_${newFileNameWithoutExt}.rar`);
          fs.writeFileSync(tempPath, buffer);

          const extractor = await createExtractorFromFile({
            filepath: tempPath,
            targetPath: tempExtractDir
          });

          [...extractor.extract().files];

          fs.unlinkSync(tempPath);

          const zip1 = new AdmZip();
          const files = fs.readdirSync(tempExtractDir);

          files.forEach(file => {
            const filePath = path.join(tempExtractDir, file);
            zip1.addLocalFile(filePath);
          });

          const zipFilePath = path.join(outputDir, `temp_${newFileNameWithoutExt}.zip`);
          zip1.writeZip(zipFilePath);

          const zip = new AdmZip(zipPath);
          const zipEntries = zip.getEntries();

          if (zipEntries.length === 0) {
            throw new Error('Архив пустой');
          }

          const zipEntry = zipEntries[0];
          const originalFileName = zipEntry.entryName;
          const fileExtension = path.extname(originalFileName);

          const sanitizedFileName = this.sanitizeFileName(newFileNameWithoutExt) + fileExtension;
          const extractedFilePath = path.join(outputDir, sanitizedFileName);

          fs.writeFileSync(extractedFilePath, zipEntry.getData());
        } catch (rarErr) {
          logger.error(rarErr);
          throw new Error('Ошибка сохранения rar', rarErr.message);
        }
      }
      try {
        fs.unlinkSync(zipPath);
      } catch(e) {}
      try {
        fs.unlinkSync(tempPath);
      } catch(e) {}
      try {
        fs.rmSync(tempExtractDir, { recursive: true, force: true });
      } catch(e) {}
    } catch (error) {
      logger.error('ERROR while saving file', url, error.message);
    }
  };

  async fetchReportTableData(url) {
    try {
      let html = await this.getFromSite(url);

      let $ = cheerio.load(html);

      let table = $('.files-table');

      let headers = [];
      table.find('tbody tr th').each((index, element) => {
        headers.push($(element).text().trim().replace(/\u00AD/g, ''))
      });

      let rows = [];
      table.find('tbody tr').each((index, element) => {
        let row = {};
        $(element).find('td').each((i, elem) => {
          let key = headers[i];

          if (!key) {
            return;
          }

          let value;
          if (key === 'Файл') {
            $(elem).find('a').each((i, elem) => {
              value = $(elem).attr('href');
            });

          } else {
            value = $(elem).text().trim().replace(/\u00AD/g, '');
          }
          row[key] = value;
        });

        if (Object.keys(row).length && row['Файл']) {
          rows.push(row);
        }
      });

      return rows;
    } catch (error) {
      logger.error('Ошибка при получении данных:', error);
      return [];
    }
  }

  async getContentFromElement(url) {
    try {
      let html = await this.getFromSite(url);

      let $ = cheerio.load(html);
      let contentElement = $('#cont_wrap');

      if (contentElement.length > 0) {
        return contentElement.text().trim();
      } else {
        logger.info('Элемент с id "cont_wrap" не найден');
      }
    } catch (error) {
      console.error('Ошибка:', error.message);
    }
  }

  async postFromSite(url, data) {
    let randomIndexPage = Math.floor(Math.random() * Object.values(this.pagesNewsProxies).length);
    let page = Object.values(this.pagesReportsProxies)[randomIndexPage];

    let result = await page.evaluate(async (url, data) => {
      return await (await fetch(url, {
        "headers": {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8"
        },
        "body": data,
        "method": "POST"
      })).json();
    }, url, data, { timeout: 120000 });

    return result;
  }

  async closeAllBrowsers() {
    for (let browser of Object.values(this.browsersProxies)) {
      await browser.close();
    }
  }

  async checkingPages() {
    while (this.isLive) {
      if (Object.values(this.pagesReportsProxies).length === 0 || Object.values(this.pagesNewsProxies).length) {
        await this.build();
      }
      await this.waitForTimeout(30 * 1000);
    }

    if (!this.isLive) {
      await this.closeAllBrowsers();
    }
  }

  extractSubstrings(input) {
    let regexStart = /\d\.\d\.\d/g;
    let regexEnd = /\d\.\d\.\d|\d\.\d|$/g;
    let result = [];
    let matchStart, matchEnd;

    while ((matchStart = regexStart.exec(input)) !== null) {
      let startIdx = matchStart.index;

      regexEnd.lastIndex = regexStart.lastIndex;
      matchEnd = regexEnd.exec(input);

      let endIdx;
      if (matchEnd !== null) {
        endIdx = matchEnd.index;
      } else {
        endIdx = input.length;
      }

      let substring = input.slice(startIdx, endIdx).trim();
      result.push(substring);
      regexStart.lastIndex = endIdx;
    }

    return result;
  }

  async getFromSite(url) {
    let randomIndexPage = Math.floor(Math.random() * Object.values(this.pagesReportsProxies).length);
    let page = Object.values(this.pagesReportsProxies)[randomIndexPage];

    let result = await page.evaluate(async (url) => {
      return await (await fetch(url)).text();
    }, url, { timeout: 120000 });

    return result;
  }

  async scanningNews(restartSycles) {
    while (this.isLive) {
      if (restartSycles !== this.restartSycles) {
        return;
      }
      let finishDate = moment().format('DD.MM.YYYY');
      let startDate = moment();
      startDate.add(-1, 'M');
      startDate = startDate.format('DD.MM.YYYY');


      let responseData = [];

      try {
        responseData = await this.postFromSite(
          'https://www.e-disclosure.ru/api/search/sevents',
          `eventTypeTerm=&radView=0&dateStart=${startDate}&dateFinish=${finishDate}&textfieldEvent=&radReg=FederalDistricts&districtsCheckboxGroup=-1&regionsCheckboxGroup=-1&branchesCheckboxGroup=-1&textfieldCompany=&lastPageSize=10&lastPageNumber=1&query=&queryEvent=`
        );

        responseData = responseData.foundEventsList;
      } catch (e) {
        logger.error('Error while getting POST', e);
        await this.waitForTimeout(200);
        continue;
      }

      await Promise.all(
        responseData.map(
          news => (async (news) => {
            if (!this.tickers[news.companyName]) {
              // logger.info(`Skip news unknown company name id: ${news.pseudoGUID}`);
              return;
            }

            if (!this.subtitles[news.eventName]) {
              // logger.info(`Skip news unknown subtitle id: ${news.pseudoGUID}`);
              return;
            }

            let newsToPost = {
              ticker: this.tickers[news.companyName].name,
              name: news.companyName,
              fullText: await this.getContentFromElement(`https://www.e-disclosure.ru/portal/event.aspx?EventId=${news.pseudoGUID}`),
              textes: [],
            };

            if (newsToPost.fullText) {
              for (let filter of this.subtitles[news.eventName].filters || []) {
                for (let startFilter of filter.start) {
                  for (let endFilter of filter.end) {
                    let startIndex = newsToPost.fullText.indexOf(startFilter);
                    let endIndex = newsToPost.fullText.indexOf(endFilter);
                    newsToPost.textes.push(newsToPost.fullText.slice(startIndex, endIndex));
                  }
                }
              }

              for (let substring of this.extractSubstrings(newsToPost.fullText)) {
                for (let key of this.subtitles[news.eventName].keys) {
                  if (substring.includes(key)) {
                    newsToPost.textes.push(substring);
                  }
                }
              }
            }

            let hashOfData = MD5(JSON.stringify(newsToPost)).toString();
            if (!this.historyNews.includes(hashOfData)) {
              // post req

              this.newNews.push(newsToPost);

              if (!this.isFirstIterationNews) {
                await this.postRequest('http://92.53.124.200:5000/api/edisclosure_news', newsToPost);
                let date = new Date();
                let date1 = new Date(news?.pubDate);
                logger.info(`Post news sended. Time of Sending: ${date.toLocaleString("ru-RU")}, News: ${date1.toLocaleString("ru-RU")}, Delta: ${(date - date1) / 1000}`);
              }
              fs.writeFileSync('./data/newNews.json', JSON.stringify(this.newNews, null, 2));
              this.historyNews.push(hashOfData);
              fs.writeFileSync('./data/historyNews.json', JSON.stringify(this.historyNews, null, 2));
            }
          })(news)

        )
      )

      await this.waitForTimeout(200);
      this.isFirstIterationNews = false;
    }
  }

  async controlSavingFiles(url, path, name) {
    this.tasksOfSavingReportsFiles.push([url, path, name]);
  }

  async savingAllFiles() {
    while (this.isLive) {
      if (this.tasksOfSavingReportsFiles?.length) {
        let tasks = this.tasksOfSavingReportsFiles.slice(0, 50);
        this.tasksOfSavingReportsFiles = this.tasksOfSavingReportsFiles.slice(50);
        await Promise.all(tasks.map(task => this.downloadAndExtractFile(...task)));
        logger.info(`50/${this.tasksOfSavingReportsFiles.length + 50} files was saved`);
      }
      await this.waitForTimeout(2000);
    }
  }

  async saveReportForType(type, companyName) {
    let url = `https://www.e-disclosure.ru/portal/files.aspx?id=${this.tickers[companyName].id}&type=${type}`;

    let dataOfTable = await this.fetchReportTableData(url);

    let tasksOfSavingReports = [];

    for (let row of dataOfTable) {
      row.ticker = this.tickers[companyName].ticker;
      row.name = companyName;
      row.id = this.tickers[companyName].id;
      row.type = type;

      let hashOfData = MD5(JSON.stringify(row)).toString();

      let url = row['Файл'];


      if (!this.historyReports.includes(hashOfData)) {
        if (!this.isFirstIterationReports) {
          this.controlSavingFiles(url, './data/reports', MD5(row['Файл']).toString());
        }

        row['Файл'] = `${__dirname}/data/reports/${MD5(row['Файл']).toString()}`;
        // post request!!!!!!!
        this.newReports.push(row);

        if (!this.isFirstIterationReports) {
          await this.postRequest('http://92.53.124.200:5000/api/edisclosure_reports', row);
          logger.info("Post reports sended");
        }
        fs.writeFileSync('./data/newReports.json', JSON.stringify(this.newReports, null, 2));
        this.historyReports.push(hashOfData);
        fs.writeFileSync('./data/historyReports.json', JSON.stringify(this.historyReports, null, 2));
      }
    }
  }

  async saveReportForCompanyName(companyName) {
    for (let type of this.tickers[companyName].types) {
      await this.saveReportForType(type, companyName);
    }

    logger.info(companyName, 'saved!');
  }

  async scanningReports(restartSycles) {
    while (this.isLive) {
      logger.info(`Scanning reports cycles #${restartSycles} ${this.restartSycles}`);
      if (restartSycles !== this.restartSycles) {
        return;
      }

      for (let companyName of Object.keys(this.tickers)) {
        await this.saveReportForCompanyName(companyName);
      }

      await this.waitForTimeout(60 * 1000);
      this.isFirstIterationReports = false;
    }
  }

  async start() {
    this.tasksOfSavingReportsFiles = [];
    this.savingAllFiles();
    this.isLive = true;
    this.newNews = [];
    this.newReports = [];
    while (this.isLive) {
      await this.build();
      await this.waitForTimeout(1000 * 60 * 60 * 24 * 3);
      await this.closeAllBrowsers();
    }
  }

  async build() {
    logger.info(`Build cycle #${this.restartSycles}`);
    this.historyNews = JSON.parse(fs.readFileSync('./data/historyNews.json', 'utf8'));
    this.historyReports = JSON.parse(fs.readFileSync('./data/historyReports.json', 'utf8'));

    let tickersFile = JSON.parse(fs.readFileSync('./data/tickers.json', 'utf8'));
    this.tickers = {};

    for (let ticker of tickersFile) {
      this.tickers[ticker.name] = ticker;
    }

    let subtitlesFile = JSON.parse(fs.readFileSync('./data/subtitles.json', 'utf8'));
    this.subtitles = {};

    for (let subtitle of subtitlesFile) {
      this.subtitles[subtitle.subtitle] = subtitle;
    }

    let originalProxies = JSON.parse(fs.readFileSync('./data/proxies.json', 'utf8'));
    this.proxies = await Promise.all(
      originalProxies.map(
        async proxy => await ProxyChain.anonymizeProxy(proxy)
      )
    );


    console.log(this.proxies);

    this.browsersProxies = {};
    this.pagesReportsProxies = {};
    this.pagesNewsProxies = {};

    let indProxy = 0;
    for (let proxy of this.proxies) {
      let originalProxy = originalProxies[indProxy];
      indProxy++;
      let browser;
      try {
        browser = await puppeteer.launch({
          args: [
            `--proxy-server=${proxy}`,
            '--ignore-certificate-errors',
            '--disable-web-security',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            // '--disable-gpu',
            // '--disable-software-rasterizer',
            // '--single-process',
            // '--no-zygote',
            // '--disable-extensions',
            '--no-sandbox'

          ],
          protocolTimeout: 360000,
          timeout: 120000,
          // headless: false,
          headless: 'new'
        });

        this.browsersProxies[proxy] = browser;

        let pageNews = await browser.newPage();
        this.pagesNewsProxies[proxy] = pageNews;
        await pageNews.mouse.move(100, 100);

        await pageNews.setExtraHTTPHeaders({
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
          'Referer': 'https://www.e-disclosure.ru/',
          'DNT': '1',
        });

        await pageNews.evaluateOnNewDocument(() => {
          Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5], // фейковые плагины
          });
          Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'ru-RU'],
          });
          Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
          });
        });

        pageNews.on('response', async (response) => {
          let url = response.url();

          if (url.startsWith('https://www.e-disclosure.ru/xpvnsulc')) {
            logger.info(`Removed news: ${originalProxy}`);
            delete this.pagesNewsProxies[proxy];
          }
        });

        await pageNews.setUserAgent(new UserAgent().toString());
        await pageNews.setExtraHTTPHeaders({
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-User': '?1',
          'sec-ch-ua': '"Chromium";v="124", "YaBrowser";v="24.6", "Not-A.Brand";v="99", "Yowser";v="2.5"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
        });
        await pageNews.goto('https://www.e-disclosure.ru/poisk-po-soobshheniyam', { waitUntil: 'networkidle2', timeout: 120000 });
        await this.waitForTimeout(1000);


        let pageReport = await browser.newPage();
        this.pagesReportsProxies[proxy] = pageReport;

        await pageReport.setExtraHTTPHeaders({
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
          'Referer': 'https://www.example.com',
          'DNT': '1',
        });

        await pageReport.evaluateOnNewDocument(() => {
          Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5], // фейковые плагины
          });
          Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'ru-RU'],
          });
          Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
          });
        });

        pageReport.on('response', async (response) => {
          let url = response.url();

          if (url.startsWith('https://www.e-disclosure.ru/xpvnsulc')) {
            logger.info(`Removed report ${originalProxy}`);
            delete this.pagesReportsProxies[proxy];
          }
        });

        await pageReport.mouse.move(100, 100);

        await pageReport.setUserAgent(new UserAgent().toString());
        await pageReport.setExtraHTTPHeaders({
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-User': '?1',
          'sec-ch-ua': '"Chromium";v="124", "YaBrowser";v="24.6", "Not-A.Brand";v="99", "Yowser";v="2.5"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
        });
        await pageReport.goto('https://www.e-disclosure.ru/portal/files.aspx?id=38334&type=5', { waitUntil: 'networkidle2', timeout: 120000 });

        logger.info(`Browser with proxy ${originalProxy} is ready!`);

      } catch (error) {
        logger.error(`Error with browser ${originalProxy}:`, error);
      }
    }

    // await this.waitForTimeout(1000 * 30);

    for (let proxy of this.proxies) {
      if ((!this.pagesReportsProxies[proxy]) && (!this.pagesNewsProxies[proxy]) && this.browsersProxies[proxy]) {
        await this.browsersProxies[proxy].close();
        delete this.browsersProxies[proxy];
      }
    }

    logger.info(`${Object.keys(this.browsersProxies).length} browsers available`);
    logger.info(`${Object.keys(this.pagesNewsProxies).length} pages news available`);
    logger.info(`${Object.keys(this.pagesReportsProxies).length} pages reports available`);

    if (Object.keys(this.pagesNewsProxies).length + Object.keys(this.pagesReportsProxies).length >= 2) {
      this.restartSycles += 1;
      this.scanningNews(this.restartSycles).catch((error) => {
        logger.logger('scanningNews error', error);
      });;
      this.scanningReports(this.restartSycles).catch((error) => {
        logger.logger('scanningReports error', error);
      });
      logger.info('Start parsing');
    } else {
      await this.waitForTimeout(1000 * 60);
      this.build();
    }
  }
}