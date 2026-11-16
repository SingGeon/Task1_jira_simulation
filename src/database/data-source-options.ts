import { join } from 'path';
import { DataSourceOptions } from 'typeorm';
import { AppConfig } from '../config/configuration';
import { SnakeNamingStrategy } from './snake-naming.strategy';

export function buildDataSourceOptions(config: AppConfig['db']): DataSourceOptions {
  return {
    type: 'postgres',
    host: config.host,
    port: config.port,
    username: config.user,
    password: config.password,
    database: config.name,
    entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false,
    migrationsRun: config.migrationsRun,
    dropSchema: config.dropSchema,
    logging: config.logging,
  };
}
