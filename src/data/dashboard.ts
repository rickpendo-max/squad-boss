export const dashboardData = {
  alerts: [
    {
      athlete: 'Noah',
      concern: 'Shoulder soreness',
    },
    {
      athlete: 'Sam',
      concern: 'Low readiness',
    },
    {
      athlete: 'Lilly',
      concern: 'Modified training',
    },
  ],

  readiness: [
    {
      athlete: 'Maddie',
      status: 'Ready',
      note: 'Full training',
    },
    {
      athlete: 'Sam',
      status: 'Monitor',
      note: 'Reduced readiness',
    },
    {
      athlete: 'Noah',
      status: 'Modify',
      note: 'Shoulder soreness',
    },
    {
      athlete: 'Lilly',
      status: 'Modify',
      note: 'Modified training',
    },
    {
      athlete: 'Holly',
      status: 'Ready',
      note: 'Full training',
    },
  ],

  completion: [
    {
      athlete: 'Maddie',
      completed: 8,
      planned: 9,
    },
    {
      athlete: 'Sam',
      completed: 7,
      planned: 8,
    },
    {
      athlete: 'Noah',
      completed: 3,
      planned: 4,
    },
    {
      athlete: 'Lilly',
      completed: 5,
      planned: 7,
    },
    {
      athlete: 'Holly',
      completed: 6,
      planned: 7,
    },
  ],
  weeklySessions: [
    {
      day: 'Monday',
      time: '5:30 AM',
      title: 'Aerobic Power',
      focus: 'AP',
      volume: '5.4 km',
    },
    {
      day: 'Tuesday',
      time: '5:30 AM',
      title: 'Speed and Skills',
      focus: 'ATP',
      volume: '4.2 km',
    },
    {
      day: 'Wednesday',
      time: '5:30 AM',
      title: 'Aerobic Support',
      focus: 'A2',
      volume: '5.8 km',
    },
    {
      day: 'Wednesday',
      time: '4:00 PM',
      title: 'Race Skills',
      focus: 'Skills',
      volume: '3.6 km',
    },
    {
      day: 'Thursday',
      time: '5:30 AM',
      title: 'Race Pace',
      focus: 'RP',
      volume: '4.5 km',
    },
    {
      day: 'Friday',
      time: '5:30 AM',
      title: 'IM Aerobic',
      focus: 'A2',
      volume: '4.8 km',
    },
    {
      day: 'Saturday',
      time: '6:00 AM',
      title: 'Lactate Production',
      focus: 'ANP',
      volume: '4.1 km',
    },
  ],
  mainEvent: {
    name: 'Australian Trials',
    date: '2026-06-13',
  },

  currentSession: {
    title: 'Aerobic Power',
    objective: 'Maintain stroke proficiency under controlled fatigue.',
    volume: '5.4 km',
    athletesExpected: 8,
    keySet: '3 rounds of 200 AP, 4 × 50 at 200 pace and 300 easy',
    coachNotes: [
      'Stroke count before pace',
      'Monitor Sam during the first round',
      'Modify Noah’s fly work if required',
    ],
  },
}