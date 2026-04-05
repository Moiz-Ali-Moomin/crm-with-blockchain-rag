/**
 * Companies Service
 * Business logic for company management.
 * Enqueues outbound webhooks and emits WebSocket events on create.
 */

import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../shared/errors/domain.errors';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CompaniesRepository } from './companies.repository';
import { WsService } from '../../core/websocket/ws.service';
import { QUEUE_NAMES, QUEUE_JOB_OPTIONS } from '../../core/queue/queue.constants';
import { CreateCompanyDto, UpdateCompanyDto, FilterCompanyDto } from './companies.dto';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly companiesRepo: CompaniesRepository,
    private readonly ws: WsService,
    @InjectQueue(QUEUE_NAMES.WEBHOOK_OUTBOUND) private readonly webhookQueue: Queue,
  ) {}

  async findAll(filters: FilterCompanyDto) {
    return this.companiesRepo.findAll(filters);
  }

  async findById(id: string) {
    const company = await this.companiesRepo.findById(id);
    if (!company) throw new NotFoundError('Company', id);
    return company;
  }

  async create(dto: CreateCompanyDto, tenantId: string) {
    const { ownerId, annualRevenue, ...rest } = dto;

    const { customFields, ...spreadRest } = rest;
    const company = await this.companiesRepo.create({
      ...spreadRest,
      customFields: customFields as any,
      ...(annualRevenue !== undefined && { annualRevenue }),
      tenant: { connect: { id: tenantId } },
      ...(ownerId && { owner: { connect: { id: ownerId } } }),
    } as any);

    await this.webhookQueue.add(
      'deliver',
      { tenantId, event: 'COMPANY_CREATED', payload: company },
      QUEUE_JOB_OPTIONS.webhook,
    );

    this.ws.emitToTenant(tenantId, 'company:created', { company });

    return company;
  }

  async update(id: string, dto: UpdateCompanyDto) {
    await this.findById(id);

    const { ownerId, annualRevenue, ...rest } = dto;

    const { customFields: updateCustomFields, ...updateRest } = rest;
    return this.companiesRepo.update(id, {
      ...updateRest,
      ...(updateCustomFields !== undefined && { customFields: updateCustomFields as any }),
      ...(annualRevenue !== undefined && { annualRevenue }),
      ...(ownerId !== undefined && {
        owner: ownerId ? { connect: { id: ownerId } } : { disconnect: true },
      }),
    } as any);
  }

  async delete(id: string) {
    await this.findById(id);
    await this.companiesRepo.delete(id);
    return { deleted: true };
  }
}
