import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ListNotificationsQuerySchema, ListNotificationsQueryDto } from './notifications.dto';

@ApiTags('notifications')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user\'s notifications (supports unreadOnly filter)' })
  async findAll(
    @Query(new ZodValidationPipe(ListNotificationsQuerySchema)) query: ListNotificationsQueryDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.notificationsService.findAll(user.id, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count for current user' })
  async getUnreadCount(@CurrentUser() user: JwtUser) {
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read' })
  async markRead(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.notificationsService.markRead(id, user.id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read for current user' })
  async markAllRead(@CurrentUser() user: JwtUser) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a notification' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.notificationsService.delete(id, user.id);
  }
}
