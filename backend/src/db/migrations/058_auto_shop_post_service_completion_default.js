/**
 * Auto shop: default Post-Service Completion to 30 minutes after RO complete.
 */
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
        message: 'Hi {firstName}! Thanks for visiting {businessName}. Hope everything went well with your {serviceName}. Book your next visit anytime: {bookingLink}',
        email_subject: 'Thank You for Visiting {businessName}',
      });
    } else if (steps[0].offset_minutes === 1440 || steps[0].offset_minutes == null) {
      steps[0] = {
        ...steps[0],
        offset_minutes: 30,
        message: steps[0].message || 'Hi {firstName}! Thanks for visiting {businessName}. Hope everything went well with your {serviceName}. Book your next visit anytime: {bookingLink}',
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
  // No-op — prior offsets are tenant-specific.
};
