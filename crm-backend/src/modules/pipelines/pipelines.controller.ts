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
import { PipelinesService } from './pipelines.service';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';
import {
  CreatePipelineSchema,
  CreatePipelineDto,
  UpdatePipelineSchema,
  UpdatePipelineDto,
  FilterPipelineSchema,
  FilterPipelineDto,
  CreateStageSchema,
  CreateStageDto,
  UpdateStageSchema,
  UpdateStageDto,
  ReorderStagesSchema,
  ReorderStagesDto,
} from './pipelines.dto';

@ApiTags('pipelines')
@ApiBearerAuth('JWT')
@Controller('pipelines')
@UseGuards(RolesGuard)
@UseInterceptors(AuditLogInterceptor)
export class PipelinesController {
  constructor(private readonly pipelinesService: PipelinesService) {}

  // ── Pipelines ───────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List pipelines with stages' })
  async findAll(
    @Query(new ZodValidationPipe(FilterPipelineSchema)) filters: FilterPipelineDto,
  ) {
    return this.pipelinesService.findAll(filters);
  }

  @Get('default')
  @ApiOperation({ summary: 'Get the default pipeline' })
  async getDefault() {
    return this.pipelinesService.getDefaultPipeline();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get pipeline by ID with stages and deal counts' })
  async findOne(@Param('id') id: string) {
    return this.pipelinesService.findById(id);
  }

  @Post()
  @Roles('ADMIN', 'SALES_MANAGER' as any)
  @ApiOperation({ summary: 'Create a pipeline (auto-seeds default stages)' })
  async create(
    @Body(new ZodValidationPipe(CreatePipelineSchema)) dto: CreatePipelineDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.pipelinesService.create(dto, user.tenantId);
  }

  @Put(':id')
  @Roles('ADMIN', 'SALES_MANAGER' as any)
  @ApiOperation({ summary: 'Update pipeline' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdatePipelineSchema)) dto: UpdatePipelineDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.pipelinesService.update(id, dto, user.tenantId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('ADMIN' as any)
  @ApiOperation({ summary: 'Delete pipeline (Admin only)' })
  async remove(@Param('id') id: string) {
    return this.pipelinesService.delete(id);
  }

  // ── Stages ──────────────────────────────────────────────────────────────────

  @Post(':pipelineId/stages')
  @Roles('ADMIN', 'SALES_MANAGER' as any)
  @ApiOperation({ summary: 'Add a stage to a pipeline' })
  async createStage(
    @Param('pipelineId') pipelineId: string,
    @Body(new ZodValidationPipe(CreateStageSchema)) dto: CreateStageDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.pipelinesService.createStage(pipelineId, dto, user.tenantId);
  }

  @Put(':pipelineId/stages/reorder')
  @Roles('ADMIN', 'SALES_MANAGER' as any)
  @ApiOperation({ summary: 'Reorder stages within a pipeline' })
  async reorderStages(
    @Param('pipelineId') pipelineId: string,
    @Body(new ZodValidationPipe(ReorderStagesSchema)) dto: ReorderStagesDto,
  ) {
    return this.pipelinesService.reorderStages(pipelineId, dto);
  }

  @Put(':pipelineId/stages/:stageId')
  @Roles('ADMIN', 'SALES_MANAGER' as any)
  @ApiOperation({ summary: 'Update a stage' })
  async updateStage(
    @Param('stageId') stageId: string,
    @Body(new ZodValidationPipe(UpdateStageSchema)) dto: UpdateStageDto,
  ) {
    return this.pipelinesService.updateStage(stageId, dto);
  }

  @Delete(':pipelineId/stages/:stageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('ADMIN', 'SALES_MANAGER' as any)
  @ApiOperation({ summary: 'Delete a stage' })
  async deleteStage(@Param('stageId') stageId: string) {
    return this.pipelinesService.deleteStage(stageId);
  }
}
