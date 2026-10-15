// Emitted when a driver starts sharing with an organization; the notifications module tells its insurance analysts
export const CONSENT_GRANTED_EVENT = 'consent.granted';

export interface ConsentGrantedEvent {
  consentId: string;
  driverId: string;
  organizationId: string;
}

// Emitted the first time a user asks for their data to be deleted; the notifications module tells the administrators
export const DELETION_REQUESTED_EVENT = 'user.deletion-requested';

export interface DeletionRequestedEvent {
  userId: string;
}