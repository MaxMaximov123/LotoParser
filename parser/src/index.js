import config from './config.js';
import Parser from './parser.js';

let parser;
let a = 10;

async function main() {
	parser = new Parser({ restartTime: config.restartTime });
	setInterval(() => {
		parser.isLive = false;
		console.log('Global restarting');
		Object.keys(parser).forEach(prop => {
			console.log(`Delete ${prop}`);
			delete parser[prop]
		});
		parser = new Parser({ restartTime: config.restartTime });
	}, 1000 * 60 * 60);
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
