import knex from 'knex';
import knexStringcase from 'knex-stringcase';
import { attachPaginate } from 'knex-paginate';
attachPaginate();
import pg from 'pg';
import knexConfig from '../knexfile.js'

pg.types.setTypeParser(pg.types.builtins.INT8, (value) => {
	return parseInt(value);
});

pg.types.setTypeParser(pg.types.builtins.FLOAT8, (value) => {
	return parseFloat(value);
});

pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => {
	return parseFloat(value);
});

export const db = knex(knexStringcase(knexConfig));
export const database = db;

export function useTransaction(transaction = null) {
	let db = database;
	db = transaction || db;
	return db;
};

export function buildFromValuesWhereReplacement(items) {
	if (!Array.isArray(items)) {
		throw new Error(`Items should be an array.`);
	}

	if (items.length === 0) {
		throw new Error(`Items can't be empty.`);
	}

	let string = ` from (values `;

	string += items
		.map((item) => {
			let string = '(';

			string += Object.values(item)
				.map((value) => db.raw('?', value).toQuery())
				.join(', ');

			string += ')';
			return string;
		})
		.join(', ');


	string += `) AS "values" (`;

	string += Object.keys(items[0])
		.map((columnName) => db.raw('??', columnName).toQuery())
		.join(', ');

	string += `) where `;
	return string;
};

export default { db };
