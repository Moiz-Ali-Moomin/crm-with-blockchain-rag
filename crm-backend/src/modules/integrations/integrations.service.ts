/**
 * Integrations Service
 *
 * Business logic for managing third-party integrations.
 * Credentials are stored in the DB (encrypted at application level in production).
 */

import { Injectable } from '@nestjs/common';
import { NotFoundError, BusinessRuleError } from '../../shared/errors/domain.errors';
import { IntegrationType } from '@prisma/client';
import { IntegrationsRepository } from './integrations.repository';
import { ConnectIntegrationDto, UpdateIntegrationDto } from './integrations.dto';

export const INTEGRATION_CATALOG = [
  {
    type: 'STRIPE',
    name: 'Stripe',
    description: 'Payment processing and subscription billing',
    category: 'payments',
    logoUrl: 'https://stripe.com/img/v3/home/twitter.png',
    requiredCredentials: ['publishableKey', 'secretKey'],
    docsUrl: 'https://stripe.com/docs',
  },
  {
    type: 'GOOGLE_ADS',
    name: 'Google Ads',
    description: 'Track leads from Google Ads campaigns',
    category: 'advertising',
    logoUrl: 'https://ads.google.com/favicon.ico',
    requiredCredentials: ['clientId', 'clientSecret', 'refreshToken', 'customerId'],
    docsUrl: 'https://developers.google.com/google-ads/api/docs',
  },
  {
    type: 'FACEBOOK_ADS',
    name: 'Facebook Ads',
    description: 'Sync leads from Facebook Lead Ads',
    category: 'advertising',
    logoUrl: 'https://www.facebook.com/favicon.ico',
    requiredCredentials: ['accessToken', 'adAccountId'],
    docsUrl: 'https://developers.facebook.com/docs/marketing-api',
  },
  {
    type: 'ZAPIER',
    name: 'Zapier',
    description: 'Connect your CRM to 5,000+ apps via Zapier',
    category: 'automation',
    logoUrl: 'https://zapier.com/favicon.ico',
    requiredCredentials: ['webhookUrl'],
    docsUrl: 'https://zapier.com/developer',
  },
  {
    type: 'SLACK',
    name: 'Slack',
    description: 'Receive CRM notifications in your Slack workspace',
    category: 'communication',
    logoUrl: 'https://slack.com/favicon.ico',
    requiredCredentials: ['webhookUrl', 'botToken'],
    docsUrl: 'https://api.slack.com',
  },
  {
    type: 'CUSTOM',
    name: 'Custom Webhook',
    description: 'Send CRM events to any custom endpoint',
    category: 'custom',
    logoUrl: null,
    requiredCredentials: ['webhookUrl'],
    docsUrl: null,
  },
];

const REQUIRED_CREDENTIALS: Record<string, string[]> = {
  STRIPE: ['publishableKey', 'secretKey'],
  GOOGLE_ADS: ['clientId', 'clientSecret', 'refreshToken', 'customerId'],
  FACEBOOK_ADS: ['accessToken', 'adAccountId'],
  ZAPIER: ['webhookUrl'],
  SLACK: ['webhookUrl'],
  CUSTOM: ['webhookUrl'],
};

@Injectable()
export class IntegrationsService {
  constructor(private readonly integrationsRepo: IntegrationsRepository) {}

  async findAll() {
    return this.integrationsRepo.findAll();
  }

  async findByType(type: string) {
    const integration = await this.integrationsRepo.findByType(type as IntegrationType);
    if (!integration) throw new NotFoundError(`Integration of type ${type}`);
    return integration;
  }

  async getAvailableIntegrations() {
    return INTEGRATION_CATALOG;
  }

  async connect(type: string, dto: ConnectIntegrationDto, tenantId: string) {
    const integrationType = type as IntegrationType;

    // Basic credential validation
    const required = REQUIRED_CREDENTIALS[type] ?? [];
    const missingFields = required.filter((field) => !dto.credentials[field]);
    if (missingFields.length > 0) {
      throw new BusinessRuleError(
        `Missing required credentials: ${missingFields.join(', ')}`,
      );
    }

    return this.integrationsRepo.upsert(tenantId, integrationType, {
      name: dto.name ?? type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, ' '),
      isActive: true,
      credentials: dto.credentials,
      settings: dto.settings,
    });
  }

  async disconnect(type: string, tenantId: string) {
    const integrationType = type as IntegrationType;
    const existing = await this.integrationsRepo.findByType(integrationType);
    if (!existing) {
      throw new NotFoundError(`Integration of type ${type} not found or not connected`);
    }

    return this.integrationsRepo.update(tenantId, integrationType, {
      isActive: false,
      credentials: {},
    });
  }

  async updateSettings(type: string, dto: UpdateIntegrationDto, tenantId: string) {
    const integrationType = type as IntegrationType;
    const existing = await this.integrationsRepo.findByType(integrationType);
    if (!existing) {
      throw new NotFoundError(`Integration of type ${type}`);
    }

    return this.integrationsRepo.update(tenantId, integrationType, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.settings !== undefined && { settings: dto.settings }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });
  }
}
