import { TripStatus } from '@common/enums';
import { FastApiService } from '@modules/fast-api/fast-api.service';
import { IncidentsService } from '@modules/incidents/incidents.service';
import { TripsService } from '@modules/trips/trips.service';
import type { UserDocument } from '@modules/users/user.model';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { DriverReportData, ReportLanguage } from './driver-report-data';
import { reportTranslations } from './report-translations';
import { RECENT_TRIPS_COUNT } from './reports.constants';
import { rtlPdfMake } from './rtl-pdfmake';

@Injectable()
export class ReportsService {
  constructor(
    private readonly incidentsService: IncidentsService,
    private readonly tripsService: TripsService,
    private readonly fastApiService: FastApiService,
  ) {}

  private readonly logger = new Logger(ReportsService.name);

  async generate(report: DriverReportData, language: ReportLanguage): Promise<Buffer> {
    const t = reportTranslations[language];
    const isArabic = language === 'ar';

    const docDefinition: any = {
      pageSize: 'A4',
      pageMargins: [40, 48, 40, 48],

      // RTL mode is provided by pdfmake-rtl.
      ...(isArabic ? { rtl: true } : {}),

      info: {
        title: `${t.title} - ${report.driverName}`,
        subject: t.title,
        creator: 'Sahi Report Generator',
      },

      content: [
        {
          text: 'DRIVING COACH',
          style: 'brand',
          alignment: isArabic ? 'right' : 'left',
        },
        {
          text: t.title,
          style: 'title',
          alignment: isArabic ? 'right' : 'left',
        },
        {
          text: `${t.period}: ${report.reportPeriod}`,
          style: 'subtitle',
          alignment: isArabic ? 'right' : 'left',
        },

        { text: t.driverInfo, style: 'section' },
        {
          table: {
            widths: ['35%', '*'],
            body: [
              [t.name, report.driverName],
              [t.id, report.driverId],
              [t.generated, new Date().toLocaleDateString(isArabic ? 'ar-EG' : 'en-GB')],
            ],
          },
          layout: 'lightHorizontalLines',
        },

        { text: t.overview, style: 'section' },
        {
          table: {
            widths: ['35%', '*'],
            body: [
              [t.score, `${report.averageScore}/100`],
              [t.trips, String(report.totalTrips)],
              [t.incidents, String(report.totalIncidents)],
              [t.time, `${report.totalDrivingMinutes} ${t.minutes}`],
            ],
          },
          layout: 'lightHorizontalLines',
        },

        { text: t.incidentAnalysis, style: 'section' },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto'],
            body: [
              [t.type, t.count, t.pointsLost],
              ...report.incidents.map((incident) => [
                incident.type,
                String(incident.count),
                String(incident.pointsLost),
              ]),
            ],
          },
          layout: 'lightHorizontalLines',
        },

        { text: t.tripHistory, style: 'section' },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto', 'auto'],
            body: [
              [t.date, t.duration, t.score, t.status, t.incidents],
              ...report.trips.map((trip) => [
                trip.date,
                `${trip.durationMinutes} ${t.minutes}`,
                String(trip.score),
                trip.status,
                String(trip.incidentCount),
              ]),
            ],
          },
          layout: 'lightHorizontalLines',
        },

        { text: t.recommendations, style: 'section' },
        {
          ul: report.recommendations.length ? report.recommendations : [t.none],
        },
      ],

      styles: {
        brand: {
          fontSize: 11,
          bold: true,
          color: '#2563EB',
          margin: [0, 0, 0, 8],
        },
        title: {
          fontSize: 22,
          bold: true,
          color: '#0F172A',
          margin: [0, 0, 0, 8],
        },
        subtitle: {
          fontSize: 10,
          color: '#64748B',
          margin: [0, 0, 0, 10],
        },
        section: {
          fontSize: 13,
          bold: true,
          color: '#1E293B',
          margin: [0, 16, 0, 8],
        },
      },

      defaultStyle: {
        font: isArabic ? 'Cairo' : 'Roboto',
        fontSize: 9,
        alignment: isArabic ? 'right' : 'left',
      },

      footer: (currentPage: number, pageCount: number) => ({
        text: `Driving Coach | ${t.confidential} | ${currentPage}/${pageCount}`,
        alignment: 'center',
        fontSize: 8,
        color: '#64748B',
        margin: [0, 18, 0, 0],
      }),
    };

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'driving-coach-'));
    const outputPath = path.join(tempDir, 'report.pdf');

    try {
      // pdfmake-rtl exposes a Node-side write method.
      await rtlPdfMake.createPdf(docDefinition).write(outputPath);

      return await fs.readFile(outputPath);
    } catch (error) {
      throw new InternalServerErrorException('Failed to generate driver report PDF', { cause: error });
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }

  // The data generate() needs for one driver: totals over all their completed trips, plus their latest trips
  async generateReportData(driver: UserDocument): Promise<DriverReportData> {
    const driverId = driver.id;
    const [
      [longTerm],
      { data: totals },
      {
        data: { incidents },
      },
      recentTrips,
      recommendations,
    ] = await Promise.all([
      this.tripsService.averageLongTermScore(driverId),
      this.tripsService.getTotals(driverId),
      this.incidentsService.getAllIncidentsForTrip(driverId),
      this.tripsService.filterTrips(driverId, { status: TripStatus.COMPLETED, page: 1, limit: RECENT_TRIPS_COUNT }),
      this.getRecommendations(),
    ]);

    return {
      driverId,
      driverName: driver.fullName,
      reportPeriod: 'All time',
      averageScore: Math.round(longTerm?.averageScore ?? 0),
      totalTrips: totals.trips,
      totalIncidents: incidents.reduce((sum, { count }) => sum + count, 0),
      totalDrivingMinutes: Math.round(totals.durationSeconds / 60),
      // "harsh_braking" -> "harsh braking"
      incidents: incidents.map(({ _id, count, totalDeduction }) => ({
        type: _id.replaceAll('_', ' '),
        count,
        pointsLost: totalDeduction,
      })),
      trips: recentTrips.map((trip) => ({
        date: trip.startedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        durationMinutes: Math.round((trip.durationSeconds ?? 0) / 60),
        score: Math.round(trip.score ?? 0),
        status: trip.status,
        incidentCount: trip.incidents.length,
      })),
      recommendations,
    };
  }

  /**
   * Expects FastAPI to answer `{ recommendations: string[] }`. Its /coach/recommendations is still a placeholder that
   * returns `{ success, message }` and doesn't take a driver, so for now this is empty and the PDF shows "No recommendations available."
   * A FastAPI failure leaves them out instead of failing the whole report.
   */
  private async getRecommendations(): Promise<string[]> {
    try {
      const response = await this.fastApiService.getrecommendations();
      const recommendations: unknown = response?.recommendations;
      return Array.isArray(recommendations)
        ? recommendations.filter((item): item is string => typeof item === 'string')
        : [];
    } catch (error) {
      this.logger.warn(
        `Report generated without recommendations: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }
}
