// Emitted by the trip-processing code when a trip's status becomes COMPLETED
export const TRIP_COMPLETED_EVENT = 'trip.completed';

export interface TripCompletedEvent {
  tripId: string;
}