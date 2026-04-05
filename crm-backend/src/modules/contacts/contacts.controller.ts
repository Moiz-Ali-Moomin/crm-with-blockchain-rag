import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ContactsService } from './contacts.service';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  CreateContactSchema, CreateContactDto,
  UpdateContactSchema, UpdateContactDto,
  ListContactsSchema, ListContactsDto,
} from './contacts.dto';

@ApiTags('contacts')
@ApiBearerAuth('JWT')
@Controller('contacts')
@UseGuards(RolesGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  findAll(
    @Query(new ZodValidationPipe(ListContactsSchema)) q: ListContactsDto,
  ) {
    return this.contactsService.findAll(q.page, q.limit, q.search, q.companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contactsService.findById(id);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(CreateContactSchema)) dto: CreateContactDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.contactsService.create(dto, user.tenantId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateContactSchema)) dto: UpdateContactDto,
  ) {
    return this.contactsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN, UserRole.SALES_MANAGER)
  remove(@Param('id') id: string) {
    return this.contactsService.delete(id);
  }
}
