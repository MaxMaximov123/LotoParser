import dotenv from 'dotenv';
dotenv.config({ path: new URL('../.env', import.meta.url) });

// ---------------------------------------------------------------------- //

const config = {};

config.restartTime = Number(process.env.RESTART_TIME);

config.database = {
	pool: {
		min: Number(process.env.DATABASE_POOL_MIN),
		max: Number(process.env.DATABASE_POOL_MAX),
	},
	url: process.env.DATABASE_URL,
	schema: process.env.DATABASE_SCHEMA || 'public',
};	

// ---------------------------------------------------------------------- //

export default config;