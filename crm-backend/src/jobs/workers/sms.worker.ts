/**
 * SMS Worker
 * Processes outbound SMS/WhatsApp messages via Twilio.
 * All Twilio API calls are made here — never in the HTTP request path.
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import Twilio from 'twilio';
import { PrismaService } from '../../core/database/prisma.service';

interface SmsJobData {
  to: string;
  body: string;
  communicationId?: string;
  channel?: 'SMS' | 'WHATSAPP';
}

@Processor('sms')
export class SmsWorker extends WorkerHost {
  private readonly logger = new Logger(SmsWorker.name);
  private readonly twilio: ReturnType<typeof Twilio>;

  constructor(private readonly prisma: PrismaService) {
    super();
    this.twilio = Twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
  }

  async process(job: Job<SmsJobData>): Promise<void> {
    const { to, body, communicationId, channel = 'SMS' } = job.data;

    this.logger.log(`Processing SMS job ${job.id} → ${to}`);

    try {
      const from =
        channel === 'WHATSAPP'
          ? process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886'
          : process.env.TWILIO_PHONE_NUMBER;

      const toAddr = channel === 'WHATSAPP' ? `whatsapp:${to}` : to;

      const message = await this.twilio.messages.create({
        from,
        to: toAddr,
        body,
      });

      this.logger.log(`SMS sent successfully. SID: ${message.sid}`);

      // Update communication record status
      if (communicationId) {
        await this.prisma.withoutTenantScope(() =>
          this.prisma.communication.update({
            where: { id: communicationId },
            data: {
              status: 'SENT',
              externalId: message.sid,
              sentAt: new Date(),
            },
          }),
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to send SMS for job ${job.id}: ${error.message}`,
        error.stack,
      );

      // Update communication record to FAILED
      if (communicationId) {
        await this.prisma.withoutTenantScope(() =>
          this.prisma.communication.update({
            where: { id: communicationId },
            data: {
              status: 'FAILED',
              metadata: { error: error.message, code: error.code } as any,
            },
          }),
        );
      }

      throw error; // Let BullMQ handle retries
    }
  }
}
