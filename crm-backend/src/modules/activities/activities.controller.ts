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
import { ActivitiesService } from './activities.service';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';
import {
  CreateActivitySchema,
  CreateActivityDto,
  UpdateActivitySchema,
  UpdateActivityDto,
  FilterActivitySchema,
  FilterActivityDto,
  TimelineQuerySchema,
  TimelineQueryDto,
} from './activities.dto';

@ApiTags('activities')
@ApiBearerAuth('JWT')
@Controller('activities')
@UseGuards(RolesGuard)
@UseInterceptors(AuditLogInterceptor)
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get('timeline')
  @ApiOperation({ summary: 'Get activity timeline for a specific entity (polymorphic)' })
  async getTimeline(
    @Query(new ZodValidationPipe(TimelineQuerySchema)) query: TimelineQueryDto,
  ) {
    return this.activitiesService.getTimeline(query);
  }

  @Get()
  @ApiOperation({ summary: 'List activities with filters and pagination' })
  async findAll(
    @Query(new ZodValidationPipe(FilterActivitySchema)) filters: FilterActivityDto,
  ) {
    return this.activitiesService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get activity by ID' })
  async findOne(@Param('id') id: string) {
    return this.activitiesService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Log a new activity' })
  async create(
    @Body(new ZodValidationPipe(CreateActivitySchema)) dto: CreateActivityDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.activitiesService.create(dto, user.id, user.tenantId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an activity' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateActivitySchema)) dto: UpdateActivityDto,
  ) {
    return this.activitiesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('ADMIN', 'SALES_MANAGER' as any)
  @ApiOperation({ summary: 'Delete an activity (Manager+ only)' })
  async remove(@Param('id') id: string) {
    return this.activitiesService.delete(id);
  }
}
