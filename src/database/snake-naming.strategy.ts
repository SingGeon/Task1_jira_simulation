import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm';

const snake = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

/** Maps camelCase entity properties to snake_case table/column names. */
export class SnakeNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  tableName(className: string, customName?: string): string {
    return customName ?? snake(className);
  }
  columnName(propertyName: string, customName: string | undefined, prefixes: string[]): string {
    return snake(prefixes.concat(customName ?? propertyName).join('_'));
  }
  relationName(propertyName: string): string {
    return snake(propertyName);
  }
  joinColumnName(relationName: string, referencedColumnName: string): string {
    return snake(`${relationName}_${referencedColumnName}`);
  }
  joinTableName(first: string, second: string, firstProp: string): string {
    return snake(`${first}_${firstProp.replace(/\./g, '_')}_${second}`);
  }
  joinTableColumnName(tableName: string, propertyName: string, columnName?: string): string {
    return snake(`${tableName}_${columnName ?? propertyName}`);
  }
}
