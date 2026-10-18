export type ReportLanguage = 'en' | 'ar';

// Everything the driver report PDF shows
export interface DriverReportData {
  driverId: string;
  driverName: string;
  reportPeriod: string;
  averageScore: number;
  totalTrips: number;
  totalIncidents: number;
  totalDrivingMinutes: number;
  incidents: { type: string; count: number; pointsLost: number }[];
  trips: { date: string; durationMinutes: number; score: number; status: string; incidentCount: number }[];
  recommendations: string[];
}
