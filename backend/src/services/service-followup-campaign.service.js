const { v4: uuidv4 } = require('uuid');

const DEFAULT_FOLLOWUP_MESSAGE =
  'Hi {firstName}! Ready to schedule your next {serviceName} at {businessName}? {bookingLink}';

function coercePositiveInt(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num);
}

const normalizeFollowUpCampaignStep = (raw, index = 0) => {
  const intervalDays = coercePositiveInt(raw?.intervalDays ?? raw?.interval_days);
  return {
    id: typeof raw?.id === 'string' && raw.id.trim() ? raw.id.trim() : `step-${index}-${uuidv4().slice(0, 8)}`,
    enabled: raw?.enabled !== false,
    intervalDays,
    message: typeof raw?.message === 'string' ? raw.message.trim() : '',
  };
};

const normalizeFollowUpCampaigns = (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((step, index) => normalizeFollowUpCampaignStep(step, index))
    .filter((step) => step.intervalDays != null);
};

const parseFollowUpCampaignsFromRow = (row) => {
  const raw = row?.follow_up_campaigns;
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [];
  return normalizeFollowUpCampaigns(arr);
};

const formatJobTypeLabel = (jobType) => {
  if (!jobType) return jobType;
  if (jobType === 'rebooking_initial') return 'Rebooking (initial)';
  const followupMatch = String(jobType).match(/^rebooking_followup_(\d+)$/);
  if (followupMatch) return `Rebooking (follow-up ${followupMatch[1]})`;
  return jobType;
};

const isRebookingJobType = (jobType) => {
  if (!jobType) return false;
  if (jobType === 'rebooking' || jobType === 'rebooking_initial') return true;
  return /^rebooking_followup_\d+$/.test(String(jobType));
};

const REBOOKING_JOB_TYPES = [
  'rebooking',
  'rebooking_initial',
  'rebooking_followup_1',
  'rebooking_followup_2',
];

const rebookingJobTypeSqlClause = () =>
  `(job_type = ANY($REBOOKING_TYPES::text[]) OR job_type LIKE 'rebooking_followup_%')`;

module.exports = {
  DEFAULT_FOLLOWUP_MESSAGE,
  coercePositiveInt,
  normalizeFollowUpCampaignStep,
  normalizeFollowUpCampaigns,
  parseFollowUpCampaignsFromRow,
  formatJobTypeLabel,
  isRebookingJobType,
  REBOOKING_JOB_TYPES,
  rebookingJobTypeSqlClause,
};
