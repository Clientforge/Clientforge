#!/usr/bin/env node
/**
 * Practitioner names are read from the Group bulk file, not GET Practitioner/{id}.
 * eCW refuses that direct read for this bulk app.
 *
 * The next bulk export requests Patient, Encounter, and Practitioner and writes
 * provider tags from the latest finished visit already saved for each contact.
 */
console.log(
  '[backfill-ecw-practitioner-tags] Direct Practitioner reads are refused for this bulk app. '
  + 'Names are applied from the Group export on the next bulk run.',
);
