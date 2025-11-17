import dataSource from './data-source';

async function run(): Promise<void> {
  try {
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }
    await dataSource.undoLastMigration();
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Migration revert failed', error);
  process.exitCode = 1;
});
