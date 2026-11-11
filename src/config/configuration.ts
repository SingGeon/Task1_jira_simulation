export interface AppConfig {
  port: number;
  db: {
    host: string;
    port: number;
    user: string;
    password: string;
    name: string;
    migrationsRun: boolean;
    dropSchema: boolean;
    logging: boolean;
  };
  jwt: { secret: string; accessExpiresIn: string; refreshExpiresIn: string };
  registrationEnabled: boolean;
  teamProjectsEnabled: boolean;
  admin: { email?: string; password?: string; name: string };
}

const bool = (v: string | undefined, def: boolean) =>
  v === undefined || v === '' ? def : ['true', '1', 'yes'].includes(v.toLowerCase());

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 16) {
    throw new Error('JWT_SECRET must be set and at least 16 characters long');
  }
  return {
    port: Number(env.PORT ?? 3000),
    db: {
      host: env.DB_HOST ?? 'localhost',
      port: Number(env.DB_PORT ?? 5432),
      user: env.DB_USER ?? 'postgres',
      password: env.DB_PASSWORD ?? 'postgres',
      name: env.DB_NAME ?? 'task_tracker',
      migrationsRun: bool(env.DB_MIGRATIONS_RUN, true),
      dropSchema: bool(env.DB_DROP_SCHEMA, false),
      logging: bool(env.DB_LOGGING, false),
    },
    jwt: {
      secret: jwtSecret,
      // JWT_EXPIRES_IN is the old name, kept as a fallback so existing .env files keep working.
      accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN ?? env.JWT_EXPIRES_IN ?? '15m',
      refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN ?? '30d',
    },
    registrationEnabled: bool(env.REGISTRATION_ENABLED, true),
    teamProjectsEnabled: bool(env.TEAM_PROJECTS_ENABLED, true),
    admin: {
      email: env.ADMIN_EMAIL?.toLowerCase(),
      password: env.ADMIN_PASSWORD,
      name: env.ADMIN_NAME ?? 'System Admin',
    },
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');
