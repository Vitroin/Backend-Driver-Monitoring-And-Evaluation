import { Controller, Get, Header, Query, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiResponse } from '@nestjs/swagger';
import { AllowedRoles, CurrentUser } from '@common';
import { UserRole } from '@common/enums';
import type { UserDocument } from '@modules/users/user.model';
import { ReportsService } from './reports.service';
import { reportLanguageQuerySchema, type ReportQueryDto } from './report-query.dto';

@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @AllowedRoles([UserRole.DRIVER])
  @ApiOperation({
    summary: "The logged in driver's performance report as a PDF",
    description: 'Totals over all their completed trips, with the 5 latest in the trip history. English or Arabic.',
  })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'The PDF, shown inline' })
  @ApiResponse({ status: 400, description: 'Language must be en or ar' })
  @ApiResponse({ status: 401, description: 'Not logged in' })
  @Header('Content-Description', 'File Transfer')
  @Get('/downloadReport')
  async myReport(
    @CurrentUser() driver: UserDocument,
    @Query({ schema: reportLanguageQuerySchema }) { language }: ReportQueryDto,
  ): Promise<StreamableFile> {
    const report = await this.reportsService.generateReportData(driver);
    const pdf = await this.reportsService.generate(report, language);
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `inline; filename="driver-report-${language}.pdf"`,
    });
  }
}
