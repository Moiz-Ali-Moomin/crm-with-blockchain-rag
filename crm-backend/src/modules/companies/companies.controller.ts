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
import { CompaniesService } from './companies.service';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';
import {
  CreateCompanySchema,
  CreateCompanyDto,
  UpdateCompanySchema,
  UpdateCompanyDto,
  FilterCompanySchema,
  FilterCompanyDto,
} from './companies.dto';

@ApiTags('companies')
@ApiBearerAuth('JWT')
@Controller('companies')
@UseGuards(RolesGuard)
@UseInterceptors(AuditLogInterceptor)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @ApiOperation({ summary: 'List companies with filters, search, pagination' })
  async findAll(
    @Query(new ZodValidationPipe(FilterCompanySchema)) filters: FilterCompanyDto,
  ) {
    return this.companiesService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get company by ID with contacts and deals' })
  async findOne(@Param('id') id: string) {
    return this.companiesService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new company' })
  async create(
    @Body(new ZodValidationPipe(CreateCompanySchema)) dto: CreateCompanyDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.companiesService.create(dto, user.tenantId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update company' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateCompanySchema)) dto: UpdateCompanyDto,
  ) {
    return this.companiesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('ADMIN', 'SALES_MANAGER' as any)
  @ApiOperation({ summary: 'Delete company (Manager+ only)' })
  async remove(@Param('id') id: string) {
    return this.companiesService.delete(id);
  }
}
