/**
 * Email Templates Service
 *
 * Manages reusable Handlebars email templates.
 * Supports preview rendering and template duplication.
 */

import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../shared/errors/domain.errors';
import { renderTemplate } from '../../shared/utils/template.utils';
import { EmailTemplatesRepository } from './email-templates.repository';
import {
  CreateEmailTemplateDto,
  UpdateEmailTemplateDto,
  FilterEmailTemplateDto,
  PreviewEmailTemplateDto,
} from './email-templates.dto';

@Injectable()
export class EmailTemplatesService {
  constructor(private readonly templatesRepo: EmailTemplatesRepository) {}

  async findAll(filters: FilterEmailTemplateDto) {
    return this.templatesRepo.findAll(filters);
  }

  async findById(id: string) {
    const template = await this.templatesRepo.findById(id);
    if (!template) throw new NotFoundError('Email template', id);
    return template;
  }

  async create(dto: CreateEmailTemplateDto, createdById: string, tenantId: string) {
    return this.templatesRepo.create({
      name: dto.name,
      subject: dto.subject,
      htmlBody: dto.htmlBody,
      plainText: dto.plainText,
      variables: dto.variables,
      isActive: dto.isActive,
      category: dto.category,
      createdById,
      tenant: { connect: { id: tenantId } },
    });
  }

  async update(id: string, dto: UpdateEmailTemplateDto) {
    await this.findById(id);
    return this.templatesRepo.update(id, dto);
  }

  async delete(id: string) {
    await this.findById(id);
    await this.templatesRepo.delete(id);
    return { deleted: true };
  }

  /**
   * Renders the template with the given variables and returns
   * the rendered subject, HTML, and plain text.
   */
  async preview(id: string, dto: PreviewEmailTemplateDto) {
    const template = await this.findById(id);
    const { variables } = dto;

    const renderedSubject = renderTemplate(template.subject, variables);
    const renderedHtml = renderTemplate(template.htmlBody, variables);
    const renderedText = template.plainText
      ? renderTemplate(template.plainText, variables)
      : undefined;

    return {
      subject: renderedSubject,
      html: renderedHtml,
      text: renderedText,
    };
  }

  /**
   * Creates a copy of the template with name "Copy of {original.name}"
   */
  async duplicate(id: string, createdById: string, tenantId: string) {
    const original = await this.findById(id);

    return this.templatesRepo.create({
      name: `Copy of ${original.name}`,
      subject: original.subject,
      htmlBody: original.htmlBody,
      plainText: original.plainText ?? undefined,
      variables: original.variables,
      isActive: original.isActive,
      category: original.category ?? undefined,
      createdById,
      tenant: { connect: { id: tenantId } },
    });
  }
}
