import { ConsentScope } from '@common/enums';
import { objectIdSchema } from '@common/types';
import { z } from 'zod';

export const grantConsentSchema = z.strictObject({
  organizationId: objectIdSchema.meta({ description: 'The organization to share with' }),
  scopes: z
    .array(z.enum(ConsentScope, { message: `Scope must be one of: ${Object.values(ConsentScope).join(', ')}` }))
    .min(1, { message: 'Choose at least one thing to share' }),
});

export type GrantConsentDto = z.infer<typeof grantConsentSchema>;