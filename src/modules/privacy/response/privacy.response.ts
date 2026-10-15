import { ConsentScope } from '@common/enums';
import { objectIdSchema } from '@common/types';
import { OrganizationTypes } from '@modules/organizations/organizations.enum';
import { z } from 'zod';
import { ConsentWithOrganization } from '../consent.repository';

export const consentSchema = z.object({
  id: objectIdSchema.meta({ example: '665f1c2e8b3e4a1d2c9f0a12' }),
  organization: z
    .object({ id: objectIdSchema, name: z.string().meta({ example: 'Delta Mutual Insurance' }) })
    .nullable()
    .meta({ description: 'null if the organization was deleted' }),
  scopes: z.array(z.enum(ConsentScope)),
  grantedAt: z.iso.datetime().meta({ description: '"Shared since"', example: '2026-09-05T08:00:00.000Z' }),
  revokedAt: z.iso.datetime().nullable().meta({ description: 'null while sharing is active' }),
});
export type ConsentDto = z.infer<typeof consentSchema>;

export const recipientSchema = z.object({
  id: objectIdSchema.meta({ example: '665f1c2e8b3e4a1d2c9f0a13' }),
  name: z.string().meta({ example: 'Delta Mutual Insurance' }),
  type: z.enum(OrganizationTypes).nullable(),
});
export type RecipientDto = z.infer<typeof recipientSchema>;

export const toConsentDto = (consent: ConsentWithOrganization): ConsentDto => ({
  id: consent._id.toString(),
  organization: consent.organization ? { id: consent.organization._id.toString(), name: consent.organization.name } : null,
  scopes: consent.scopes,
  grantedAt: consent.grantedAt.toISOString(),
  revokedAt: consent.revokedAt?.toISOString() ?? null,
});