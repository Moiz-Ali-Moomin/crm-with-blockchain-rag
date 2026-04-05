import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, UseInterceptors, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { LeadsService } from './leads.service';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';
import {
  CreateLeadSchema, CreateLeadDto,
  UpdateLeadSchema, UpdateLeadDto,
  FilterLeadSchema, FilterLeadDto,
  AssignLeadSchema, AssignLeadDto,
  ConvertLeadSchema, ConvertLeadDto,
} from './leads.dto';

@ApiTags('leads')
@ApiBearerAuth('JWT')
@Controller('leads')
@UseGuards(RolesGuard)
@UseInterceptors(AuditLogInterceptor)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @ApiOperation({ summary: 'List leads with filters, search, pagination' })
  async findAll(
    @Query(new ZodValidationPipe(FilterLeadSchema)) filters: FilterLeadDto,
  ) {
    return this.leadsService.findAll(filters);
  }

  @Get('kanban')
  @ApiOperation({ summary: 'Kanban board grouped by status (up to 100 leads per column)' })
  async getKanbanBoard() {
    return this.leadsService.getKanbanBoard();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lead by ID' })
  async findOne(@Param('id') id: string) {
    return this.leadsService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new lead' })
  async create(
    @Body(new ZodValidationPipe(CreateLeadSchema)) dto: CreateLeadDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.leadsService.create(dto, user.id, user.tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update lead' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateLeadSchema)) dto: UpdateLeadDto,
  ) {
    return this.leadsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER)
  @ApiOperation({ summary: 'Delete lead (Manager+ only)' })
  async remove(@Param('id') id: string) {
    return this.leadsService.delete(id);
  }

  @Patch(':id/assign')
  @ApiOperation({ summary: 'Assign lead to a sales rep' })
  async assign(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AssignLeadSchema)) dto: AssignLeadDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.leadsService.assign(id, dto, user.tenantId);
  }

  @Post(':id/convert')
  @ApiOperation({ summary: 'Convert lead to contact (optionally create deal)' })
  async convert(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ConvertLeadSchema)) dto: ConvertLeadDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.leadsService.convert(id, dto, user.id, user.tenantId);
  }
}
