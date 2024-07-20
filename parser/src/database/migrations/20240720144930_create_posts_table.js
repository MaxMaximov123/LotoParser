export async function up(knex) {
    return knex.schema.createTable('games', function(table) {
      table.increments('id').primary();

      table.timestamp('date_time');
      table.integer('upper_number_1');
      table.integer('upper_number_2');
      table.integer('upper_number_3');
      table.integer('upper_number_4');

      table.integer('bottom_number_1');
      table.integer('bottom_number_2');
      table.integer('bottom_number_3');
      table.integer('bottom_number_4');

      table.index('id');
      table.index('date_time');
      table.index('upper_number_1');
      table.index('upper_number_2');
      table.index('upper_number_3');
      table.index('upper_number_4');

      table.index('bottom_number_1');
      table.index('bottom_number_2');
      table.index('bottom_number_3');
      table.index('bottom_number_4');

      table.unique(['date_time']);
    });
  };
  
export async function down(knex) {
  return knex.schema.dropTable('posts');
};
  