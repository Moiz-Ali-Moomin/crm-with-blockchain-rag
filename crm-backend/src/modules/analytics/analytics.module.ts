import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { LeadScoringService } from './lead-scoring.service';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, LeadScoringService],
  exports: [AnalyticsService, LeadScoringService],
})
export class AnalyticsModule {}
