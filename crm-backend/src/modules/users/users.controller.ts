import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';
import {
  FilterUsersSchema,
  FilterUsersDto,
  UpdateProfileSchema,
  UpdateProfileDto,
  InviteUserSchema,
  InviteUserDto,
  UpdateRoleSchema,
  UpdateRoleDto,
  ChangePasswordSchema,
  ChangePasswordDto,
} from './users.dto';

@ApiTags('users')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES_MANAGER)
  @ApiOperation({ summary: 'List all users in tenant with optional filters' })
  async findAll(
    @Query(new ZodValidationPipe(FilterUsersSchema)) filters: FilterUsersDto,
  ) {
    return this.usersService.findAll(filters);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get own profile' })
  async getProfile(@CurrentUser() user: JwtUser) {
    return this.usersService.getProfile(user.id);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SALES_MANAGER)
  @ApiOperation({ summary: 'Get a user by ID' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own profile (name, jobTitle, phone, avatar, timezone)' })
  async updateProfile(
    @Body(new ZodValidationPipe(UpdateProfileSchema)) dto: UpdateProfileDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Post('invite')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Invite a new user to the tenant' })
  async inviteUser(
    @Body(new ZodValidationPipe(InviteUserSchema)) dto: InviteUserDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.usersService.inviteUser(dto, user.tenantId);
  }

  @Patch(':id/role')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a user\'s role (ADMIN/SUPER_ADMIN only)' })
  async updateRole(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateRoleSchema)) dto: UpdateRoleDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.usersService.updateRole(id, dto, user.role);
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Deactivate a user account' })
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    if (id === user.id) {
      throw new ForbiddenException('Cannot deactivate your own account');
    }
    return this.usersService.deactivate(id);
  }

  @Patch(':id/activate')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Activate a user account' })
  async activate(@Param('id') id: string) {
    return this.usersService.activate(id);
  }

  @Patch('me/change-password')
  @ApiOperation({ summary: 'Change own password' })
  async changePassword(
    @Body(new ZodValidationPipe(ChangePasswordSchema)) dto: ChangePasswordDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.usersService.changePassword(user.id, dto);
  }
}
