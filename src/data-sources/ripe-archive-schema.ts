const text = { type: 'string', minLength: 1, maxLength: 200, pattern: '\\S' }
const timestamp = { type: 'string', format: 'date-time' }
const meters = { type: ['number', 'null'], minimum: 0, maximum: 100000 }
const verification = { enum: ['verified', 'provisional'] }
const object = (
  properties: Record<string, unknown>,
  required = Object.keys(properties),
) => ({
  type: 'object',
  additionalProperties: false,
  properties,
  required,
})

export const ripeArchiveSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  ...object({
    format: { const: 'ripe-verified-archive-v1' },
    archiveId: text,
    exportedAt: timestamp,
    sessions: {
      type: 'array',
      minItems: 1,
      maxItems: 1000,
      items: object({
        id: text,
        title: text,
        startsAt: timestamp,
        approval: {
          ...object(
            { status: verification, verifiedBy: text, verifiedAt: timestamp },
            ['status'],
          ),
          if: { properties: { status: { const: 'verified' } } },
          then: {
            properties: { verifiedBy: text, verifiedAt: timestamp },
            required: ['verifiedBy', 'verifiedAt'],
          },
        },
        source: object({
          fileName: text,
          checksum: { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' },
        }),
        plannedDistanceMeters: meters,
        participants: {
          type: 'array',
          minItems: 1,
          maxItems: 500,
          items: object({
            athleteId: text,
            attendance: { enum: ['present', 'absent', 'unknown'] },
            completedDistanceMeters: meters,
            performances: {
              type: 'array',
              maxItems: 100,
              items: object({
                id: text,
                resultType: { enum: ['competition', 'test', 'training'] },
                distance: { type: 'integer', minimum: 1, maximum: 25000 },
                stroke: {
                  enum: [
                    'freestyle',
                    'backstroke',
                    'breaststroke',
                    'butterfly',
                    'individual-medley',
                  ],
                },
                course: { enum: ['LCM', 'SCM'] },
                totalSeconds: {
                  type: ['number', 'null'],
                  exclusiveMinimum: 0,
                  maximum: 86400,
                },
                verificationStatus: verification,
              }),
            },
          }),
        },
      }),
    },
  }),
}
