/**
 * Prisma Seed Script
 * Creates a demo tenant with users, leads, contacts, companies, pipeline, deals, tasks, tickets
 * Run with: npx ts-node prisma/seed.ts
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // ─── Tenant ────────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      name: 'Acme Corporation',
      slug: 'acme-corp',
      domain: 'acme.com',
      plan: 'PRO',
      isActive: true,
      settings: {
        timezone: 'America/New_York',
        dateFormat: 'MM/DD/YYYY',
        currency: 'USD',
      },
    },
  });
  console.log(`✅ Tenant: ${tenant.name} (${tenant.id})`);

  // ─── Users ─────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const adminUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@acme.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@acme.com',
      passwordHash,
      firstName: 'Alice',
      lastName: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      jobTitle: 'CRM Administrator',
      timezone: 'America/New_York',
    },
  });

  const salesManager = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'manager@acme.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'manager@acme.com',
      passwordHash,
      firstName: 'Bob',
      lastName: 'Manager',
      role: 'SALES_MANAGER',
      status: 'ACTIVE',
      jobTitle: 'Sales Manager',
      timezone: 'America/New_York',
    },
  });

  const salesRep1 = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'sarah@acme.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'sarah@acme.com',
      passwordHash,
      firstName: 'Sarah',
      lastName: 'Smith',
      role: 'SALES_REP',
      status: 'ACTIVE',
      jobTitle: 'Account Executive',
      timezone: 'America/Chicago',
    },
  });

  const salesRep2 = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'john@acme.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'john@acme.com',
      passwordHash,
      firstName: 'John',
      lastName: 'Doe',
      role: 'SALES_REP',
      status: 'ACTIVE',
      jobTitle: 'Account Executive',
      timezone: 'America/Los_Angeles',
    },
  });

  const supportAgent = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'support@acme.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'support@acme.com',
      passwordHash,
      firstName: 'Mike',
      lastName: 'Support',
      role: 'SUPPORT_AGENT',
      status: 'ACTIVE',
      jobTitle: 'Customer Support',
      timezone: 'America/New_York',
    },
  });

  console.log(`✅ Users: admin, manager, 2 sales reps, support agent`);

  // ─── Pipeline & Stages ─────────────────────────────────────────────────────
  const existingPipeline = await prisma.pipeline.findFirst({
    where: { tenantId: tenant.id, isDefault: true },
  });

  let pipeline = existingPipeline;
  if (!pipeline) {
    pipeline = await prisma.pipeline.create({
      data: {
        tenantId: tenant.id,
        name: 'Sales Pipeline',
        isDefault: true,
      },
    });

    const stagesData = [
      { name: 'Prospecting', position: 0, probability: 0.1, color: '#94a3b8', isWon: false, isLost: false },
      { name: 'Qualification', position: 1, probability: 0.25, color: '#60a5fa', isWon: false, isLost: false },
      { name: 'Proposal', position: 2, probability: 0.5, color: '#a78bfa', isWon: false, isLost: false },
      { name: 'Negotiation', position: 3, probability: 0.75, color: '#f59e0b', isWon: false, isLost: false },
      { name: 'Closed Won', position: 4, probability: 1.0, color: '#22c55e', isWon: true, isLost: false },
      { name: 'Closed Lost', position: 5, probability: 0.0, color: '#ef4444', isWon: false, isLost: true },
    ];

    for (const s of stagesData) {
      await prisma.stage.create({
        data: { ...s, pipelineId: pipeline.id, tenantId: tenant.id },
      });
    }
  }

  const stages = await prisma.stage.findMany({
    where: { pipelineId: pipeline.id },
    orderBy: { position: 'asc' },
  });

  console.log(`✅ Pipeline: ${pipeline.name} with ${stages.length} stages`);

  // ─── Companies ─────────────────────────────────────────────────────────────
  const companiesData = [
    { name: 'TechVision Inc', industry: 'Technology', employeeCount: 250, annualRevenue: 15000000, website: 'https://techvision.com' },
    { name: 'Global Retail Co', industry: 'Retail', employeeCount: 1200, annualRevenue: 85000000, website: 'https://globalretail.com' },
    { name: 'Healthcare Plus', industry: 'Healthcare', employeeCount: 500, annualRevenue: 32000000, website: 'https://healthcareplus.com' },
    { name: 'FinServ Partners', industry: 'Financial Services', employeeCount: 180, annualRevenue: 22000000, website: 'https://finservpartners.com' },
    { name: 'EduTech Academy', industry: 'Education', employeeCount: 90, annualRevenue: 5500000, website: 'https://edutech.com' },
  ];

  const companies: any[] = [];
  for (const c of companiesData) {
    const existing = await prisma.company.findFirst({ where: { tenantId: tenant.id, name: c.name } });
    if (existing) {
      companies.push(existing);
    } else {
      const company = await prisma.company.create({
        data: { ...c, tenantId: tenant.id, ownerId: salesManager.id },
      });
      companies.push(company);
    }
  }
  console.log(`✅ Companies: ${companies.length}`);

  // ─── Contacts ──────────────────────────────────────────────────────────────
  const contactsData = [
    { firstName: 'David', lastName: 'Chen', email: 'david.chen@techvision.com', phone: '+1-415-555-0101', jobTitle: 'CTO', companyIdx: 0 },
    { firstName: 'Emma', lastName: 'Johnson', email: 'emma.j@globalretail.com', phone: '+1-312-555-0102', jobTitle: 'VP Operations', companyIdx: 1 },
    { firstName: 'James', lastName: 'Williams', email: 'j.williams@healthcareplus.com', phone: '+1-617-555-0103', jobTitle: 'Director of IT', companyIdx: 2 },
    { firstName: 'Lisa', lastName: 'Brown', email: 'lisa.b@finservpartners.com', phone: '+1-212-555-0104', jobTitle: 'CFO', companyIdx: 3 },
    { firstName: 'Tom', lastName: 'Davis', email: 'tom.d@edutech.com', phone: '+1-650-555-0105', jobTitle: 'CEO', companyIdx: 4 },
    { firstName: 'Amanda', lastName: 'Wilson', email: 'amanda@techvision.com', phone: '+1-415-555-0106', jobTitle: 'Head of Sales', companyIdx: 0 },
  ];

  const contacts: any[] = [];
  for (const c of contactsData) {
    const existing = await prisma.contact.findFirst({ where: { tenantId: tenant.id, email: c.email } });
    if (existing) {
      contacts.push(existing);
    } else {
      const { companyIdx, ...contactData } = c;
      const contact = await prisma.contact.create({
        data: { ...contactData, tenantId: tenant.id, companyId: companies[companyIdx].id },
      });
      contacts.push(contact);
    }
  }
  console.log(`✅ Contacts: ${contacts.length}`);

  // ─── Leads ─────────────────────────────────────────────────────────────────
  const leadsData = [
    { firstName: 'Rachel', lastName: 'Green', email: 'rachel@startup.io', phone: '+1-408-555-0201', companyName: 'Startup.io', source: 'WEBSITE', status: 'NEW', score: 65, assigneeId: salesRep1.id },
    { firstName: 'Marcus', lastName: 'White', email: 'marcus@bigcorp.com', phone: '+1-202-555-0202', companyName: 'BigCorp Inc', source: 'REFERRAL', status: 'CONTACTED', score: 80, assigneeId: salesRep1.id },
    { firstName: 'Sophia', lastName: 'Martinez', email: 'sophia@designco.com', phone: '+1-305-555-0203', companyName: 'Design Co', source: 'SOCIAL_MEDIA', status: 'QUALIFIED', score: 90, assigneeId: salesRep2.id },
    { firstName: 'Daniel', lastName: 'Taylor', email: 'daniel@mediagroup.com', phone: '+1-617-555-0204', companyName: 'Media Group', source: 'GOOGLE_ADS', status: 'NURTURING', score: 55, assigneeId: salesRep2.id },
    { firstName: 'Olivia', lastName: 'Anderson', email: 'olivia@cloudtech.com', phone: '+1-206-555-0205', companyName: 'CloudTech', source: 'EMAIL_CAMPAIGN', status: 'NEW', score: 40, assigneeId: null },
    { firstName: 'William', lastName: 'Jackson', email: 'william@enterprise.com', phone: '+1-214-555-0206', companyName: 'Enterprise Solutions', source: 'COLD_CALL', status: 'QUALIFIED', score: 75, assigneeId: salesRep1.id },
    { firstName: 'Isabella', lastName: 'Thomas', email: 'isabella@retail.net', phone: '+1-312-555-0207', companyName: 'Retail Networks', source: 'TRADE_SHOW', status: 'CONTACTED', score: 60, assigneeId: salesRep2.id },
    { firstName: 'Ethan', lastName: 'Harris', email: 'ethan@fintech.io', phone: '+1-415-555-0208', companyName: 'FinTech IO', source: 'PARTNER', status: 'UNQUALIFIED', score: 20, assigneeId: null },
  ];

  for (const l of leadsData) {
    const existing = await prisma.lead.findFirst({ where: { tenantId: tenant.id, email: l.email } });
    if (!existing) {
      const { assigneeId, ...leadFields } = l;
      await prisma.lead.create({
        data: {
          ...leadFields,
          tenantId: tenant.id,
          createdById: adminUser.id,
          ...(assigneeId && { assigneeId }),
        } as any,
      });
    }
  }
  console.log(`✅ Leads: ${leadsData.length}`);

  // ─── Deals ─────────────────────────────────────────────────────────────────
  const dealsData = [
    { title: 'TechVision CRM Enterprise License', value: 75000, contactIdx: 0, stageIdx: 3, ownerId: salesRep1.id },
    { title: 'Global Retail Inventory Management', value: 120000, contactIdx: 1, stageIdx: 2, ownerId: salesRep2.id },
    { title: 'Healthcare Plus Patient Portal', value: 45000, contactIdx: 2, stageIdx: 1, ownerId: salesRep1.id },
    { title: 'FinServ Partners Analytics Suite', value: 95000, contactIdx: 3, stageIdx: 4, ownerId: salesRep2.id, wonAt: new Date('2024-01-15') },
    { title: 'EduTech LMS Integration', value: 28000, contactIdx: 4, stageIdx: 0, ownerId: salesRep1.id },
    { title: 'TechVision Support Contract', value: 18000, contactIdx: 5, stageIdx: 2, ownerId: salesRep2.id },
    { title: 'Global Retail Mobile App', value: 65000, contactIdx: 1, stageIdx: 1, ownerId: salesManager.id },
    { title: 'Healthcare Plus Billing System', value: 55000, contactIdx: 2, stageIdx: 5, ownerId: salesRep1.id, status: 'LOST' as const },
  ];

  for (const d of dealsData) {
    const existing = await prisma.deal.findFirst({ where: { tenantId: tenant.id, title: d.title } });
    if (!existing) {
      const { contactIdx, stageIdx, ...dealData } = d;
      await prisma.deal.create({
        data: {
          ...dealData,
          tenantId: tenant.id,
          pipelineId: pipeline.id,
          stageId: stages[stageIdx].id,
          contactId: contacts[contactIdx].id,
          companyId: companies[contactIdx < companies.length ? contactIdx : 0].id,
          status: d.status || 'OPEN',
          closingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    }
  }
  console.log(`✅ Deals: ${dealsData.length}`);

  // ─── Tasks ─────────────────────────────────────────────────────────────────
  const tasksData = [
    { title: 'Follow up with TechVision about proposal', status: 'TODO', priority: 'HIGH', assigneeId: salesRep1.id, dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) },
    { title: 'Send contract to Global Retail', status: 'IN_PROGRESS', priority: 'URGENT', assigneeId: salesRep2.id, dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) },
    { title: 'Demo call with Healthcare Plus', status: 'TODO', priority: 'HIGH', assigneeId: salesRep1.id, dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
    { title: 'Quarterly review presentation', status: 'TODO', priority: 'MEDIUM', assigneeId: salesManager.id, dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    { title: 'Update CRM with prospect notes', status: 'TODO', priority: 'LOW', assigneeId: salesRep2.id, dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) },
  ];

  for (const t of tasksData) {
    const existing = await prisma.task.findFirst({ where: { tenantId: tenant.id, title: t.title } });
    if (!existing) {
      await prisma.task.create({
        data: { ...t, tenantId: tenant.id, createdById: adminUser.id } as any,
      });
    }
  }
  console.log(`✅ Tasks: ${tasksData.length}`);

  // ─── Activities ────────────────────────────────────────────────────────────
  await prisma.activity.createMany({
    skipDuplicates: true,
    data: [
      { tenantId: tenant.id, type: 'CALL', entityType: 'CONTACT', entityId: contacts[0].id, subject: 'Discovery call with David Chen', body: 'Discussed current pain points with legacy CRM. Very interested in enterprise features.', duration: 45, createdById: salesRep1.id },
      { tenantId: tenant.id, type: 'EMAIL', entityType: 'CONTACT', entityId: contacts[1].id, subject: 'Proposal follow-up', body: 'Sent updated proposal with revised pricing for 500 user license.', createdById: salesRep2.id },
      { tenantId: tenant.id, type: 'MEETING', entityType: 'CONTACT', entityId: contacts[2].id, subject: 'Product demo', body: 'Full product demo conducted. Team was impressed with the reporting features.', duration: 90, createdById: salesRep1.id },
      { tenantId: tenant.id, type: 'NOTE', entityType: 'COMPANY', entityId: companies[0].id, subject: 'Company background research', body: 'TechVision is expanding their sales team from 30 to 80 reps. Perfect timing for CRM upgrade.', createdById: salesManager.id },
    ],
  });
  console.log(`✅ Activities: 4`);

  // ─── Tickets ───────────────────────────────────────────────────────────────
  const ticketsData = [
    { subject: 'Cannot export reports to Excel', description: 'When clicking the export button in reports, nothing happens. Browser console shows a JS error.', status: 'OPEN', priority: 'HIGH', contactId: contacts[0].id, assigneeId: supportAgent.id },
    { subject: 'API rate limit reached unexpectedly', description: 'Our integration is hitting rate limits at only 50 requests/min, but the plan says 200/min.', status: 'IN_PROGRESS', priority: 'URGENT', contactId: contacts[1].id, assigneeId: supportAgent.id },
    { subject: 'Email notifications not being received', description: 'Users are not receiving email notifications for new lead assignments.', status: 'RESOLVED', priority: 'MEDIUM', contactId: contacts[2].id, assigneeId: supportAgent.id, resolvedAt: new Date() },
    { subject: 'Mobile app crashes on iOS 17', description: 'The mobile app immediately crashes when launching on devices running iOS 17.', status: 'OPEN', priority: 'HIGH', contactId: contacts[3].id, assigneeId: null },
  ];

  for (const t of ticketsData) {
    const existing = await prisma.ticket.findFirst({ where: { tenantId: tenant.id, subject: t.subject } });
    if (!existing) {
      const ticket = await prisma.ticket.create({
        data: { ...t, tenantId: tenant.id, createdById: adminUser.id } as any,
      });

      // Add replies to first ticket
      if (t.subject === 'Cannot export reports to Excel') {
        await prisma.ticketReply.create({
          data: {
            ticketId: ticket.id,
            tenantId: tenant.id,
            body: 'Thank you for reporting this. We have reproduced the issue and our dev team is investigating. Expected fix: within 48 hours.',
            authorId: supportAgent.id,
            isInternal: false,
          },
        });
        await prisma.ticketReply.create({
          data: {
            ticketId: ticket.id,
            tenantId: tenant.id,
            body: 'Internal note: This is a known issue with Safari. Chrome and Firefox work fine. Temp workaround: use PDF export.',
            authorId: adminUser.id,
            isInternal: true,
          },
        });
      }
    }
  }
  console.log(`✅ Tickets: ${ticketsData.length}`);

  // ─── Email Templates ───────────────────────────────────────────────────────
  const templatesData = [
    {
      name: 'Welcome Email',
      subject: 'Welcome to {{companyName}}, {{firstName}}!',
      htmlBody: `<html><body><h1>Welcome, {{firstName}}!</h1><p>We\'re excited to have you on board at {{companyName}}.</p><p>Your account is ready. <a href="{{loginUrl}}">Login here</a>.</p></body></html>`,
      variables: ['firstName', 'companyName', 'loginUrl'],
      category: 'onboarding',
      isActive: true,
    },
    {
      name: 'Lead Follow-up',
      subject: 'Following up on your interest, {{firstName}}',
      htmlBody: `<html><body><p>Hi {{firstName}},</p><p>I wanted to follow up on your recent inquiry about {{productName}}.</p><p>Would you be available for a 15-minute call this week?</p><p>Best,<br/>{{senderName}}</p></body></html>`,
      variables: ['firstName', 'productName', 'senderName'],
      category: 'sales',
      isActive: true,
    },
    {
      name: 'Deal Won Notification',
      subject: 'Congratulations! Deal closed: {{dealTitle}}',
      htmlBody: '<html><body><h2>🎉 Deal Won!</h2><p><strong>Deal:</strong> {{dealTitle}}</p><p><strong>Value:</strong> ${{dealValue}}</p><p><strong>Client:</strong> {{clientName}}</p></body></html>',
      variables: ['dealTitle', 'dealValue', 'clientName'],
      category: 'notifications',
      isActive: true,
    },
  ];

  for (const t of templatesData) {
    const existing = await prisma.emailTemplate.findFirst({ where: { tenantId: tenant.id, name: t.name } });
    if (!existing) {
      await prisma.emailTemplate.create({
        data: { ...t, tenantId: tenant.id, createdById: adminUser.id },
      });
    }
  }
  console.log(`✅ Email Templates: ${templatesData.length}`);

  // ─── Notifications ─────────────────────────────────────────────────────────
  await prisma.notification.createMany({
    skipDuplicates: true,
    data: [
      { tenantId: tenant.id, userId: salesRep1.id, title: 'New lead assigned', body: 'Rachel Green has been assigned to you', type: 'lead_assigned', isRead: false },
      { tenantId: tenant.id, userId: salesRep2.id, title: 'Deal stage updated', body: 'FinServ Partners Analytics Suite moved to Closed Won', type: 'deal_updated', isRead: true, readAt: new Date() },
      { tenantId: tenant.id, userId: supportAgent.id, title: 'New ticket assigned', body: 'Cannot export reports to Excel - Priority: HIGH', type: 'ticket_assigned', isRead: false },
      { tenantId: tenant.id, userId: salesManager.id, title: 'Monthly target reached', body: 'Congratulations! Your team reached 105% of monthly target', type: 'milestone', isRead: false },
    ],
  });
  console.log(`✅ Notifications: 4`);

  // ─── Billing Info ──────────────────────────────────────────────────────────
  const existingBilling = await prisma.billingInfo.findUnique({ where: { tenantId: tenant.id } });
  if (!existingBilling) {
    await prisma.billingInfo.create({
      data: {
        tenantId: tenant.id,
        plan: 'PRO',
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  }
  console.log(`✅ Billing info created`);

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📋 Demo Credentials:');
  console.log('   Admin:         admin@acme.com     / Password123!');
  console.log('   Sales Manager: manager@acme.com   / Password123!');
  console.log('   Sales Rep 1:   sarah@acme.com     / Password123!');
  console.log('   Sales Rep 2:   john@acme.com      / Password123!');
  console.log('   Support:       support@acme.com   / Password123!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
