/**
 * Restore Southlake post-service SMS to the review-request message (demo copy).
 * Replaces migration 058/060 "thanks for visiting + call CTA" defaults only.
 */
const {
  SOUTHLAKE_POST_SERVICE_REVIEW_MESSAGE,
  isMigrationDefaultPostServiceMessage,
} = require('../../config/southlakeAutoShop');

exports.up = async function up(knex) {
  const tenants = await knex('tenants')
    .whereRaw('name ILIKE ? OR name ILIKE ?', ['%southlake%', '%autocare%'])
    .select('id', 'appointment_automation_config');

  for (const tenant of tenants) {
    let config = tenant.appointment_automation_config;
    if (typeof config === 'string') {
      try {
        config = JSON.parse(config);
      } catch {
        config = {};
      }
    }
    if (!config || typeof config !== 'object') config = {};

    const post = config.post_appointment || {};
    const steps = Array.isArray(post.steps) ? [...post.steps] : [];

    if (steps.length === 0) {
      steps.push({
        id: 'post-service-30m',
        enabled: true,
        channel: 'sms',
        offset_minutes: 30,
        message: SOUTHLAKE_POST_SERVICE_REVIEW_MESSAGE,
        email_subject: 'How Was Your Visit? — {businessName}',
      });
    } else {
      const current = steps[0]?.message || '';
      if (isMigrationDefaultPostServiceMessage(current)) {
        steps[0] = {
          ...steps[0],
          id: steps[0].id || 'post-service-30m',
          enabled: steps[0].enabled !== false,
          channel: steps[0].channel || 'sms',
          offset_minutes: Number.isFinite(Number(steps[0].offset_minutes))
            ? Number(steps[0].offset_minutes)
            : 30,
          message: SOUTHLAKE_POST_SERVICE_REVIEW_MESSAGE,
          email_subject: steps[0].email_subject || 'How Was Your Visit? — {businessName}',
        };
      }
    }

    config.post_appointment = {
      enabled: post.enabled !== false,
      steps,
    };

    if (config.review_requests?.enabled) {
      config.review_requests = {
        ...config.review_requests,
        enabled: false,
      };
    }

    await knex('tenants')
      .where({ id: tenant.id })
      .update({ appointment_automation_config: JSON.stringify(config) });
  }
};

exports.down = async function down() {
  // Tenant-specific copy — no automatic rollback.
};
