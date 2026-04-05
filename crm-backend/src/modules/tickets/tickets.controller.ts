import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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
import { TicketsService } from './tickets.service';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';
import {
  CreateTicketSchema, CreateTicketDto,
  UpdateTicketSchema, UpdateTicketDto,
  AssignTicketSchema, AssignTicketDto,
  FilterTicketSchema, FilterTicketDto,
  CreateTicketReplySchema, CreateTicketReplyDto,
  UpdateTicketReplySchema, UpdateTicketReplyDto,
} from './tickets.dto';

@ApiTags('tickets')
@ApiBearerAuth('JWT')
@Controller('tickets')
@UseGuards(JwtAuthGuard)
@UseInterceptors(AuditLogInterceptor)
export class TicketsController {
  constructor(private readonly service: TicketsService) {}

  @Get()
  @ApiOperation({ summary: 'List all tickets with filters and pagination' })
  async findAll(
    @Query(new ZodValidationPipe(FilterTicketSchema)) filters: FilterTicketDto,
  ) {
    return this.service.findAll(filters);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new support ticket' })
  async create(
    @Body(new ZodValidationPipe(CreateTicketSchema)) dto: CreateTicketDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.create(dto, user.id, user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ticket by ID (includes contact, assignee, and replies)' })
  async findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a ticket' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateTicketSchema)) dto: UpdateTicketDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Hard delete a ticket' })
  async remove(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Patch(':id/assign')
  @ApiOperation({ summary: 'Assign a ticket to a user' })
  async assign(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AssignTicketSchema)) dto: AssignTicketDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.assign(id, dto, user.tenantId);
  }

  @Post(':id/replies')
  @ApiOperation({ summary: 'Add a reply to a ticket' })
  async addReply(
    @Param('id') ticketId: string,
    @Body(new ZodValidationPipe(CreateTicketReplySchema)) dto: CreateTicketReplyDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.addReply(ticketId, dto, user.id, user.tenantId);
  }

  @Put(':ticketId/replies/:replyId')
  @ApiOperation({ summary: 'Update a ticket reply (author only)' })
  async updateReply(
    @Param('ticketId') _ticketId: string,
    @Param('replyId') replyId: string,
    @Body(new ZodValidationPipe(UpdateTicketReplySchema)) dto: UpdateTicketReplyDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.updateReply(replyId, dto, user.id);
  }

  @Delete(':ticketId/replies/:replyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a ticket reply (author or admin)' })
  async deleteReply(
    @Param('ticketId') _ticketId: string,
    @Param('replyId') replyId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.deleteReply(replyId, user.id, user.role);
  }
}
