import winston from 'winston';
import stringify from 'safe-stable-stringify';
import config from './config.js';

const humanReadableFormatter = (data) => {
	const payload = Object.keys(data)
		.filter((key) => !key.startsWith('Symbol('))
		.filter((key) => !['message', 'level', 'timestamp'].includes(key))
		.reduce((acc, key) => ({ ...acc, [key]: data[key] }), {});

	return [
		`[${data.timestamp.slice(0, -1)}]`,
		`${data.level}:`,
		data.stack ? data.stack.replace(/^Error:\s+/, '') : data.message,
		Object.keys(payload).length ? stringify(payload) : undefined,
	].filter((p) => p).join(' ');
};

const formatsGeneral = [
	winston.format.errors({ stack: true }),
	winston.format.timestamp(),
	winston.format.simple(),
	winston.format.printf(humanReadableFormatter),
].filter(Boolean);

const formatsConsole = [
	winston.format.errors({ stack: true }),
	winston.format.timestamp(),
	winston.format.simple(),
	config.logging.formatters.jsonRaw || config.logging.formatters.jsonBeautified
		? winston.format.json({ space: config.logging.formatters.jsonBeautified ? 4 : 0 })
		: undefined,
	config.logging.formatters.colorize
		? winston.format.colorize({ all: true })
		: undefined,
	config.logging.formatters.humanReadable
		? winston.format.printf(humanReadableFormatter)
		: undefined,
].filter(Boolean);

const transports = [
	new winston.transports.Console({
		format: winston.format.combine(...formatsConsole),
	}),
	config.logging.transports.filename
		? new winston.transports.File({
			filename: config.logging.transports.filename,
			level: undefined, // using the default level
		})
		: undefined,
].filter(Boolean);

export default winston.createLogger({
	format: winston.format.combine(...formatsGeneral),
	level: config.logging.level,
	transports,
});
