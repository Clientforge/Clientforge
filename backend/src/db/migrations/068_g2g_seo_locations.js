/**
 * Metro Atlanta location landing pages for Cash4JunkCar organic SEO.
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('g2g_seo_locations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('slug', 120).notNullable().unique();
    table.string('city', 120).notNullable();
    table.string('state', 8).notNullable().defaultTo('GA');
    table.string('display_name', 160).notNullable();
    table.boolean('published').notNullable().defaultTo(true);
    table.string('meta_title', 200);
    table.string('meta_description', 320);
    table.string('hero_headline', 240);
    table.string('hero_subhead', 500);
    table.text('local_intro').notNullable();
    table.jsonb('neighborhoods').notNullable().defaultTo('[]');
    table.jsonb('local_faq').notNullable().defaultTo('[]');
    table.jsonb('nearby_slugs').notNullable().defaultTo('[]');
    table.string('primary_zip', 16);
    table.integer('sort_order').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['published', 'sort_order']);
  });

  const locations = [
    {
      slug: 'alpharetta-ga',
      city: 'Alpharetta',
      display_name: 'Alpharetta, GA',
      sort_order: 10,
      primary_zip: '30009',
      neighborhoods: JSON.stringify(['Downtown Alpharetta', 'Windward', 'North Point area', 'Crabapple']),
      nearby_slugs: JSON.stringify(['sandy-springs-ga', 'woodstock-ga', 'vinings-ga']),
      local_intro:
        'Selling a junk or non-running car in Alpharetta should not mean guessing what it is worth. '
        + 'From Windward and North Fulton neighborhoods along GA-400 to older daily drivers parked in driveways near Downtown Alpharetta, '
        + 'we buy damaged, high-mileage, and end-of-life vehicles across the city. '
        + 'Share your VIN or basic vehicle details online for a quick estimate, then coordinate pickup when you are ready — '
        + 'without pressure to accept. We regularly serve sellers throughout Alpharetta and the greater north metro corridor.',
      local_faq: JSON.stringify([
        {
          q: 'Do you pick up junk cars in Alpharetta neighborhoods like Windward?',
          a: 'Yes. We arrange pickup throughout Alpharetta and north Fulton, including Windward, Crabapple, and areas near North Point.',
        },
        {
          q: 'Can I sell a car that does not run in Alpharetta?',
          a: 'Non-running and damaged vehicles are common. Tell us the condition in your offer request so we can reflect it in your estimate.',
        },
        {
          q: 'How fast can I get an estimate for my Alpharetta vehicle?',
          a: 'Most sellers complete the online form in a few minutes and see an estimated range before scheduling any pickup.',
        },
      ]),
    },
    {
      slug: 'peachtree-city-ga',
      city: 'Peachtree City',
      display_name: 'Peachtree City, GA',
      sort_order: 20,
      primary_zip: '30269',
      neighborhoods: JSON.stringify(['Braelinn', 'Glenloch', 'Kedron', 'Planterra Ridge']),
      nearby_slugs: JSON.stringify(['kennesaw-ga', 'vinings-ga', 'sandy-springs-ga']),
      local_intro:
        'Peachtree City drivers often keep cars longer because of cart-path communities and south metro commutes — '
        + 'until repair costs no longer make sense. If you have a scrap, wrecked, or unwanted vehicle in Braelinn, Kedron, or elsewhere in Peachtree City, '
        + 'you can request a cash offer online and compare it to the hassle of private sale. '
        + 'We buy junk and damaged cars across Fayette County and coordinate pickup on your schedule. '
        + 'Our team is familiar with south metro Atlanta routes and typical title situations for Georgia sellers.',
      local_faq: JSON.stringify([
        {
          q: 'Do you buy cars in Peachtree City and Fayette County?',
          a: 'Yes. We serve Peachtree City and surrounding south metro communities with pickup options when you accept an offer.',
        },
        {
          q: 'What if my car failed emissions or needs major engine work?',
          a: 'Heavily worn or non-running vehicles are exactly what junk-car buyers handle. Describe the issue in your offer request.',
        },
        {
          q: 'Is there an obligation after I get an online estimate?',
          a: 'No. The online estimate helps you decide; you only move forward if the numbers and pickup timing work for you.',
        },
      ]),
    },
    {
      slug: 'buckhead-ga',
      city: 'Buckhead',
      display_name: 'Buckhead, GA',
      sort_order: 30,
      primary_zip: '30305',
      neighborhoods: JSON.stringify(['Lenox', 'Peachtree Hills', 'Garden Hills', 'Ardmore Park']),
      nearby_slugs: JSON.stringify(['sandy-springs-ga', 'vinings-ga', 'atlanta-ga']),
      local_intro:
        'Buckhead presents a different selling challenge: tight parking, busy schedules, and cars that may sit unused in garages or apartment decks. '
        + 'Whether you are off Peachtree Road, near Lenox, or in a residential street in Garden Hills, '
        + 'we help you turn an unwanted or damaged vehicle into a straightforward cash offer. '
        + 'Get your estimate online first, then schedule pickup when it fits your calendar — '
        + 'useful when you do not want strangers stopping by for weeks of classified ads in intown Atlanta.',
      local_faq: JSON.stringify([
        {
          q: 'Can you pick up in Buckhead apartment or condo buildings?',
          a: 'Often yes, when building rules allow. Mention access notes (gate codes, loading areas) when you schedule pickup.',
        },
        {
          q: 'Do you buy luxury or older SUVs that are not running?',
          a: 'We evaluate a wide range of vehicles. Condition and title status matter more than the badge on the grille.',
        },
        {
          q: 'How do Buckhead sellers usually start?',
          a: 'Most start with the online offer form or VIN lookup, then call if they want to talk through title or timing questions.',
        },
      ]),
    },
    {
      slug: 'woodstock-ga',
      city: 'Woodstock',
      display_name: 'Woodstock, GA',
      sort_order: 40,
      primary_zip: '30188',
      neighborhoods: JSON.stringify(['Downtown Woodstock', 'Towne Lake', 'Bridgemill', 'Hickory Flat Road area']),
      nearby_slugs: JSON.stringify(['canton-ga', 'alpharetta-ga', 'kennesaw-ga']),
      local_intro:
        'Woodstock has grown fast along the I-575 corridor, and many households end up with an extra car that no longer runs or is not worth fixing. '
        + 'From Downtown Woodstock to Towne Lake and Bridgemill, we buy junk cars and pay cash based on a clear online estimate. '
        + 'Cherokee County sellers appreciate a simple process: share vehicle details, review your number, and arrange pickup when you are ready. '
        + 'We serve Woodstock and nearby north metro cities without requiring you to tow the car yourself.',
      local_faq: JSON.stringify([
        {
          q: 'Do you cover Woodstock and Cherokee County?',
          a: 'Yes. Woodstock, Canton, and surrounding Cherokee communities are part of our regular metro Atlanta service area.',
        },
        {
          q: 'What documents do I need to sell a junk car in Georgia?',
          a: 'Typically your title and a valid ID. If you are unsure about lien or title issues, ask when you submit your offer.',
        },
        {
          q: 'Can I get an estimate before paying for a tow?',
          a: 'Absolutely. Use the online offer flow first so you know whether selling beats repair or storage fees.',
        },
      ]),
    },
    {
      slug: 'vinings-ga',
      city: 'Vinings',
      display_name: 'Vinings, GA',
      sort_order: 50,
      primary_zip: '30339',
      neighborhoods: JSON.stringify(['Vinings Jubilee', 'Paces', 'Cumberland area', 'I-285 corridor']),
      nearby_slugs: JSON.stringify(['sandy-springs-ga', 'buckhead-ga', 'kennesaw-ga']),
      local_intro:
        'Vinings sits at the crossroads of Cobb County and intown Atlanta, with heavy traffic and many commuters who eventually replace — or abandon — an aging vehicle. '
        + 'If you are near Cumberland, Paces, or the Vinings Jubilee area with a damaged or scrap car, request a cash offer online. '
        + 'We buy non-running sedans, SUVs, and work trucks common in the I-285 / I-75 stack. '
        + 'You get a upfront estimate tied to your vehicle details, then optional pickup when you choose to sell.',
      local_faq: JSON.stringify([
        {
          q: 'Is Vinings too close to Atlanta for pickup?',
          a: 'No. Vinings and the Cumberland district are well within our metro pickup routes.',
        },
        {
          q: 'Do you buy cars with accident damage near Vinings?',
          a: 'Yes. Collision damage and insurance totals are common reasons sellers request a junk-car offer.',
        },
        {
          q: 'Can I use my VIN for a Vinings-area vehicle?',
          a: 'Yes. VIN lookup prefills year, make, and model to speed up your estimate.',
        },
      ]),
    },
    {
      slug: 'canton-ga',
      city: 'Canton',
      display_name: 'Canton, GA',
      sort_order: 60,
      primary_zip: '30114',
      neighborhoods: JSON.stringify(['Downtown Canton', 'Hickory Flat', 'Riverstone', 'Sixes area']),
      nearby_slugs: JSON.stringify(['woodstock-ga', 'alpharetta-ga', 'kennesaw-ga']),
      local_intro:
        'Canton and north Cherokee County include a mix of rural driveways and newer subdivisions — both places old cars sit until it is time to free up space. '
        + 'We purchase junk, wrecked, and high-mileage vehicles from Canton sellers who want a simple cash path instead of listing online. '
        + 'Start with a few details about your car and your ZIP code so your estimate reflects local market conditions. '
        + 'When the offer works for you, we help coordinate pickup from your home or workplace in the Canton area.',
      local_faq: JSON.stringify([
        {
          q: 'Do you travel to Canton for junk car pickup?',
          a: 'Yes. Canton, Holly Springs, and along 575 are part of our north metro coverage.',
        },
        {
          q: 'What if I lost my title?',
          a: 'Georgia has processes for certain title situations. Contact us with your specifics so we can guide you before pickup.',
        },
        {
          q: 'How local is my estimate?',
          a: 'Your ZIP and vehicle condition help shape the estimate you see online before you commit to anything.',
        },
      ]),
    },
    {
      slug: 'kennesaw-ga',
      city: 'Kennesaw',
      display_name: 'Kennesaw, GA',
      sort_order: 70,
      primary_zip: '30144',
      neighborhoods: JSON.stringify(['Town Center', 'Legacy Park', 'Barrett Parkway', 'KSU area']),
      nearby_slugs: JSON.stringify(['woodstock-ga', 'vinings-ga', 'canton-ga']),
      local_intro:
        'Kennesaw sees constant I-75 traffic and plenty of households with an extra beater car taking up driveway space. '
        + 'From Town Center and Barrett Parkway to neighborhoods near Kennesaw State, we buy scrap and damaged vehicles for cash. '
        + 'Tell us about your car online — including if it does not start — and review an estimated offer range in minutes. '
        + 'Cobb County sellers use our process to skip haggling and move on from cars that are not worth repairing.',
      local_faq: JSON.stringify([
        {
          q: 'Do you buy non-running cars in Kennesaw?',
          a: 'Yes. Non-runners are routine. Note the condition honestly in your offer request for the most accurate estimate.',
        },
        {
          q: 'Can I sell a car without a current registration?',
          a: 'Often yes if you have a clear title. Registration status alone does not always block a junk-car sale in Georgia.',
        },
        {
          q: 'How do I reach someone after I submit an offer?',
          a: 'Use the phone number on this site or complete the sell flow — we follow up to confirm details and pickup.',
        },
      ]),
    },
    {
      slug: 'sandy-springs-ga',
      city: 'Sandy Springs',
      display_name: 'Sandy Springs, GA',
      sort_order: 80,
      primary_zip: '30328',
      neighborhoods: JSON.stringify(['Perimeter Center', 'Riverside', 'Mount Vernon', 'Huntcliff']),
      nearby_slugs: JSON.stringify(['buckhead-ga', 'alpharetta-ga', 'vinings-ga']),
      local_intro:
        'Sandy Springs stretches from the Perimeter Center business district to quiet residential streets along the Chattahoochee. '
        + 'When a vehicle becomes too expensive to fix — or sits after an accident — you need a buyer who works on north Fulton schedules. '
        + 'We provide online cash estimates for junk and damaged cars across Sandy Springs, with pickup coordination when you accept. '
        + 'Whether you are near GA-400, Hammond Drive, or Riverside, the process starts the same: vehicle details, clear estimate, your choice to sell.',
      local_faq: JSON.stringify([
        {
          q: 'Do you serve Sandy Springs and the Perimeter area?',
          a: 'Yes. Sandy Springs, Dunwoody borders, and Perimeter office corridors are core north metro routes for us.',
        },
        {
          q: 'Can I sell a car that failed inspection?',
          a: 'Many junk sellers have inspection or emissions issues. Your estimate can reflect condition and missing repairs.',
        },
        {
          q: 'Is my online estimate binding?',
          a: 'Online numbers are estimates; final offers are confirmed after we verify vehicle details and title at pickup.',
        },
      ]),
    },
  ];

  for (const loc of locations) {
    const headline = `Get Cash for Junk Cars in ${loc.display_name}`;
    const subhead =
      `Looking to sell your junk or damaged car in ${loc.city}? Get a quick online estimate and see what your vehicle could be worth.`;
    await knex('g2g_seo_locations').insert({
      slug: loc.slug,
      city: loc.city,
      state: 'GA',
      display_name: loc.display_name,
      published: true,
      meta_title: `${headline} | Cash4JunkCar`,
      meta_description:
        `Cash for junk cars in ${loc.display_name}. Damaged, non-running & scrap vehicles. Free online estimate — no obligation. Call ${loc.city} pickup.`,
      hero_headline: headline,
      hero_subhead: subhead,
      local_intro: loc.local_intro,
      neighborhoods: loc.neighborhoods,
      local_faq: loc.local_faq,
      nearby_slugs: loc.nearby_slugs,
      primary_zip: loc.primary_zip,
      sort_order: loc.sort_order,
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('g2g_seo_locations');
};
