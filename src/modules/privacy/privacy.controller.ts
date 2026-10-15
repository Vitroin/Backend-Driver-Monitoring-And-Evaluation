import { AllowedRoles, BaseResponseSchema, CurrentUser, idParamSchema } from '@common';
import type { DataResponseDto, IdParam, MessageResponseDto } from '@common';
import { UserRole } from '@common/enums';
import type { UserDocument } from '@modules/users/user.model';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, StreamableFile } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiResponse } from '@nestjs/swagger';
import { grantConsentSchema, type GrantConsentDto } from './dtos/grant-consent.dto';
import { PrivacyService } from './privacy.service';
import { consentSchema, recipientSchema, type ConsentDto, type RecipientDto } from './response/privacy.response';

// No prefix: the routes keep the paths from the frontend's API contract (/consents..., /users/me/...)
@Controller()
export class PrivacyController {
  constructor(private readonly privacyService: PrivacyService) {}

  // ---------- consents: drivers only, for their own data ----------

  @AllowedRoles([UserRole.DRIVER])
  @ApiOperation({ summary: "The driver's consents, newest first, revoked ones included" })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(consentSchema.array()) })
  @Get('consents')
  listConsents(@CurrentUser() driver: UserDocument): Promise<DataResponseDto<ConsentDto[]>> {
    return this.privacyService.listConsents(driver);
  }

  @AllowedRoles([UserRole.DRIVER])
  @ApiOperation({ summary: 'Organizations the driver can share with (every organization except their own)' })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(recipientSchema.array()) })
  @Get('consents/recipients')
  listRecipients(@CurrentUser() driver: UserDocument): Promise<DataResponseDto<RecipientDto[]>> {
    return this.privacyService.listRecipients(driver);
  }

  @AllowedRoles([UserRole.DRIVER])
  @ApiOperation({ summary: 'Share data with an organization, or change what is shared with it' })
  @ApiResponse({ status: 201, standardSchema: BaseResponseSchema(consentSchema) })
  @ApiResponse({ status: 400, description: "Invalid body, unknown organization, or the driver's own organization" })
  @Post('consents')
  grantConsent(@CurrentUser() driver: UserDocument, @Body({ schema: grantConsentSchema }) dto: GrantConsentDto): Promise<DataResponseDto<ConsentDto>> {
    return this.privacyService.grantConsent(driver, dto);
  }

  @AllowedRoles([UserRole.DRIVER])
  @ApiOperation({ summary: 'Stop sharing; the consent is kept as history' })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema(consentSchema) })
  @ApiResponse({ status: 404, description: 'No such consent for this driver' })
  @Delete('consents/:id')
  revokeConsent(@CurrentUser() driver: UserDocument, @Param({ schema: idParamSchema }) { id }: IdParam): Promise<DataResponseDto<ConsentDto>> {
    return this.privacyService.revokeConsent(driver, id);
  }

  // ---------- my data: any signed-in user, for their own account ----------

  @ApiOperation({ summary: 'Download everything stored about the signed-in user as a JSON file' })
  @ApiProduces('application/json')
  @ApiResponse({ status: 200, description: 'The JSON file' })
  @Get('users/me/export')
  async exportData(@CurrentUser() user: UserDocument): Promise<StreamableFile> {
    const { filename, content } = await this.privacyService.exportData(user);
    return new StreamableFile(content, {
      type: 'application/json',
      disposition: `attachment; filename="${filename}"`,
      length: content.length,
    });
  }

  @ApiOperation({ summary: "Ask for the signed-in user's personal data to be deleted" })
  @ApiResponse({ status: 200, standardSchema: BaseResponseSchema() })
  @HttpCode(HttpStatus.OK)
  @Post('users/me/deletion-request')
  requestDeletion(@CurrentUser() user: UserDocument): Promise<MessageResponseDto> {
    return this.privacyService.requestDeletion(user);
  }
}