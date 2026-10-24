// Emitted by TripIngestionService when a trip's status becomes COMPLETED
export const TRIP_COMPLETED_EVENT = 'trip.completed';

export interface TripCompletedEvent {
  tripId: string;
  driverId: string;
  driverName: string;
  code: string;
  score: number;
}
