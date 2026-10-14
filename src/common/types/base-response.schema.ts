import { z } from 'zod';

/** `{ message }`, or `{ message, data }` when a data schema is given. Used for Swagger response docs. */
export const BaseResponseSchema = <T extends z.ZodType>(data?: T) =>
  data ? z.object({ message: z.string(), data }) : z.object({ message: z.string() });