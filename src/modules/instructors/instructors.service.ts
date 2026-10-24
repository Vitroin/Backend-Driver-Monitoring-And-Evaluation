import { Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { UsersService } from '@modules/users/users.service';
import { InstructorsRepository } from './instructors.repository';

@Injectable()
export class InstructorsService {
  constructor(
    private readonly instructorsRepository: InstructorsRepository,
    private readonly usersService: UsersService,
  ) {}

  /** Adds a driver to an instructor's students. Both must be in the given organization. */
  async assignStudent(organizationId: string, instructorId: string, driverId: string): Promise<void> {
    const driver = await this.usersService.findDriverInOrganization(driverId, organizationId);
    if (!driver) throw new NotFoundException('Driver not found in this organization');

    // The Instructor model only matches instructors, and the organization is in the filter,
    // so finding the instructor and adding the student happen in one atomic update
    const instructor = await this.instructorsRepository.updateOne(
      { _id: instructorId, organization: organizationId },
      { $addToSet: { drivingStudents: driver._id } },
    );
    if (!instructor) throw new NotFoundException('Instructor not found in this organization');
  }

  /** The ids of the instructors who teach the driver (who to notify about the driver's trips). */
  async findInstructorIdsOf(driverId: string | Types.ObjectId): Promise<Types.ObjectId[]> {
    const instructors = await this.instructorsRepository.find({ drivingStudents: driverId }, { _id: 1 });
    return instructors.map((instructor) => instructor._id);
  }
}
