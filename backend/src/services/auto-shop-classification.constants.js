const MASTER_CATEGORIES = [
  { slug: 'routine_maintenance', name: 'Routine Maintenance', followUpIntervalDays: 60, sortOrder: 1 },
  { slug: 'brakes', name: 'Brakes', followUpIntervalDays: 90, sortOrder: 2 },
  { slug: 'tires_alignment', name: 'Tires & Alignment', followUpIntervalDays: 90, sortOrder: 3 },
  { slug: 'battery_electrical', name: 'Battery & Electrical', followUpIntervalDays: 180, sortOrder: 4 },
  { slug: 'engine_fuel', name: 'Engine & Fuel', followUpIntervalDays: 180, sortOrder: 5 },
  { slug: 'cooling_fluids', name: 'Cooling & Fluids', followUpIntervalDays: 180, sortOrder: 6 },
  { slug: 'transmission_drivetrain', name: 'Transmission & Drivetrain', followUpIntervalDays: 180, sortOrder: 7 },
  { slug: 'steering_suspension', name: 'Steering & Suspension', followUpIntervalDays: 90, sortOrder: 8 },
  { slug: 'ac_climate', name: 'A/C & Climate', followUpIntervalDays: 180, sortOrder: 9 },
  { slug: 'diagnostics_inspections', name: 'Diagnostics & Inspections', followUpIntervalDays: 90, sortOrder: 10 },
];

const DEFAULT_CATEGORY_SLUG = 'diagnostics_inspections';

const KEYWORD_RULES = [
  {
    slug: 'brakes',
    keywords: ['brake pad', 'brake rotor', 'brake fluid', 'brake', 'rotor', 'caliper', 'abs module', 'braking'],
  },
  {
    slug: 'tires_alignment',
    keywords: ['tire rotation', 'tire balance', 'wheel alignment', 'flat repair', 'tire mount', 'tire', 'alignment', 'tpms', 'wheel balance', 'puncture'],
  },
  {
    slug: 'battery_electrical',
    keywords: ['battery test', 'battery replacement', 'alternator', 'starter', 'electrical', 'wiring', 'headlight', 'taillight', 'bulb', 'battery'],
  },
  {
    slug: 'ac_climate',
    keywords: ['a/c recharge', 'air conditioning', 'a/c', 'ac service', 'refrigerant', 'hvac', 'climate control', 'heater core', 'compressor'],
  },
  {
    slug: 'transmission_drivetrain',
    keywords: ['transmission flush', 'transmission service', 'transmission', 'clutch', 'differential', 'cv axle', 'cv joint', 'driveshaft', 'transfer case', 'axle'],
  },
  {
    slug: 'steering_suspension',
    keywords: ['strut', 'shock absorber', 'shock', 'suspension', 'ball joint', 'control arm', 'tie rod', 'steering rack', 'steering'],
  },
  {
    slug: 'engine_fuel',
    keywords: ['fuel injector', 'timing belt', 'serpentine belt', 'head gasket', 'engine mount', 'fuel pump', 'ignition coil', 'spark plug', 'turbo', 'engine repair', 'engine replacement'],
  },
  {
    slug: 'cooling_fluids',
    keywords: ['coolant flush', 'radiator', 'water pump', 'thermostat', 'coolant', 'overheat', 'power steering fluid', 'trans fluid'],
  },
  {
    slug: 'routine_maintenance',
    keywords: ['oil change', 'oil filter', 'multi point', 'multipoint', 'mpvi', 'maintenance service', 'scheduled maintenance', 'cabin filter', 'air filter', 'wiper blade', 'state inspection', 'safety inspection', 'lube'],
  },
  {
    slug: 'diagnostics_inspections',
    keywords: ['check engine light', 'diagnostic', 'diagnosis', 'code scan', 'troubleshoot', 'evaluate', 'inspection'],
  },
];

const SEED_SERVICE_MAPPINGS = [
  { serviceName: 'Oil Change', categorySlug: 'routine_maintenance' },
  { serviceName: 'Synthetic Oil Change', categorySlug: 'routine_maintenance' },
  { serviceName: 'Tire Rotation', categorySlug: 'tires_alignment' },
  { serviceName: 'Wheel Alignment', categorySlug: 'tires_alignment' },
  { serviceName: 'Brake Pad Replacement', categorySlug: 'brakes' },
  { serviceName: 'Brake Rotor Replacement', categorySlug: 'brakes' },
  { serviceName: 'Battery Replacement', categorySlug: 'battery_electrical' },
  { serviceName: 'A/C Recharge', categorySlug: 'ac_climate' },
  { serviceName: 'Transmission Fluid Service', categorySlug: 'transmission_drivetrain' },
  { serviceName: 'Check Engine Light Diagnosis', categorySlug: 'diagnostics_inspections' },
  { serviceName: 'Coolant Flush', categorySlug: 'cooling_fluids' },
  { serviceName: 'Strut Replacement', categorySlug: 'steering_suspension' },
];

module.exports = {
  MASTER_CATEGORIES,
  DEFAULT_CATEGORY_SLUG,
  KEYWORD_RULES,
  SEED_SERVICE_MAPPINGS,
};
