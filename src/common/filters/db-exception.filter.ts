import { ArgumentsHost, Catch, ConflictException, ExceptionFilter, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { EntityNotFoundError, QueryFailedError } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

/**
 * Translates database errors that slip past service-level checks (e.g. races)
 * into proper HTTP responses instead of 500s.
 */
@Catch(QueryFailedError, EntityNotFoundError)
export class DbExceptionFilter extends BaseExceptionFilter implements ExceptionFilter {
  catch(exception: QueryFailedError | EntityNotFoundError, host: ArgumentsHost) {
    let mapped: HttpException | null = null;
    if (exception instanceof EntityNotFoundError) {
      mapped = new NotFoundException('Resource not found');
    } else {
      const code = (exception as QueryFailedError & { driverError?: { code?: string } }).driverError?.code;
      if (code === '23505') mapped = new ConflictException('Resource already exists (unique constraint)');
      if (code === '23503') mapped = new ConflictException('Resource is referenced by other data');
    }
    super.catch(mapped ?? exception, host);
  }
}
