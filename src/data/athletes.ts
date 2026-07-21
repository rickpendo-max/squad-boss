import type { Athlete } from '../types/athlete/index'

export const athletes: Athlete[] = [
  {
    id: 'sam-gould',
    firstName: 'Sam',
    lastName: 'Gould',

    status: 'Monitor',
    statusNote: 'Reduced readiness',

    primaryEvents: ['200 Free', '100 Free'],
    secondaryEvents: ['200 IM'],

    currentBlock: 'Aerobic Capacity',
    nextCompetition: 'Australian Trials',

    personalBests: [
      {
        event: '100 Free',
        course: 'LC',
        time: '55.00',
      },
      {
        event: '200 Free',
        course: 'LC',
        time: '2:00.10',
      },
    ],

    readiness: {
      recovery: 6,
      soreness: 3,
      motivation: 8,
      sleep: 7,
      note: 'Monitor pacing confidence and third-50 drop.',
    },

    testing: [
      {
        test: '12 × 25 Anaerobic Test',
        date: '2026-07-01',
        result: 'Completed',
      },
      {
        test: 'Dive 35',
        date: '2026-07-10',
        result: 'Improved',
      },
    ],

    coachNotes: [
      {
        date: '2026-07-18',
        note: 'Fastest times across most speed measures.',
      },
      {
        date: '2026-07-15',
        note: 'Maintain confidence through the third 50 of the 200.',
      },
    ],
  },

  {
    id: 'maddie-mcternan',
    firstName: 'Maddie',
    lastName: 'McTernan',
    fullName: 'Maddie McTernan',

    status: 'Ready',
    statusNote: 'Full training',

    primaryEvents: ['200 Free'],
    secondaryEvents: ['100 Back', '100 Free'],

    currentBlock: 'Race Pace',
    nextCompetition: 'Para Pan Pacs',

    personalBests: [
      {
        event: '200 Free',
        course: 'LC',
        time: '2:17.40',
      },
      {
        event: '100 Back',
        course: 'LC',
        time: '1:10.82',
      },
    ],
    currentPerformancePriorities: ['Race-pace work', 'Back-end speed'],
    technicalStrengths: ['Back-end speed', 'Suited race work'],
    performanceRisks: [],

    blockPurpose: 'Race-pace work',
    currentTrainingFocus: ['Back-end speed', 'Suited race work'],

    mainUpcomingCompetition: 'Para Pan Pacs',
    targetEvents: ['200 Free', '100 Back', '100 Free'],

    readiness: {
      recovery: 8,
      soreness: 2,
      motivation: 9,
      sleep: 8,
      note: 'Responding well to race-pace work.',
    },

    testing: [
      {
        test: '7 × 200 Step Test',
        date: '2026-01-22',
        result: 'Completed',
      },
      {
        test: 'Back-End Speed',
        date: '2026-07-12',
        result: 'Target achieved',
      },
    ],

    coachNotes: [
      {
        date: '2026-07-18',
        note: 'Strong back-end speed and good suited race work.',
      },
    ],
    currentCoachingPriorities: ['Back-end speed', 'Suited race work'],
    recentObservations: [
      'Strong back-end speed and good suited race work.',
    ],
    alerts: [],
    compass: {
      currentDirection: 'Race Pace',
      performancePriorities: ['Race-pace work', 'Back-end speed'],
      constraints: [],
      keyDecisions: [],
      evidence: [
        'Responding well to race-pace work.',
        'Back-End Speed: Target achieved (2026-07-12)',
        'Strong back-end speed and good suited race work.',
      ],
    },
  },

  {
    id: 'noah-arkansoul',
    firstName: 'Noah',
    lastName: 'Arkansoul',

    status: 'Modify',
    statusNote: 'Shoulder soreness',

    primaryEvents: ['100 Fly'],
    secondaryEvents: ['50 Free'],

    currentBlock: 'Speed',
    nextCompetition: 'Queensland SC Championships',

    personalBests: [
      {
        event: '100 Fly',
        course: 'LC',
        time: '1:07.39',
      },
    ],

    readiness: {
      recovery: 5,
      soreness: 6,
      motivation: 7,
      sleep: 6,
      note: 'Modify fly volume if shoulder symptoms increase.',
    },

    testing: [
      {
        test: 'Dive 35 Free',
        date: '2026-07-10',
        result: 'Improved',
      },
    ],

    coachNotes: [
      {
        date: '2026-07-18',
        note: 'Keep attendance limits in mind when planning weekly load.',
      },
    ],
  },
]
