import { Module } from '@nestjs/common';
import { EmailTemplatesController } from './email-templates.controller';
import { EmailTemplatesService } from './email-templates.service';
import { EmailTemplatesRepository } from './email-templates.repository';

@Module({
  imports: [],
  controllers: [EmailTemplatesController],
  providers: [EmailTemplatesService, EmailTemplatesRepository],
  exports: [EmailTemplatesService],
})
export class EmailTemplatesModule {}
