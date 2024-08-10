import dotenv from 'dotenv';
dotenv.config({ path: new URL('../.env', import.meta.url) });

// ---------------------------------------------------------------------- //

const config = {};

config.restartTime = Number(process.env.RESTART_TIME);

// ---------------------------------------------------------------------- //

export default config;