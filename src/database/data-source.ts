/** DataSource used by the TypeORM CLI (migrations). */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { loadConfig } from '../config/configuration';
import { buildDataSourceOptions } from './data-source-options';

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  process.loadEnvFile?.('.env');
} catch {
  /* .env is optional */
}

export default new DataSource(buildDataSourceOptions(loadConfig().db));
