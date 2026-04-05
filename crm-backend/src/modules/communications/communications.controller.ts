import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CommunicationsService } from './communications.service';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';
import {
  SendEmailSchema, SendEmailDto,
  SendSmsSchema, SendSmsDto,
  FilterCommunicationSchema, FilterCommunicationDto,
} from './communications.dto';
import { PaginationSchema } from '../../common/dto/pagination.dto';

@ApiTags('communications')
@ApiBearerAuth('JWT')
@Controller('communications')
@UseGuards(JwtAuthGuard)
@UseInterceptors(AuditLogInterceptor)
export class CommunicationsController {
  constructor(private readonly service: CommunicationsService) {}

  @Get()
  @ApiOperation({ summary: 'List all communications with filters and pagination' })
  async findAll(
    @Query(new ZodValidationPipe(FilterCommunicationSchema)) filters: FilterCommunicationDto,
  ) {
    return this.service.findAll(filters);
  }

  @Post('email')
  @ApiOperation({ summary: 'Send an outbound email (optionally using a template)' })
  async sendEmail(
    @Body(new ZodValidationPipe(SendEmailSchema)) dto: SendEmailDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.sendEmail(dto, user.id, user.tenantId);
  }

  @Post('sms')
  @ApiOperation({ summary: 'Send an outbound SMS' })
  async sendSms(
    @Body(new ZodValidationPipe(SendSmsSchema)) dto: SendSmsDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.sendSms(dto, user.id, user.tenantId);
  }

  @Get('contact/:contactId')
  @ApiOperation({ summary: 'Get full communication timeline for a contact' })
  async getContactTimeline(
    @Param('contactId') contactId: string,
    @Query(new ZodValidationPipe(PaginationSchema)) pagination: { page: number; limit: number },
  ) {
    return this.service.getContactTimeline(contactId, pagination.page, pagination.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single communication by ID' })
  async findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a communication record and purge its embedding' })
  async remove(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.service.delete(id, user.tenantId);
  }
}
