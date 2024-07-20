import config from './config.js';
import Parser from './parser.js';

async function main() {
	new Parser({ restartTime: config.restartTime });
	// new Scanner({ restartTime: 60 });
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
