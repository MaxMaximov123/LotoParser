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

const __dirname = dirname(fileURLToPath(import.meta.url + '/..'));
const __filename = fileURLToPath(import.meta.url);

export default class Parser {
  postKeys = [];
  browser = null;
  page = null;
  totalHeight = 0;
  isScanning = true;

  constructor({ restartTime }) {
    this.restartTime = restartTime;

    this.start().catch((error) => {
      console.log(error);
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

  async downloadAndExtractFile(url, outputDir, newFileNameWithoutExt) {
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

        const sanitizedFileName = this.sanitizeFileName(newFileNameWithoutExt) + fileExtension;  // Добавляем расширение к новому имени
        const extractedFilePath = path.join(outputDir, sanitizedFileName);

        fs.writeFileSync(extractedFilePath, zipEntry.getData());
        console.log(`Файл сохранен: ${extractedFilePath}`);

        fs.unlinkSync(zipPath);
    } catch (error) {
        console.error('Ошибка:', error.message);
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
      console.error('Ошибка при получении данных:', error);
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
        console.log('Элемент с id "cont_wrap" не найден');
      }
    } catch (error) {
      console.error('Ошибка:', error.message);
    }
  }

  async postFromSite(url, data) {
    let randomIndexPage = Math.floor(Math.random() * this.pagesNewsProxies.length);
    let page = this.pagesReportsProxies[randomIndexPage];

    let result = await page.evaluate(async (url, data) => {
      return await (await fetch(url, {
        "headers": {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8"
        },
        "body": data,
        "method": "POST"
      })).json();
    }, url, data);

    return result;
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
    let randomIndexPage = Math.floor(Math.random() * this.pagesReportsProxies.length);
    let page = this.pagesReportsProxies[randomIndexPage];

    let result = await page.evaluate(async (url) => {
      return await (await fetch(url)).text();
    }, url);

    return result;
  }

  async scanningNews() {
    while (true) {

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
        console.log('Error while getting POST', e)
      }

      let r = [];
      for (let news of responseData) {
        if (!this.tickers[news.companyName]) {
          console.log(`Skip news unknown company name id: ${news.pseudoGUID}`);
          continue;
        }

        if (!this.subtitles[news.eventName]) {
          console.log(`Skip news unknown subtitle id: ${news.pseudoGUID}`);
          continue;
        }

        let newsToPost = {
          ticker: this.tickers[news.companyName].name,
          name: news.companyName,
          fullText: await this.getContentFromElement(`https://www.e-disclosure.ru/portal/event.aspx?EventId=${news.pseudoGUID}`),
          textes: [],
        };

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

        r.push(newsToPost);
        let hashOfData = MD5(JSON.stringify(newsToPost)).toString();
        if (!this.historyNews.includes(hashOfData)) {
          // post req

          this.newNews.push(newsToPost);
          this.historyNews.push(hashOfData);
        }
      }

      fs.writeFileSync('./data/newNews.json', JSON.stringify(this.newNews, null, 2));

      fs.writeFileSync('./data/historyNews.json', JSON.stringify(this.historyNews, null, 2));

      await this.waitForTimeout(1000 * 30);
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
      if (!this.historyReports.includes(hashOfData)) {
        tasksOfSavingReports.push(this.downloadAndExtractFile(row['Файл'], './data/reports', MD5(row['Файл']).toString()));

        row['Файл'] = `${__dirname}/data/reports/${MD5(row['Файл']).toString()}`;

        // post request!!!!!!!
        this.newReports.push(row);
        this.historyReports.push(hashOfData);
      }
    }

    // await Promise.all(tasksOfSavingReports);
  }

  async saveReportForCompanyName(companyName) {
    let tasksOfTypes = this.tickers[companyName].types.map(type => this.saveReportForType(type, companyName));
    await Promise.all(tasksOfTypes);
    console.log(companyName, 'saved!');
  }

  async scanningReports() {
    while (true) {
      this.newReports = [];
      this.newNews = [];
      let tasksOfCompaniesNames = Object.keys(this.tickers).map(companyName => this.saveReportForCompanyName(companyName));
      await Promise.all(tasksOfCompaniesNames);

      fs.writeFileSync('./data/historyReports.json', JSON.stringify(this.historyReports, null, 2));

      fs.writeFileSync('./data/newReports.json', JSON.stringify(this.newReports, null, 2));
      await this.waitForTimeout(30 * 1000);
    }
  }

  async start() {
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

    // this.browser = await puppeteer.launch(
    //   {
    //     args: ['--no-sandbox'],
    //     headless: 'new',
    //     headless: false
    //   }
    // );
    // this.webPageNews = await this.browser.newPage();
    // this.webPageReport = await this.browser.newPage();
    
    this.proxies = await Promise.all(
      JSON.parse(fs.readFileSync('./data/proxies.json', 'utf8')).map(
        async proxy => await ProxyChain.anonymizeProxy(proxy)
        )
    );

    console.log(this.proxies);

    this.browsersProxies = [];
    this.pagesReportsProxies = [];
    this.pagesNewsProxies = [];

    // let pages = [
    //   this.webPageNews.goto('https://www.e-disclosure.ru/poisk-po-soobshheniyam'),
    //   this.webPageReport.goto('https://www.e-disclosure.ru/portal/files.aspx?id=38334&type=5')
    // ];

    // await Promise.all(pages);
    let tasksPagesNewsProxies = [];
    let tasksPagesReportsProxies = [];
    
    for (let proxy of this.proxies) {
      this.browsersProxies.push(
        await puppeteer.launch(
          {
            args: [
              `--proxy-server=${proxy}`,
              '--ignore-certificate-errors',
              '--disable-web-security',
              '--no-sandbox'
            ],
            headless: 'new',
            // headless: false
          }
        )
      );
      
      tasksPagesNewsProxies.push(this.browsersProxies.at(-1).newPage());
      tasksPagesReportsProxies.push(this.browsersProxies.at(-1).newPage());
    }

    this.pagesReportsProxies = await Promise.all(tasksPagesReportsProxies);
    this.pagesNewsProxies = await Promise.all(tasksPagesNewsProxies);

    let tasks = [];

    for (let pageReportsProxies of this.pagesReportsProxies) {
      tasks.push(pageReportsProxies.goto('https://www.e-disclosure.ru/poisk-po-soobshheniyam'));
    }

    for (let pageNewsProxies of this.pagesNewsProxies) {
      tasks.push(pageNewsProxies.goto('https://www.e-disclosure.ru/portal/files.aspx?id=38334&type=5'));
    }

    await Promise.all(tasks);

    this.scanningNews();
    this.scanningReports();

    
  }
}