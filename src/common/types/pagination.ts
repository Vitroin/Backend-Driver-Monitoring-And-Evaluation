import { z } from 'zod';
import type { Page, PaginatedResponseDto } from '../interfaces/base.response';

/** `?page=&limit=`, spread into a route's query schema. */
export const paginationQueryShape = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};
export const paginationQuerySchema = z.strictObject(paginationQueryShape);
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** How many items to skip to reach the requested page. */
export const skipFor = ({ page, limit }: PaginationQuery): number => (page - 1) * limit;

/** Wraps one page of a list in the response envelope. */
export function paginated<T>(message: string, { items, total }: Page<T>, { page, limit }: PaginationQuery): PaginatedResponseDto<T> {
  return { message, data: items, meta: { page, limit, total } };
}
