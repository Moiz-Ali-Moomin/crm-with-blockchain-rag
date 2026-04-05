import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { EmailTemplatesService } from './email-templates.service';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';
import {
  CreateEmailTemplateSchema, CreateEmailTemplateDto,
  UpdateEmailTemplateSchema, UpdateEmailTemplateDto,
  FilterEmailTemplateSchema, FilterEmailTemplateDto,
  PreviewEmailTemplateSchema, PreviewEmailTemplateDto,
} from './email-templates.dto';

@ApiTags('email-templates')
@ApiBearerAuth('JWT')
@Controller('email-templates')
@UseGuards(JwtAuthGuard)
@UseInterceptors(AuditLogInterceptor)
export class EmailTemplatesController {
  constructor(private readonly service: EmailTemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'List all email templates (no htmlBody for performance)' })
  async findAll(
    @Query(new ZodValidationPipe(FilterEmailTemplateSchema)) filters: FilterEmailTemplateDto,
  ) {
    return this.service.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single email template by ID (full data including htmlBody)' })
  async findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new email template' })
  async create(
    @Body(new ZodValidationPipe(CreateEmailTemplateSchema)) dto: CreateEmailTemplateDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.create(dto, user.id, user.tenantId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an existing email template' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateEmailTemplateSchema)) dto: UpdateEmailTemplateDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an email template' })
  async remove(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Post(':id/preview')
  @ApiOperation({ summary: 'Preview a rendered email template with sample variables' })
  async preview(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(PreviewEmailTemplateSchema)) dto: PreviewEmailTemplateDto,
  ) {
    return this.service.preview(id, dto);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate a template — creates a copy named "Copy of {name}"' })
  async duplicate(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.duplicate(id, user.id, user.tenantId);
  }
}
