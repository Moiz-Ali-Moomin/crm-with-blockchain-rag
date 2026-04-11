/**
 * BillingService
 *
 * Handles all three payment rails:
 *   1. Stripe  — subscription checkout, cancellation, refunds, webhooks
 *   2. PayPal  — subscription creation, activation (post-redirect), upgrade, cancel, webhooks
 *   3. Crypto  — USDC/ETH payment instructions, status tracking, admin confirmation
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  BusinessRuleError,
  ExternalServiceError,
} from '../../shared/errors/domain.errors';
import Stripe from 'stripe';
import axios from 'axios';
import { BillingRepository } from './billing.repository';
import {
  CreateCheckoutSessionDto,
  CreatePayPalSubscriptionDto,
  CreateCryptoPaymentDto,
  RefundStripeChargeDto,
  ActivatePayPalSubscriptionDto,
  UpdatePayPalPlanDto,
  ConfirmCryptoPaymentDto,
} from './billing.dto';

// ── Plan maps (read at startup, not per-request) ─────────────────────────────

const STRIPE_PLAN_PRICE_MAP: Record<string, string | undefined> = {
  free:       process.env.STRIPE_PRICE_FREE,
  starter:    process.env.STRIPE_PRICE_STARTER,
  pro:        process.env.STRIPE_PRICE_PRO,
  pro_plus:   process.env.STRIPE_PRICE_PRO_PLUS,
  ultimate:   process.env.STRIPE_PRICE_ULTIMATE,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
};

const PAYPAL_PLAN_ID_MAP: Record<string, string | undefined> = {
  starter:    process.env.PAYPAL_PLAN_STARTER,
  pro:        process.env.PAYPAL_PLAN_PRO,
  pro_plus:   process.env.PAYPAL_PLAN_PRO_PLUS,
  ultimate:   process.env.PAYPAL_PLAN_ULTIMATE,
  enterprise: process.env.PAYPAL_PLAN_ENTERPRISE,
};

// ── Plan definitions ──────────────────────────────────────────────────────────

export const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    currency: 'usd',
    interval: null,
    features: ['Up to 3 users', '500 contacts', '100 deals', 'Basic CRM features'],
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 49,
    currency: 'usd',
    interval: 'month',
    features: ['Up to 10 users', '5,000 contacts', 'Unlimited deals', 'Email integration', 'Basic analytics'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 99,
    currency: 'usd',
    interval: 'month',
    features: [
      'Up to 50 users',
      'Unlimited contacts',
      'Advanced analytics',
      'Automation workflows',
      'Webhooks',
      'API access',
    ],
  },
  {
    id: 'pro_plus',
    name: 'Pro Plus',
    price: 149,
    currency: 'usd',
    interval: 'month',
    features: [
      'Up to 100 users',
      'Unlimited contacts',
      'Everything in Pro',
      'Priority phone support',
      'Custom reporting',
      'Advanced AI features',
      'Blockchain audit trail',
    ],
  },
  {
    id: 'ultimate',
    name: 'Ultimate',
    price: 499,
    currency: 'usd',
    interval: 'month',
    features: [
      'Unlimited users',
      'Unlimited contacts & deals',
      'Dedicated account manager',
      'Custom AI model training',
      'White-label option',
      'On-premise deployment',
      'Custom SLA & contracts',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 0,
    currency: 'usd',
    interval: null,
    features: [
      'Unlimited users',
      'Dedicated infrastructure',
      'Custom integrations',
      'SSO / SAML',
      'Compliance packages',
      'Named support engineer',
      'Custom contracts',
    ],
  },
];

// ── Crypto payment TTL (24 hours) ─────────────────────────────────────────────
const CRYPTO_PAYMENT_TTL_MS = 24 * 60 * 60 * 1000;

// ── Internal shape of BillingInfo ────────────────────────────────────────────

type BillingInfoRecord = {
  id: string;
  tenantId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  paypalSubscriptionId: string | null;
  plan: string;
  status: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  private readonly stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16',
  });

  constructor(private readonly billingRepo: BillingRepository) {}

  // ── Shared helpers ───────────────────────────────────────────────────────────

  private normalizeBillingInfo(billing: NonNullable<Awaited<ReturnType<BillingRepository['findByTenantId']>>>): BillingInfoRecord {
    const b = billing as BillingInfoRecord & { paypalSubscriptionId?: string | null };
    return { ...b, paypalSubscriptionId: b.paypalSubscriptionId ?? null };
  }

  async getBillingInfo(tenantId: string): Promise<BillingInfoRecord> {
    let billing = await this.billingRepo.findByTenantId(tenantId);
    if (!billing) billing = await this.billingRepo.create(tenantId);
    return this.normalizeBillingInfo(billing);
  }

  async getPlans() {
    return PLANS;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STRIPE
  // ═══════════════════════════════════════════════════════════════════════════

  async createCheckoutSession(tenantId: string, dto: CreateCheckoutSessionDto) {
    if (dto.planId === 'free') {
      throw new BusinessRuleError('Cannot create a checkout session for the free plan');
    }

    const billing = await this.getBillingInfo(tenantId);

    let stripeCustomerId = billing.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await this.stripe.customers.create({ metadata: { tenantId } });
      stripeCustomerId = customer.id;
      await this.billingRepo.update(tenantId, { stripeCustomerId });
    }

    const priceId = STRIPE_PLAN_PRICE_MAP[dto.planId];
    if (!priceId) {
      throw new BusinessRuleError(`No Stripe price configured for plan: ${dto.planId}`);
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: dto.successUrl,
      cancel_url: dto.returnUrl,
      metadata: { tenantId, planId: dto.planId },
    });

    return { url: session.url };
  }

  async cancelSubscription(tenantId: string) {
    const billing = await this.getBillingInfo(tenantId);
    if (!billing.stripeSubscriptionId) {
      throw new BusinessRuleError('No active Stripe subscription found');
    }

    const subscription = await this.stripe.subscriptions.update(
      billing.stripeSubscriptionId,
      { cancel_at_period_end: true },
    );

    await this.billingRepo.update(tenantId, {
      cancelAtPeriodEnd: true,
      currentPeriodEnd: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000)
        : null,
    });

    return {
      message: 'Subscription will be cancelled at the end of the billing period',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000)
        : null,
    };
  }

  async getInvoices(tenantId: string) {
    const billing = await this.getBillingInfo(tenantId);
    if (!billing.stripeCustomerId) return [];

    const invoices = await this.stripe.invoices.list({
      customer: billing.stripeCustomerId,
      limit: 24,
    });

    return invoices.data.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      amount: invoice.amount_paid / 100,
      currency: invoice.currency,
      date: invoice.created ? new Date(invoice.created * 1000) : null,
      pdfUrl: invoice.invoice_pdf,
      hostedUrl: invoice.hosted_invoice_url,
    }));
  }

  /**
   * Refund the most recent paid Stripe invoice for this tenant.
   * Supports full or partial refunds.
   */
  async refundLatestStripeInvoice(tenantId: string, dto: RefundStripeChargeDto) {
    const billing = await this.getBillingInfo(tenantId);
    if (!billing.stripeCustomerId) {
      throw new BusinessRuleError('No Stripe customer found for this tenant');
    }

    // Find the most recent paid invoice
    const invoices = await this.stripe.invoices.list({
      customer: billing.stripeCustomerId,
      status: 'paid',
      limit: 1,
    });

    const invoice = invoices.data[0];
    if (!invoice) throw new BusinessRuleError('No paid invoice found to refund');

    const chargeId = typeof invoice.charge === 'string' ? invoice.charge : invoice.charge?.id;
    if (!chargeId) throw new BusinessRuleError('Invoice has no associated charge — cannot refund');

    const refundParams: Stripe.RefundCreateParams = {
      charge: chargeId,
      ...(dto.reason    && { reason: dto.reason }),
      ...(dto.amountCents && { amount: dto.amountCents }),
    };

    const refund = await this.stripe.refunds.create(refundParams);

    this.logger.log(
      `Stripe refund created: ${refund.id} status=${refund.status} ` +
      `amount=${refund.amount / 100} ${refund.currency} (tenant: ${tenantId})`,
    );

    // Full refund (no amountCents specified) → mark as cancelled
    if (!dto.amountCents && refund.status === 'succeeded') {
      await this.billingRepo.update(tenantId, { status: 'CANCELLED' });
    }

    return {
      refundId: refund.id,
      status:   refund.status,
      amount:   refund.amount / 100,
      currency: refund.currency,
      isFullRefund: !dto.amountCents,
    };
  }

  // ── Stripe Webhook ────────────────────────────────────────────────────────

  async handleWebhook(rawBody: Buffer | undefined, signature: string) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) throw new ExternalServiceError('Stripe - webhook secret not configured');
    if (!rawBody) throw new BusinessRuleError('Raw body not available');

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Stripe webhook signature verification failed: ${message}`);
      throw new BusinessRuleError(`Webhook signature verification failed: ${message}`);
    }

    this.logger.log(`Processing Stripe event: ${event.type}`);

    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        // Stripe fires this when a refund completes (immediately or asynchronously)
        case 'charge.refunded':
          await this.handleChargeRefunded(event.data.object as Stripe.Charge);
          break;

        default:
          this.logger.debug(`Unhandled Stripe event: ${event.type}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Error processing Stripe event ${event.type}: ${message}`);
      throw new ExternalServiceError('Stripe - failed to process webhook event');
    }

    return { received: true };
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const tenantId = subscription.metadata?.tenantId;
    if (!tenantId) {
      this.logger.warn(`Subscription ${subscription.id} has no tenantId in metadata`);
      return;
    }

    const planId = this.getPlanFromSubscription(subscription);

    await this.billingRepo.upsert(tenantId, {
      stripeSubscriptionId: subscription.id,
      stripeCustomerId:     subscription.customer as string,
      plan:   planId.toUpperCase(),
      status: subscription.status === 'active' ? 'ACTIVE' : subscription.status.toUpperCase(),
      currentPeriodEnd: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000)
        : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const tenantId = subscription.metadata?.tenantId;
    if (!tenantId) return;

    await this.billingRepo.upsert(tenantId, {
      stripeSubscriptionId: null,
      plan:             'FREE',
      status:           'CANCELLED',
      cancelAtPeriodEnd: false,
      currentPeriodEnd:  null,
    });
  }

  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;
    if (!customerId) return;
    const tenantId = await this.getTenantIdByCustomer(customerId);
    const billing  = await this.billingRepo.findByTenantId(tenantId);
    if (!billing) return;
    await this.billingRepo.update(billing.tenantId, { status: 'ACTIVE' });
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;
    if (!customerId) return;
    const tenantId = await this.getTenantIdByCustomer(customerId);
    const billing  = await this.billingRepo.findByTenantId(tenantId);
    if (!billing) return;
    await this.billingRepo.update(billing.tenantId, { status: 'PAST_DUE' });
  }

  /**
   * Fired when a charge is refunded on Stripe's side.
   * If the charge was fully refunded, downgrade the tenant to FREE.
   */
  private async handleChargeRefunded(charge: Stripe.Charge) {
    const customerId = charge.customer as string;
    if (!customerId) return;

    const tenantId = await this.getTenantIdByCustomer(customerId);
    if (!tenantId) return;

    // amount_refunded === amount means full refund
    const isFullRefund = charge.amount_refunded >= charge.amount;

    this.logger.log(
      `Stripe charge.refunded for tenant ${tenantId}: ` +
      `refunded=${charge.amount_refunded / 100} / total=${charge.amount / 100} ${charge.currency}`,
    );

    if (isFullRefund) {
      await this.billingRepo.update(tenantId, {
        plan:             'FREE',
        status:           'CANCELLED',
        cancelAtPeriodEnd: false,
        currentPeriodEnd:  null,
      });
    }
    // Partial refund — no status change, just logged above
  }

  private async getTenantIdByCustomer(customerId: string): Promise<string> {
    const customer = await this.stripe.customers.retrieve(customerId);
    if (customer.deleted) return '';
    return (customer as Stripe.Customer).metadata?.tenantId ?? '';
  }

  private getPlanFromSubscription(subscription: Stripe.Subscription): string {
    const priceId = subscription.items.data[0]?.price?.id;
    if (!priceId) return 'free';
    const entry = Object.entries(STRIPE_PLAN_PRICE_MAP).find(([, id]) => id === priceId);
    return entry ? entry[0] : 'pro';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYPAL
  // ═══════════════════════════════════════════════════════════════════════════

  private get paypalBaseUrl() {
    return process.env.PAYPAL_MODE === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
  }

  private async getPayPalToken(): Promise<string> {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const secret   = process.env.PAYPAL_CLIENT_SECRET;
    if (!clientId || !secret) {
      throw new ExternalServiceError('PayPal - client credentials not configured');
    }

    const { data } = await axios.post(
      `${this.paypalBaseUrl}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        auth: { username: clientId, password: secret },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );
    return data.access_token as string;
  }

  /**
   * Step 1 of PayPal flow: create the subscription and get the approval URL.
   * The frontend must redirect the user to approvalUrl.
   * After the user approves, PayPal redirects to returnUrl with ?subscription_id=...
   * The frontend should then call POST /billing/paypal/activate.
   */
  async createPayPalSubscription(tenantId: string, dto: CreatePayPalSubscriptionDto) {
    const paypalPlanId = PAYPAL_PLAN_ID_MAP[dto.planId];
    if (!paypalPlanId) {
      throw new BusinessRuleError(`No PayPal plan configured for: ${dto.planId}`);
    }

    const token = await this.getPayPalToken();
    const { data } = await axios.post(
      `${this.paypalBaseUrl}/v1/billing/subscriptions`,
      {
        plan_id: paypalPlanId,
        custom_id: tenantId, // Echoed back in all webhook events
        application_context: {
          return_url: dto.returnUrl,
          cancel_url: dto.cancelUrl,
          user_action: 'SUBSCRIBE_NOW',
          brand_name: 'NexusCRM',
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
      },
    );

    const approvalLink = data.links?.find((l: { rel: string }) => l.rel === 'approve');
    if (!approvalLink) {
      throw new ExternalServiceError('PayPal - no approval URL in subscription response');
    }

    this.logger.log(
      `PayPal subscription ${data.id} created for tenant ${tenantId} (plan: ${dto.planId})`,
    );

    return {
      subscriptionId: data.id as string,
      approvalUrl:    approvalLink.href as string,
      status:         (data.status as string) ?? 'APPROVAL_PENDING',
    };
  }

  /**
   * Step 2 of PayPal flow: called after the user approves on PayPal's site.
   * The frontend extracts subscription_id from the redirect URL and POSTs it here.
   * We verify the subscription belongs to this tenant via PayPal's API before activating.
   */
  async activatePayPalSubscription(tenantId: string, dto: ActivatePayPalSubscriptionDto) {
    const token = await this.getPayPalToken();

    // Fetch subscription details directly from PayPal to verify ownership
    const { data: sub } = await axios.get(
      `${this.paypalBaseUrl}/v1/billing/subscriptions/${dto.subscriptionId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    // Verify the custom_id (tenantId) matches — prevents cross-tenant activation
    if (sub.custom_id !== tenantId) {
      this.logger.warn(
        `PayPal activation rejected: subscription ${dto.subscriptionId} ` +
        `custom_id=${sub.custom_id} does not match tenant ${tenantId}`,
      );
      throw new BusinessRuleError('Subscription does not belong to this account');
    }

    // PayPal statuses after approval: APPROVAL_PENDING → APPROVED → ACTIVE
    const validStatuses = ['APPROVED', 'ACTIVE'];
    if (!validStatuses.includes(sub.status)) {
      throw new BusinessRuleError(
        `Subscription is not yet approved by PayPal (status: ${sub.status}). ` +
        'Please complete the approval on PayPal\'s site first.',
      );
    }

    const plan = this.getPlanFromPayPalSubscription(sub.plan_id);

    await this.billingRepo.upsert(tenantId, {
      paypalSubscriptionId: dto.subscriptionId,
      plan:   plan,
      status: sub.status === 'ACTIVE' ? 'ACTIVE' : 'TRIALING',
      currentPeriodEnd: sub.billing_info?.next_billing_time
        ? new Date(sub.billing_info.next_billing_time)
        : null,
    });

    this.logger.log(
      `PayPal subscription ${dto.subscriptionId} activated for tenant ${tenantId} ` +
      `(plan: ${plan}, status: ${sub.status})`,
    );

    return { success: true, plan, status: sub.status };
  }

  /**
   * Upgrade or downgrade an existing PayPal subscription to a different plan.
   * PayPal may return an approvalUrl if the change requires user re-confirmation.
   */
  async upgradePayPalPlan(tenantId: string, dto: UpdatePayPalPlanDto) {
    const billing = await this.getBillingInfo(tenantId);
    if (!billing.paypalSubscriptionId) {
      throw new BusinessRuleError('No active PayPal subscription found');
    }

    const newPayPalPlanId = PAYPAL_PLAN_ID_MAP[dto.planId];
    if (!newPayPalPlanId) {
      throw new BusinessRuleError(`No PayPal plan configured for: ${dto.planId}`);
    }

    const token = await this.getPayPalToken();

    const { data } = await axios.post(
      `${this.paypalBaseUrl}/v1/billing/subscriptions/${billing.paypalSubscriptionId}/revise`,
      {
        plan_id: newPayPalPlanId,
        application_context: {
          return_url: dto.returnUrl,
          cancel_url: dto.cancelUrl,
          brand_name: 'NexusCRM',
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const approvalLink = data.links?.find((l: { rel: string }) => l.rel === 'approve');

    // If PayPal doesn't require re-approval, the plan changes immediately
    if (!approvalLink) {
      await this.billingRepo.update(tenantId, {
        plan: dto.planId.toUpperCase(),
        currentPeriodEnd: data.billing_info?.next_billing_time
          ? new Date(data.billing_info.next_billing_time)
          : undefined,
      });
    }

    this.logger.log(
      `PayPal plan upgrade requested for tenant ${tenantId}: → ${dto.planId} ` +
      `(requires approval: ${!!approvalLink})`,
    );

    return {
      newPlanId:   dto.planId,
      approvalUrl: approvalLink?.href ?? null,
      immediate:   !approvalLink,
      message: approvalLink
        ? 'Redirect the user to approvalUrl to confirm the plan change'
        : 'Plan updated immediately',
    };
  }

  async cancelPayPalSubscription(tenantId: string) {
    const billing = await this.getBillingInfo(tenantId);
    if (!billing.paypalSubscriptionId) {
      throw new BusinessRuleError('No active PayPal subscription found');
    }

    const token = await this.getPayPalToken();
    await axios.post(
      `${this.paypalBaseUrl}/v1/billing/subscriptions/${billing.paypalSubscriptionId}/cancel`,
      { reason: 'Cancelled by user' },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
    );

    await this.billingRepo.update(tenantId, {
      paypalSubscriptionId: null,
      plan:             'FREE',
      status:           'CANCELLED',
      cancelAtPeriodEnd: false,
      currentPeriodEnd:  null,
    });

    return { message: 'PayPal subscription cancelled successfully' };
  }

  // ── PayPal Webhook ────────────────────────────────────────────────────────

  async handlePayPalWebhook(headers: Record<string, string>, rawBody: string) {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) throw new ExternalServiceError('PayPal - webhook ID not configured');

    // Verify signature against PayPal's verification API
    const token = await this.getPayPalToken();
    const { data: verification } = await axios.post(
      `${this.paypalBaseUrl}/v1/notifications/verify-webhook-signature`,
      {
        auth_algo:        headers['paypal-auth-algo'],
        cert_url:         headers['paypal-cert-url'],
        transmission_id:  headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time:headers['paypal-transmission-time'],
        webhook_id:       webhookId,
        webhook_event:    JSON.parse(rawBody), // PayPal requires the parsed event body
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
    );

    if (verification.verification_status !== 'SUCCESS') {
      this.logger.warn(`PayPal webhook signature verification failed: ${JSON.stringify(verification)}`);
      throw new BusinessRuleError('PayPal webhook signature verification failed');
    }

    const event = JSON.parse(rawBody);
    const subscription = event.resource;

    // custom_id is set to tenantId when we create the subscription
    const tenantId: string =
      subscription?.custom_id ??
      subscription?.subscriber?.custom_id ??
      '';

    this.logger.log(`Processing PayPal webhook: ${event.event_type} (tenant: ${tenantId || 'unknown'})`);

    switch (event.event_type) {
      // Fired when the user completes approval on PayPal's site
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        if (tenantId) {
          await this.billingRepo.upsert(tenantId, {
            paypalSubscriptionId: subscription.id,
            plan:   this.getPlanFromPayPalSubscription(subscription.plan_id),
            status: 'ACTIVE',
            currentPeriodEnd: subscription.billing_info?.next_billing_time
              ? new Date(subscription.billing_info.next_billing_time)
              : null,
          });
        }
        break;

      // Fired each time PayPal successfully charges the subscriber
      case 'PAYMENT.SALE.COMPLETED':
      case 'BILLING.SUBSCRIPTION.PAYMENT.COMPLETED':
        if (tenantId) {
          // Renew the billing period
          await this.billingRepo.update(tenantId, {
            status: 'ACTIVE',
            currentPeriodEnd: subscription.billing_info?.next_billing_time
              ? new Date(subscription.billing_info.next_billing_time)
              : undefined,
          });
          this.logger.log(`PayPal payment completed for tenant ${tenantId}`);
        }
        break;

      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.EXPIRED':
        if (tenantId) {
          await this.billingRepo.update(tenantId, {
            paypalSubscriptionId: null,
            plan:             'FREE',
            status:           'CANCELLED',
            cancelAtPeriodEnd: false,
            currentPeriodEnd:  null,
          });
        }
        break;

      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
        if (tenantId) {
          await this.billingRepo.update(tenantId, { status: 'PAST_DUE' });
          this.logger.warn(`PayPal payment failed for tenant ${tenantId}`);
        }
        break;

      // Plan revision was approved by the user
      case 'BILLING.SUBSCRIPTION.UPDATED':
        if (tenantId && subscription.plan_id) {
          await this.billingRepo.update(tenantId, {
            plan: this.getPlanFromPayPalSubscription(subscription.plan_id),
            currentPeriodEnd: subscription.billing_info?.next_billing_time
              ? new Date(subscription.billing_info.next_billing_time)
              : undefined,
          });
        }
        break;

      default:
        this.logger.debug(`Unhandled PayPal event type: ${event.event_type}`);
    }

    return { received: true };
  }

  private getPlanFromPayPalSubscription(paypalPlanId: string): string {
    const entry = Object.entries(PAYPAL_PLAN_ID_MAP).find(([, id]) => id === paypalPlanId);
    return entry ? entry[0].toUpperCase() : 'PRO';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CRYPTO PAYMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate payment instructions for a crypto-based billing payment.
   * Saves the pending intent in BillingInfo.metadata so we can track + confirm it.
   */
  async createCryptoPayment(tenantId: string, dto: CreateCryptoPaymentDto) {
    const plan = PLANS.find((p) => p.id === dto.planId);
    if (!plan || plan.price === 0) {
      throw new BusinessRuleError('Invalid plan for crypto payment');
    }

    const walletAddress = process.env.CRYPTO_WALLET_ADDRESS;
    if (!walletAddress) {
      throw new ExternalServiceError('Crypto payments not configured — CRYPTO_WALLET_ADDRESS missing');
    }

    // Annual billing = 12 months × 80% (20% discount)
    const monthlyUsd = plan.price;
    const totalUsd = dto.billingCycle === 'annual'
      ? Math.round(monthlyUsd * 12 * 0.8 * 100) / 100
      : monthlyUsd;

    // Fetch live ETH price from CoinGecko (no API key required)
    let ethPriceUsd = 3000;
    try {
      const { data } = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
        { timeout: 4000 },
      );
      ethPriceUsd = data?.ethereum?.usd ?? 3000;
    } catch {
      this.logger.warn('Could not fetch live ETH price — using fallback $3,000');
    }

    const cryptoAmount = dto.currency === 'ETH'
      ? (totalUsd / ethPriceUsd).toFixed(6)
      : totalUsd.toFixed(2); // stablecoins are 1:1 USD

    // Unique reference lets us match the incoming tx to this tenant
    const paymentRef = `CRM-${tenantId.slice(0, 8).toUpperCase()}-${Date.now()}`;
    const expiresAt  = new Date(Date.now() + CRYPTO_PAYMENT_TTL_MS).toISOString();

    // Persist the pending intent into BillingInfo.metadata
    const billing = await this.getBillingInfo(tenantId);
    const existingMeta = (billing.metadata as Record<string, unknown>) ?? {};

    await this.billingRepo.update(tenantId, {
      metadata: {
        ...existingMeta,
        pendingCryptoPayment: {
          ref:          paymentRef,
          planId:       dto.planId,
          currency:     dto.currency,
          amount:       cryptoAmount,
          amountUsd:    totalUsd,
          billingCycle: dto.billingCycle,
          walletAddress,
          ethPriceUsd:  dto.currency === 'ETH' ? ethPriceUsd : null,
          createdAt:    new Date().toISOString(),
          expiresAt,
        },
      },
    });

    this.logger.log(
      `Crypto payment intent created for tenant ${tenantId}: ` +
      `${cryptoAmount} ${dto.currency} (ref: ${paymentRef})`,
    );

    return {
      walletAddress,
      currency:     dto.currency,
      amount:       cryptoAmount,
      amountUsd:    totalUsd,
      planId:       dto.planId,
      planName:     plan.name,
      billingCycle: dto.billingCycle,
      paymentRef,
      expiresAt,
      ethPriceUsd:  dto.currency === 'ETH' ? ethPriceUsd : null,
      instructions:
        `Send exactly ${cryptoAmount} ${dto.currency} to the wallet address above. ` +
        `Include "${paymentRef}" in the transaction memo or data field so we can identify your payment. ` +
        `This payment link expires in 24 hours.`,
    };
  }

  /**
   * Check the status of a pending crypto payment for this tenant.
   * Lets the frontend poll until the admin confirms or the intent expires.
   */
  async getCryptoPaymentStatus(tenantId: string) {
    const billing = await this.getBillingInfo(tenantId);
    const meta    = (billing.metadata as Record<string, any>) ?? {};
    const pending = meta.pendingCryptoPayment;

    if (!pending) {
      return { hasPendingPayment: false };
    }

    const isExpired = new Date(pending.expiresAt) < new Date();
    if (isExpired) {
      // Clean up expired intent lazily
      await this.billingRepo.update(tenantId, {
        metadata: { ...meta, pendingCryptoPayment: null },
      });
      return { hasPendingPayment: false, isExpired: true };
    }

    return {
      hasPendingPayment: true,
      paymentRef:   pending.ref,
      planId:       pending.planId,
      currency:     pending.currency,
      amount:       pending.amount,
      amountUsd:    pending.amountUsd,
      billingCycle: pending.billingCycle,
      walletAddress:pending.walletAddress,
      expiresAt:    pending.expiresAt,
      isExpired:    false,
    };
  }

  /**
   * Admin-only: confirm a crypto payment after verifying the transaction on-chain.
   * Activates the tenant's subscription for the plan specified in the pending intent.
   */
  async adminConfirmCryptoPayment(dto: ConfirmCryptoPaymentDto) {
    const billing = await this.billingRepo.findByTenantId(dto.tenantId);
    if (!billing) throw new NotFoundException(`Billing info not found for tenant ${dto.tenantId}`);

    const meta    = (billing.metadata as Record<string, any>) ?? {};
    const pending = meta.pendingCryptoPayment;

    if (!pending) {
      throw new BusinessRuleError(
        `No pending crypto payment found for tenant ${dto.tenantId}`,
      );
    }

    // Determine subscription period based on billing cycle
    const periodMs = pending.billingCycle === 'annual'
      ? 365 * 24 * 60 * 60 * 1000
      :  30 * 24 * 60 * 60 * 1000;

    await this.billingRepo.update(dto.tenantId, {
      plan:   pending.planId.toUpperCase(),
      status: 'ACTIVE',
      currentPeriodEnd: new Date(Date.now() + periodMs),
      metadata: {
        ...meta,
        pendingCryptoPayment: null, // clear the pending intent
        lastCryptoPayment: {
          ...pending,
          confirmedAt: new Date().toISOString(),
          txHash:      dto.txHash,
        },
      },
    });

    this.logger.log(
      `Crypto payment confirmed for tenant ${dto.tenantId}: ` +
      `plan=${pending.planId}, txHash=${dto.txHash}, ref=${pending.ref}`,
    );

    return {
      success:      true,
      plan:         pending.planId,
      billingCycle: pending.billingCycle,
      txHash:       dto.txHash,
    };
  }
}
