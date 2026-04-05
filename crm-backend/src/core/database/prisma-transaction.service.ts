/**
 * Prisma Transaction Service
 * Typed helper for running multiple operations in a single DB transaction.
 * All operations in a transaction are automatically atomic.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Prisma } from '@prisma/client';

type PrismaTransactionClient = Prisma.TransactionClient;

@Injectable()
export class PrismaTransactionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run operations in an interactive transaction with a 10s timeout.
   * Example:
   *   await this.tx.run(async (tx) => {
   *     const contact = await tx.contact.create({ data: {...} });
   *     const deal = await tx.deal.create({ data: { contactId: contact.id, ...} });
   *     return { contact, deal };
   *   });
   */
  async run<T>(
    fn: (tx: PrismaTransactionClient) => Promise<T>,
    options?: { timeout?: number; maxWait?: number },
  ): Promise<T> {
    return this.prisma.$transaction(fn, {
      timeout: options?.timeout ?? 10000,   // 10s max transaction duration
      maxWait: options?.maxWait ?? 5000,    // 5s max wait for connection
    });
  }
}
