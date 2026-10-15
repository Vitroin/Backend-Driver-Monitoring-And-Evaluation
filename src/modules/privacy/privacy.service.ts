import type { DataResponseDto, MessageResponseDto } from '@common';
import { IncidentsService } from '@modules/incidents/incidents.service';
import { OrganizationsService } from '@modules/organizations/organizations.service';
import { TripsService } from '@modules/trips/trips.service';
import type { UserDocument } from '@modules/users/user.model';
import { UsersService } from '@modules/users/users.service';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Types } from 'mongoose';
import type { GrantConsentDto } from './dtos/grant-consent.dto';
import {
  CONSENT_GRANTED_EVENT,
  DELETION_REQUESTED_EVENT,
  type ConsentGrantedEvent,
  type DeletionRequestedEvent,
} from './privacy.events';
import { toConsentDto, type ConsentDto, type RecipientDto } from './response/privacy.response';
import { ConsentsRepository } from './consent.repository';

const DUPLICATE_KEY_ERROR = 11000;

/**
 * The "Privacy & data sharing" page: who can see the driver's data (consents, SRS FR-AUT-10), and the
 * user's right to a copy of their data and to ask for its deletion (Egypt's PDPL, Law 151/2020).
 * Other modules' data is reached through their services, never their repositories.
 */
@Injectable()
export class PrivacyService {
  constructor(
    private readonly consentsRepository: ConsentsRepository,
    private readonly organizationsService: OrganizationsService,
    private readonly tripsService: TripsService,
    private readonly incidentsService: IncidentsService,
    private readonly usersService: UsersService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // "Who can see my data", revoked consents included as history
  async listConsents(driver: UserDocument): Promise<DataResponseDto<ConsentDto[]>> {
    return { message: 'Consents', data: await this.findConsents(driver._id) };
  }

  // The "Organization" dropdown: every organization except the driver's own
  async listRecipients(driver: UserDocument): Promise<DataResponseDto<RecipientDto[]>> {
    const organizations = await this.organizationsService.findAllExcept(driver.organization);
    return {
      message: 'Organizations you can share with',
      data: organizations.map((organization) => ({
        id: organization._id.toString(),
        name: organization.name,
        type: organization.organizationType ?? null,
      })),
    };
  }

  // "Share data": starts sharing, or changes what is shared if a consent with that organization is already active
  async grantConsent(driver: UserDocument, dto: GrantConsentDto): Promise<DataResponseDto<ConsentDto>> {
    const organizationId = new Types.ObjectId(dto.organizationId);
    if (organizationId.equals(driver.organization) || !(await this.organizationsService.exists(organizationId))) {
      throw new BadRequestException('You cannot share data with this organization');
    }
    const scopes = [...new Set(dto.scopes)];

    const active = await this.consentsRepository.findActive(driver._id, organizationId);
    if (active) {
      await this.consentsRepository.updateById(active.id, { scopes });
      return { message: 'Sharing updated', data: await this.getConsent(active._id) };
    }

    try {
      const consent = await this.consentsRepository.create({ driver: driver._id, organization: organizationId, scopes });
      this.eventEmitter.emit(CONSENT_GRANTED_EVENT, {
        consentId: consent.id,
        driverId: driver.id,
        organizationId: dto.organizationId,
      } satisfies ConsentGrantedEvent);
      return { message: 'Data shared', data: await this.getConsent(consent._id) };
    } catch (error) {
      // Two requests at the same moment (e.g. a double click): the unique index let one in, so update that one
      if ((error as { code?: number }).code === DUPLICATE_KEY_ERROR) return this.grantConsent(driver, dto);
      throw error;
    }
  }

  // "Stop sharing": the record is kept with revokedAt set, and access stops immediately
  async revokeConsent(driver: UserDocument, consentId: string): Promise<DataResponseDto<ConsentDto>> {
    const consent = await this.consentsRepository.findOne({ _id: new Types.ObjectId(consentId), driver: driver._id });
    if (!consent) throw new NotFoundException('Consent not found');
    if (consent.revokedAt === null) {
      await this.consentsRepository.updateById(consent.id, { revokedAt: new Date() });
    }
    return { message: 'Sharing stopped', data: await this.getConsent(consent._id) };
  }

  // "Download my data": everything stored about the user in one JSON file
  async exportData(user: UserDocument): Promise<{ filename: string; content: Buffer }> {
    const [trips, incidents, consents] = await Promise.all([
      this.tripsService.findAllByDriver(user._id),
      this.incidentsService.findAllByDriver(user._id),
      this.findConsents(user._id),
    ]);

    const data = {
      exportedAt: new Date().toISOString(),
      // Never the password hash or the security stamp
      account: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
        organizationId: user.organization?.toString() ?? null,
        language: user.language,
        age: user.age,
        gender: user.gender,
        deletionRequestedAt: user.deletionRequestedAt,
      },
      trips: trips.map((trip) => trip.toJSON({ versionKey: false })),
      incidents: incidents.map((incident) => incident.toJSON({ versionKey: false })),
      consents,
    };
    return { filename: `sdems-data-${user.username}.json`, content: Buffer.from(JSON.stringify(data, null, 2)) };
  }

  // "Request deletion": recorded on the account; an administrator then deletes the data
  async requestDeletion(user: UserDocument): Promise<MessageResponseDto> {
    const firstRequest = await this.usersService.requestDeletion(user.id);
    if (firstRequest) {
      this.eventEmitter.emit(DELETION_REQUESTED_EVENT, { userId: user.id } satisfies DeletionRequestedEvent);
    }
    return { message: 'Your deletion request was recorded' };
  }

  private async findConsents(driverId: Types.ObjectId): Promise<ConsentDto[]> {
    const consents = await this.consentsRepository.findForDriver(driverId);
    return consents.map(toConsentDto);
  }

  private async getConsent(id: Types.ObjectId): Promise<ConsentDto> {
    const consent = await this.consentsRepository.findByIdWithOrganization(id);
    if (!consent) throw new NotFoundException('Consent not found');
    return toConsentDto(consent);
  }
}