import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NotFoundError } from '../../shared/errors/domain.errors';
import { ContactsRepository } from './contacts.repository';
import { CreateContactDto, UpdateContactDto } from './contacts.dto';

@Injectable()
export class ContactsService {
  constructor(private readonly contactsRepo: ContactsRepository) {}

  findAll(page = 1, limit = 20, search?: string, companyId?: string) {
    return this.contactsRepo.findAll(page, limit, search, companyId);
  }

  async findById(id: string) {
    const contact = await this.contactsRepo.findById(id);
    if (!contact) throw new NotFoundError('Contact', id);
    return contact;
  }

  create(dto: CreateContactDto, tenantId: string) {
    return this.contactsRepo.create({ ...dto, tenant: { connect: { id: tenantId } } } as Prisma.ContactCreateInput);
  }

  async update(id: string, dto: UpdateContactDto) {
    await this.findById(id);
    return this.contactsRepo.update(id, dto);
  }

  async delete(id: string) {
    await this.findById(id);
    await this.contactsRepo.delete(id);
    return { deleted: true };
  }
}
