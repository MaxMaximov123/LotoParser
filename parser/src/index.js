import config from './config.js';
import Parser from './parser.js';

let parser;

async function main() {
	parser = new Parser({ restartTime: config.restartTime });
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
