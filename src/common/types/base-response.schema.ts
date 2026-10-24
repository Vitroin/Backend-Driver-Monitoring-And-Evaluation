import { z } from 'zod';

/** `{ message }`, or `{ message, data }` when a data schema is given. Used for Swagger response docs. */
export const BaseResponseSchema = <T extends z.ZodType>(data?: T) =>
  data ? z.object({ message: z.string(), data }) : z.object({ message: z.string() });

export const paginationMetaSchema = z.object({
  page: z.number().int().meta({ example: 1 }),
  limit: z.number().int().meta({ example: 20 }),
  total: z.number().int().meta({ description: 'Items matching the query, across all pages', example: 57 }),
});

/** `{ message, data: [...], meta: { page, limit, total } }`. Used for Swagger response docs. */
export const PaginatedResponseSchema = <T extends z.ZodType>(item: T) =>
  z.object({ message: z.string(), data: z.array(item), meta: paginationMetaSchema });
