import config from './config.js';
import Parser from './parser.js';
import logger from './logger.js';

let parser;
let a = 10;
let isFirstIterationNews = true, isFirstIterationReports = true;

async function main() {
	parser = new Parser({
		restartTime: config.restartTime, 
		isFirstIterationNews: isFirstIterationNews, 
		isFirstIterationReports: isFirstIterationReports 
	});
	// setInterval(async () => {
	// 	parser.isLive = false;
	// 	console.log('Global restarting');
	// 	Object.keys(parser).forEach(prop => {
	// 		console.log(`Delete ${prop}`);
	// 		delete parser[prop]
	// 	});
	// 	await new Promise((resolve) => setTimeout(resolve, 10000));
	// 	isFirstIterationNews = false;
	// 	isFirstIterationReports = false;

	// 	parser = new Parser({
	// 		restartTime: config.restartTime, 
	// 		isFirstIterationNews: isFirstIterationNews, 
	// 		isFirstIterationReports: isFirstIterationReports 
	// 	});
	// }, 1000 * 60 * 30);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});

process.on('SIGINT', async () => {
	parser.browsersProxies.forEach(browser => {
		browser.close();
	});
	process.exit(0);  // Завершаем процесс после закрытия браузера
  });
