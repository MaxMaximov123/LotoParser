import dotenv from 'dotenv';
dotenv.config({ path: new URL('../.env', import.meta.url) });

// ---------------------------------------------------------------------- //

const config = {};

config.restartTime = Number(process.env.RESTART_TIME);

config.logging = {
	formatters: {
		colorize: process.env.LOGGING_FORMAT_COLORIZE === '1',
		humanReadable: process.env.LOGGING_FORMAT_HUMAN_READABLE === '1',
		jsonBeautified: process.env.LOGGING_FORMAT_JSON_BEAUTIFIED === '1',
		jsonRaw: process.env.LOGGING_FORMAT_JSON_RAW === '1',
	},
	level: process.env.LOGGING_LEVEL || 'info',
	transports: {
		filename: process.env.LOGGING_FILENAME || false,
	},
};

// ---------------------------------------------------------------------- //

export default config;