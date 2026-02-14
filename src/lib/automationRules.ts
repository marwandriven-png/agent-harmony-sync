/**
 * Automation eligibility rules and stop conditions.
 * Implements the reputation-first, non-spammy automation policy.
 */

export type SourceClassification =
  | 'linkedin_inbound'
  | 'linkedin_outreach_response'
  | 'whatsapp_inbound'
  | 'dubai_owner_database'
  | 'referral'
  | 'cold_imported';

export type LeadStatusType =
  | 'new'
  | 'contacted'
  | 'viewing'
  | 'viewed'
  | 'negotiation'
  | 'closed'
  | 'lost';

// Statuses that trigger automation stop
export const STOP_STATUSES: LeadStatusType[] = [
  'viewing',  // "Meeting Scheduled" equivalent
  'closed',
  'lost',
];

// Sources that are NEVER eligible for automation
export const RESTRICTED_SOURCES: SourceClassification[] = [
  'cold_imported',
];

// Sources where WhatsApp is disabled by default
export const WHATSAPP_RESTRICTED_SOURCES: SourceClassification[] = [
  'cold_imported',
  'dubai_owner_database',
];

// Sources where email is limited to 1
export const EMAIL_LIMITED_SOURCES: SourceClassification[] = [
  'dubai_owner_database',
];

/**
 * Check if a lead is eligible for automation trigger.
 */
export function isAutomationEligible(lead: {
  status: string;
  source_classification: SourceClassification | null;
  contact_verified: boolean;
  automation_stopped: boolean;
  email_bounce: boolean;
  whatsapp_initiated?: boolean;
}): { eligible: boolean; reason?: string } {
  // Never restart stopped automation
  if (lead.automation_stopped) {
    return { eligible: false, reason: 'Automation was previously stopped' };
  }

  // Bounced emails permanently disable
  if (lead.email_bounce) {
    return { eligible: false, reason: 'Email bounced — permanently disabled' };
  }

  // Restricted sources
  if (lead.source_classification && RESTRICTED_SOURCES.includes(lead.source_classification)) {
    return { eligible: false, reason: `Source "${lead.source_classification}" is restricted from automation` };
  }

  // Must be qualified status
  if (lead.status !== 'contacted') {
    // "contacted" maps to "Qualified" in the CRM pipeline
    // We also allow if lead initiated contact (whatsapp_initiated)
    if (!lead.whatsapp_initiated) {
      return { eligible: false, reason: 'Lead must be in "Qualified" status or have initiated contact' };
    }
  }

  // Contact must be verified
  if (!lead.contact_verified) {
    return { eligible: false, reason: 'Contact details not verified' };
  }

  return { eligible: true };
}

/**
 * Check if automation should stop for a lead.
 */
export function shouldStopAutomation(lead: {
  status: string;
  automation_stopped: boolean;
}): { shouldStop: boolean; reason?: string } {
  if (lead.automation_stopped) {
    return { shouldStop: true, reason: 'Already stopped' };
  }
  if (STOP_STATUSES.includes(lead.status as LeadStatusType)) {
    return { shouldStop: true, reason: `Lead status changed to "${lead.status}"` };
  }
  return { shouldStop: false };
}

/**
 * Get max email count for a lead based on source.
 */
export function getMaxEmails(sourceClassification: SourceClassification | null): number {
  if (sourceClassification && EMAIL_LIMITED_SOURCES.includes(sourceClassification)) {
    return 1;
  }
  return 2; // Default max
}

/**
 * Check if WhatsApp is allowed for this lead.
 */
export function isWhatsAppAllowed(lead: {
  source_classification: SourceClassification | null;
  whatsapp_opt_in: boolean;
  whatsapp_initiated: boolean;
}): boolean {
  // WhatsApp only if initiated or opt-in
  if (!lead.whatsapp_initiated && !lead.whatsapp_opt_in) {
    return false;
  }
  // Restricted sources
  if (lead.source_classification && WHATSAPP_RESTRICTED_SOURCES.includes(lead.source_classification)) {
    return false;
  }
  return true;
}

/**
 * Map lead_source enum to source_classification.
 */
export function mapSourceToClassification(
  source: string,
  context?: { whatsapp_initiated?: boolean }
): SourceClassification {
  switch (source) {
    case 'social_media':
      return context?.whatsapp_initiated ? 'whatsapp_inbound' : 'linkedin_inbound';
    case 'referral':
      return 'referral';
    case 'cold_call':
      return 'cold_imported';
    case 'walk_in':
      return 'referral';
    case 'website':
    case 'property_portal':
      return 'linkedin_inbound';
    default:
      return 'cold_imported';
  }
}
