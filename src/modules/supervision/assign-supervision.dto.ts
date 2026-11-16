import { objectIdSchema } from "@common";
import { z } from "zod";

export const assignSupervisionSchema = z.strictObject({
  supervisorId: objectIdSchema,
  driverId: objectIdSchema,
})

export type AssignSupervisionDto = z.infer<typeof assignSupervisionSchema>;