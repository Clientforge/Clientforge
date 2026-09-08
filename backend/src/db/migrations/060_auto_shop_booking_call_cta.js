/**
 * Auto shop: post-service SMS templates use {bookingCta} (call shop) instead of booking URL.
 */
const POST_SERVICE_MESSAGE =
  'Hi {firstName}! Thanks for visiting {businessName}. Hope everything went well with your {serviceName}. {bookingCta}';

exports.up = async function up(knex) {
  const tenants = await knex('tenants')
    .whereRaw('name ILIKE ? OR name ILIKE ?', ['%southlake%', '%autocare%'])
    .select('id', 'appointment_automation_config', 'phone_number');

  for (const tenant of tenants) {
    if (!tenant.phone_number || !String(tenant.phone_number).trim()) {
      await knex('tenants')
        .where({ id: tenant.id })
        .update({ phone_number: '+17709618500' });
    }

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
        message: POST_SERVICE_MESSAGE,
        email_subject: 'Thank You for Visiting {businessName}',
      });
    } else {
      steps[0] = {
        ...steps[0],
        message: POST_SERVICE_MESSAGE,
      };
    }

    config.post_appointment = {
      enabled: post.enabled !== false,
      steps,
    };

    await knex('tenants')
      .where({ id: tenant.id })
      .update({ appointment_automation_config: JSON.stringify(config) });
  }
};

exports.down = async function down() {
  // Tenant-specific message text — no automatic rollback.
};
