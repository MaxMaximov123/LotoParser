export async function up(knex) {
    return knex.schema.createTable('start_date', function(table) {
      table.string('start_date');
    });
  };
  
export async function down(knex) {
  return knex.schema.dropTable('start_date');
};
  