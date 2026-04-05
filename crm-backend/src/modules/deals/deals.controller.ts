import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, UseInterceptors, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DealsService } from './deals.service';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';
import {
  CreateDealSchema, CreateDealDto,
  UpdateDealSchema, UpdateDealDto,
  FilterDealSchema, FilterDealDto,
  MoveDealStageSchema, MoveDealStageDto,
} from './deals.dto';

@ApiTags('deals')
@ApiBearerAuth('JWT')
@Controller('deals')
@UseGuards(RolesGuard)
@UseInterceptors(AuditLogInterceptor)
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Get()
  async findAll(@Query(new ZodValidationPipe(FilterDealSchema)) filters: FilterDealDto) {
    return this.dealsService.findAll(filters);
  }

  @Get('kanban/:pipelineId')
  @ApiOperation({ summary: 'Get Kanban board data: deals grouped by stage' })
  async getKanbanBoard(@Param('pipelineId') pipelineId: string) {
    return this.dealsService.getKanbanBoard(pipelineId);
  }

  @Get('forecast/:pipelineId')
  @ApiOperation({ summary: 'Revenue forecast for pipeline (weighted by stage probability)' })
  async getForecast(@Param('pipelineId') pipelineId: string) {
    return this.dealsService.getForecast(pipelineId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.dealsService.findById(id);
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(CreateDealSchema)) dto: CreateDealDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.dealsService.create(dto, user.id, user.tenantId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateDealSchema)) dto: UpdateDealDto,
  ) {
    return this.dealsService.update(id, dto);
  }

  @Patch(':id/move-stage')
  @ApiOperation({ summary: 'Move deal to a different stage (Kanban drag-and-drop)' })
  async moveStage(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(MoveDealStageSchema)) dto: MoveDealStageDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.dealsService.moveStage(id, dto, user.id, user.tenantId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    return this.dealsService.delete(id);
  }
}
