export const QUEUES = {
  INBOUND_PROCESS: 'inbound-process',
  WORKFLOW_EXECUTE: 'workflow-execute',
  AI_REPLY: 'ai-reply',
  MESSAGE_SEND: 'message-send',
  CAMPAIGN_SCHEDULE: 'campaign-schedule',
  CAMPAIGN_NUMBER_DISPATCH: 'campaign-number-dispatch',
} as const;

export const JOBS = {
  INBOUND_RECEIVED: 'inbound.received',
  WORKFLOW_RUN: 'workflow.run',
  AI_GENERATE_REPLY: 'ai.generate-reply',
  MESSAGE_SEND_SINGLE: 'message.send-single',
  CAMPAIGN_PREPARE: 'campaign.prepare',
  CAMPAIGN_DISPATCH_NUMBER: 'campaign.dispatch-number',
} as const;
