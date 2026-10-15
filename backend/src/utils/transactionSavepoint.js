// Use only within an open transaction. A handled SQL error still aborts PostgreSQL's
// transaction unless the failing optional operation is rolled back to a savepoint.
async function withTransactionSavepoint(client, name, operation) {
  if (!/^[a-z_]+$/.test(name)) throw new Error("Invalid savepoint name.");
  await client.query(`SAVEPOINT ${name}`);
  try {
    const result = await operation();
    await client.query(`RELEASE SAVEPOINT ${name}`);
    return result;
  } catch (error) {
    await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
    await client.query(`RELEASE SAVEPOINT ${name}`);
    throw error;
  }
}

module.exports = { withTransactionSavepoint };
