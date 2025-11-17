import dataSource from './data-source';

async function run(): Promise<void> {
  try {
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }
    await dataSource.runMigrations();
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Migration execution failed', error);
  process.exitCode = 1;
});
