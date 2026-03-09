import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const demoPasswordHash = await hash('ReplyPro123!', 10);

  const owner = await prisma.user.upsert({
    where: { email: 'owner@replypro.demo' },
    update: {
      fullName: 'ReplyPro Owner',
      isActive: true,
      passwordHash: demoPasswordHash,
    },
    create: {
      email: 'owner@replypro.demo',
      fullName: 'ReplyPro Owner',
      passwordHash: demoPasswordHash,
      isActive: true,
    },
  });

  const agent = await prisma.user.upsert({
    where: { email: 'agent@replypro.demo' },
    update: {
      fullName: 'Support Agent',
      isActive: true,
      passwordHash: demoPasswordHash,
    },
    create: {
      email: 'agent@replypro.demo',
      fullName: 'Support Agent',
      passwordHash: demoPasswordHash,
      isActive: true,
    },
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'replypro-demo' },
    update: {
      name: 'ReplyPro Demo',
      planCode: 'growth',
      timezone: 'Asia/Kuala_Lumpur',
      isActive: true,
    },
    create: {
      name: 'ReplyPro Demo',
      slug: 'replypro-demo',
      planCode: 'growth',
      timezone: 'Asia/Kuala_Lumpur',
      isActive: true,
    },
  });

  await prisma.tenantMember.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: owner.id,
      },
    },
    update: { role: 'owner' },
    create: {
      tenantId: tenant.id,
      userId: owner.id,
      role: 'owner',
    },
  });

  await prisma.tenantMember.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: agent.id,
      },
    },
    update: { role: 'agent' },
    create: {
      tenantId: tenant.id,
      userId: agent.id,
      role: 'agent',
    },
  });

  const primaryChannel = await prisma.channel.upsert({
    where: { evolutionInstanceKey: 'replypro-demo-main' },
    update: {
      tenantId: tenant.id,
      displayName: 'Sales Hotline',
      phoneNumber: '60123456789',
      evolutionInstanceName: 'replypro-demo-main',
      status: 'connected',
      metadata: {
        qualityScore: 'high',
        warmupStage: 'stable',
      },
    },
    create: {
      tenantId: tenant.id,
      displayName: 'Sales Hotline',
      phoneNumber: '60123456789',
      evolutionInstanceKey: 'replypro-demo-main',
      evolutionInstanceName: 'replypro-demo-main',
      evolutionServerKey: 'evo-node-a',
      status: 'connected',
      metadata: {
        qualityScore: 'high',
        warmupStage: 'stable',
      },
      lastConnectedAt: new Date(),
    },
  });

  const supportChannel = await prisma.channel.upsert({
    where: { evolutionInstanceKey: 'replypro-demo-support' },
    update: {
      tenantId: tenant.id,
      displayName: 'Support Line',
      phoneNumber: '60111222333',
      evolutionInstanceName: 'replypro-demo-support',
      status: 'qr_pending',
      metadata: {
        qualityScore: 'warming',
        warmupStage: 'early',
      },
    },
    create: {
      tenantId: tenant.id,
      displayName: 'Support Line',
      phoneNumber: '60111222333',
      evolutionInstanceKey: 'replypro-demo-support',
      evolutionInstanceName: 'replypro-demo-support',
      evolutionServerKey: 'evo-node-b',
      status: 'qr_pending',
      metadata: {
        qualityScore: 'warming',
        warmupStage: 'early',
      },
    },
  });

  const contactA = await prisma.contact.upsert({
    where: {
      tenantId_phoneNumber: {
        tenantId: tenant.id,
        phoneNumber: '60199888777',
      },
    },
    update: {
      name: 'Aina Sofea',
      email: 'aina@example.com',
      tags: ['vip', 'repeat-buyer'],
      customFields: {
        city: 'Shah Alam',
        source: 'landing-page',
      },
      optIn: true,
      lastSeenAt: new Date(),
    },
    create: {
      tenantId: tenant.id,
      name: 'Aina Sofea',
      phoneNumber: '60199888777',
      email: 'aina@example.com',
      tags: ['vip', 'repeat-buyer'],
      customFields: {
        city: 'Shah Alam',
        source: 'landing-page',
      },
      optIn: true,
      lastSeenAt: new Date(),
    },
  });

  const contactB = await prisma.contact.upsert({
    where: {
      tenantId_phoneNumber: {
        tenantId: tenant.id,
        phoneNumber: '60177666555',
      },
    },
    update: {
      name: 'Hakim Zulkifli',
      email: 'hakim@example.com',
      tags: ['new-lead'],
      customFields: {
        city: 'Johor Bahru',
        source: 'wa-click-to-chat',
      },
      optIn: true,
      lastSeenAt: new Date(),
    },
    create: {
      tenantId: tenant.id,
      name: 'Hakim Zulkifli',
      phoneNumber: '60177666555',
      email: 'hakim@example.com',
      tags: ['new-lead'],
      customFields: {
        city: 'Johor Bahru',
        source: 'wa-click-to-chat',
      },
      optIn: true,
      lastSeenAt: new Date(),
    },
  });

  const conversationA = await prisma.conversation.upsert({
    where: {
      tenantId_channelId_contactId: {
        tenantId: tenant.id,
        channelId: primaryChannel.id,
        contactId: contactA.id,
      },
    },
    update: {
      assignedToUserId: agent.id,
      status: 'open',
      unreadCount: 2,
      aiEnabled: true,
      lastMessageAt: new Date(),
    },
    create: {
      tenantId: tenant.id,
      channelId: primaryChannel.id,
      contactId: contactA.id,
      assignedToUserId: agent.id,
      status: 'open',
      unreadCount: 2,
      aiEnabled: true,
      lastMessageAt: new Date(),
    },
  });

  const conversationB = await prisma.conversation.upsert({
    where: {
      tenantId_channelId_contactId: {
        tenantId: tenant.id,
        channelId: supportChannel.id,
        contactId: contactB.id,
      },
    },
    update: {
      assignedToUserId: null,
      status: 'pending',
      unreadCount: 1,
      aiEnabled: false,
      lastMessageAt: new Date(),
    },
    create: {
      tenantId: tenant.id,
      channelId: supportChannel.id,
      contactId: contactB.id,
      status: 'pending',
      unreadCount: 1,
      aiEnabled: false,
      lastMessageAt: new Date(),
    },
  });

  await prisma.message.upsert({
    where: { id: '33333333-3333-3333-3333-333333333331' },
    update: {
      providerMessageId: 'demo-msg-inbound-001',
      content: 'Hi, stok produk masih ada tak?',
      status: 'read',
    },
    create: {
      id: '33333333-3333-3333-3333-333333333331',
      tenantId: tenant.id,
      conversationId: conversationA.id,
      channelId: primaryChannel.id,
      contactId: contactA.id,
      direction: 'inbound',
      providerMessageId: 'demo-msg-inbound-001',
      content: 'Hi, stok produk masih ada tak?',
      status: 'read',
      metadata: { source: 'whatsapp' },
      queuedAt: new Date(),
      sentAt: new Date(),
      deliveredAt: new Date(),
      readAt: new Date(),
    },
  });

  await prisma.message.upsert({
    where: { id: '33333333-3333-3333-3333-333333333332' },
    update: {
      providerMessageId: 'demo-msg-outbound-001',
      content: 'Hai Aina, ya stok masih ada dan boleh dihantar hari ini.',
      status: 'delivered',
    },
    create: {
      id: '33333333-3333-3333-3333-333333333332',
      tenantId: tenant.id,
      conversationId: conversationA.id,
      channelId: primaryChannel.id,
      contactId: contactA.id,
      direction: 'outbound',
      providerMessageId: 'demo-msg-outbound-001',
      content: 'Hai Aina, ya stok masih ada dan boleh dihantar hari ini.',
      status: 'delivered',
      metadata: { source: 'agent-reply' },
      queuedAt: new Date(),
      sentAt: new Date(),
      deliveredAt: new Date(),
    },
  });

  await prisma.workflowDefinition.upsert({
    where: {
      id: '11111111-1111-1111-1111-111111111111',
    },
    update: {
      tenantId: tenant.id,
      name: 'Auto Reply FAQ',
      type: 'ai_reply',
      isActive: true,
      triggerConfig: {
        keywords: ['harga', 'stok', 'delivery'],
      },
      stepsConfig: {
        mode: 'instant-ai',
        fallbackToHuman: true,
      },
    },
    create: {
      id: '11111111-1111-1111-1111-111111111111',
      tenantId: tenant.id,
      name: 'Auto Reply FAQ',
      type: 'ai_reply',
      isActive: true,
      triggerConfig: {
        keywords: ['harga', 'stok', 'delivery'],
      },
      stepsConfig: {
        mode: 'instant-ai',
        fallbackToHuman: true,
      },
    },
  });

  await prisma.campaign.upsert({
    where: {
      id: '22222222-2222-2222-2222-222222222222',
    },
    update: {
      tenantId: tenant.id,
      name: 'Promo Ramadan Demo',
      status: 'scheduled',
      audienceFilter: { tags: ['vip', 'repeat-buyer'] },
      templatePayload: {
        title: 'Promo Ramadan',
        body: 'Nikmati diskaun khas minggu ini.',
      },
    },
    create: {
      id: '22222222-2222-2222-2222-222222222222',
      tenantId: tenant.id,
      name: 'Promo Ramadan Demo',
      status: 'scheduled',
      scheduledAt: new Date(Date.now() + 3600_000),
      audienceFilter: { tags: ['vip', 'repeat-buyer'] },
      templatePayload: {
        title: 'Promo Ramadan',
        body: 'Nikmati diskaun khas minggu ini.',
      },
      createdByUserId: owner.id,
    },
  });

  await prisma.analyticsDaily.upsert({
    where: {
      tenantId_channelId_metricDate: {
        tenantId: tenant.id,
        channelId: primaryChannel.id,
        metricDate: new Date(new Date().toISOString().slice(0, 10)),
      },
    },
    update: {
      inboundCount: 120,
      outboundCount: 168,
      deliveredCount: 160,
      failedCount: 3,
      aiReplyCount: 47,
      campaignCount: 1,
    },
    create: {
      tenantId: tenant.id,
      channelId: primaryChannel.id,
      metricDate: new Date(new Date().toISOString().slice(0, 10)),
      inboundCount: 120,
      outboundCount: 168,
      deliveredCount: 160,
      failedCount: 3,
      aiReplyCount: 47,
      campaignCount: 1,
    },
  });

  console.log('Seed selesai: tenant demo, users, channels, contacts, conversations, messages.');
  console.log('Login demo owner: owner@replypro.demo / ReplyPro123!');
  console.log('Login demo agent: agent@replypro.demo / ReplyPro123!');
}

main()
  .catch((error) => {
    console.error('Seed gagal:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
