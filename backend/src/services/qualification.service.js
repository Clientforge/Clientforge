/**
 * Qualification State Machine — Rule-based lead qualification.
 * Built in Step 7.
 *
 * States: NEW → CONTACTED → QUALIFYING → QUALIFIED → BOOKED | UNRESPONSIVE
 *
 * The LLM (if used) generates language only.
 * It does NOT control flow. Flow is deterministic.
 */

const LEAD_STATES = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  QUALIFYING: 'QUALIFYING',
  QUALIFIED: 'QUALIFIED',
  BOOKED: 'BOOKED',
  UNRESPONSIVE: 'UNRESPONSIVE',
};

const VALID_TRANSITIONS = {
  NEW: ['CONTACTED'],
  CONTACTED: ['QUALIFYING', 'UNRESPONSIVE'],
  QUALIFYING: ['QUALIFIED', 'UNRESPONSIVE'],
  QUALIFIED: ['BOOKED', 'UNRESPONSIVE'],
  BOOKED: [],
  UNRESPONSIVE: ['CONTACTED'],
};

const canTransition = (from, to) => {
  return VALID_TRANSITIONS[from]?.includes(to) || false;
};

const processLeadReply = async (leadId, message) => {
  // TODO: Step 7 — Evaluate reply, score, transition state
  throw new Error('Qualification service not implemented yet');
};

module.exports = {
  LEAD_STATES,
  VALID_TRANSITIONS,
  canTransition,
  processLeadReply,
};
