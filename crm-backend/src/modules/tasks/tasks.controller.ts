import {
  Controller,
  Get,
  Post,
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
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';
import {
  CreateTaskSchema,
  CreateTaskDto,
  UpdateTaskSchema,
  UpdateTaskDto,
  FilterTaskSchema,
  FilterTaskDto,
  MyTasksQuerySchema,
  MyTasksQueryDto,
} from './tasks.dto';

@ApiTags('tasks')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'List all tasks with optional filters and pagination' })
  async findAll(
    @Query(new ZodValidationPipe(FilterTaskSchema)) filters: FilterTaskDto,
  ) {
    return this.tasksService.findAll(filters);
  }

  @Get('my-tasks')
  @ApiOperation({ summary: 'Get tasks assigned to the current user (excluding DONE)' })
  async getMyTasks(
    @Query(new ZodValidationPipe(MyTasksQuerySchema)) query: MyTasksQueryDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.tasksService.getMyTasks(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single task by ID including assignee details' })
  async findOne(@Param('id') id: string) {
    return this.tasksService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  async create(
    @Body(new ZodValidationPipe(CreateTaskSchema)) dto: CreateTaskDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.tasksService.create(dto, user.id, user.tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a task' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateTaskSchema)) dto: UpdateTaskDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.tasksService.update(id, dto, user.id, user.tenantId);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Mark a task as complete' })
  async complete(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.tasksService.complete(id, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a task' })
  async remove(@Param('id') id: string) {
    return this.tasksService.delete(id);
  }
}
