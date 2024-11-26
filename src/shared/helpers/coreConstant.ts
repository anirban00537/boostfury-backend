export const coreConstant = {
  USER_ROLE_ADMIN: 1,
  USER_ROLE_USER: 2,
  COMMON_PASSWORD: 'r4abbit5onthe4moon^33%%%%%',
  STATUS_INACTIVE: 0,
  STATUS_ACTIVE: 1,
  STATUS_PENDING: 2,
  IS_VERIFIED: 1,
  IS_NOT_VERIFIED: 0,
  VERIFICATION_TYPE_EMAIL: 1,
  FILE_DESTINATION: 'public/uploads',
  MAX_IMAGE_SIZE: 500 * 1024 * 1024, // 500MB

  // Post Types
  POST_TYPE: {
    TEXT: 'text',
    IMAGE: 'image',
    VIDEO: 'video',
    DOCUMENT: 'document',
    CAROUSEL: 'carousel',
  },
  SUBSCRIPTION_STATUS: {
    ACTIVE: 'active',
    EXPIRED: 'expired',
    CANCELLED: 'cancelled',
  },
  WORD_TOKEN_LOG_TYPE: {
    USAGE: 'USAGE',
    RESET: 'RESET',
  },
  PACKAGE_TYPE: {
    TRIAL: 'trial',
  },

  // Post Status
  POST_STATUS: {
    DRAFT: 0,
    SCHEDULED: 1,
    PUBLISHED: 2,
    FAILED: 3,
  },

  // Post Log Status
  POST_LOG_STATUS: {
    DRAFT_CREATED: 'DRAFT_CREATED',
    DRAFT_UPDATED: 'DRAFT_UPDATED',
    SCHEDULED: 'SCHEDULED',
    PUBLISHED: 'PUBLISHED',
    FAILED: 'FAILED',
  },

  // Maximum limits
  POST_LIMITS: {
    MAX_HASHTAGS: 30,
    MAX_MENTIONS: 50,
    MAX_IMAGES: 9,
    MAX_VIDEO_SIZE: 200 * 1024 * 1024, // 200MB
    MAX_DOCUMENT_SIZE: 100 * 1024 * 1024, // 100MB
  },

  // LinkedIn Specific Constants
  LINKEDIN: {
    MAX_IMAGES: 9,
    MAX_CONTENT_LENGTH: 3000,
    SUPPORTED_IMAGE_TYPES: ['image/jpeg', 'image/png'],
    MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
    MIN_IMAGE_DIMENSIONS: {
      WIDTH: 552,
      HEIGHT: 276,
    },
    MAX_IMAGE_DIMENSIONS: {
      WIDTH: 2048,
      HEIGHT: 2048,
    },
    ASPECT_RATIO: {
      MIN: 1 / 1.91, // 1:1.91
      MAX: 1 / 1, // 1:1
    },
    MEDIA_CATEGORIES: {
      NONE: 'NONE',
      IMAGE: 'IMAGE',
      VIDEO: 'VIDEO',
      DOCUMENT: 'DOCUMENT',
    },
  },

  VERIFICATION: {
    VERIFIED: 1,
    NOT_VERIFIED: 0,
  },
  DAYS_OF_WEEK: {
    SUNDAY: 0,
    MONDAY: 1,
    TUESDAY: 2,
    WEDNESDAY: 3,
    THURSDAY: 4,
    FRIDAY: 5,
  SATURDAY: 6,
  },
};

