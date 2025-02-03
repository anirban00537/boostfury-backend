export const coreConstant = {
  USER_ROLE_ADMIN: 1,
  USER_ROLE_USER: 2,
  COMMON_PASSWORD: 'r4abbit5onthe4moo333456300^33%%%%%',
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
    PENDING: 'pending',
  },
  PACKAGE_STATUS: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    DEPRECATED: 'deprecated',
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

  LINKEDIN_REWRITE_INSTRUCTIONS: {
    IMPROVE: 1, // Improve the overall quality and engagement
    SHORTER: 2, // Make the content more concise
    LONGER: 3, // Expand the content with more details
    PROFESSIONAL: 4, // Make it more formal and professional
    CASUAL: 5, // Make it more conversational and friendly
    SEO_OPTIMIZE: 6, // Optimize for LinkedIn's algorithm
    STORYTELLING: 7, // Convert into a story format
    PERSUASIVE: 8, // Make it more convincing and action-oriented
    IMPROVE_HOOK: 9, // Improve the opening hook to grab attention
  },

  LINKEDIN_REWRITE_PROMPTS: {
    1: 'Improve this LinkedIn post by enhancing its clarity, impact, and engagement potential while maintaining its core message',
    2: 'Rewrite this LinkedIn post to be more concise and impactful, focusing on the key message',
    3: 'Expand this LinkedIn post with more details, examples, and insights while maintaining engagement',
    4: 'Rewrite this LinkedIn post in a more professional and formal tone suitable for a business audience',
    5: 'Transform this LinkedIn post into a more conversational and relatable tone while keeping the message',
    6: "Optimize this LinkedIn post for better visibility and engagement on LinkedIn's platform",
    7: 'Rewrite this LinkedIn post as an engaging story that captures attention and delivers the message',
    8: 'Make this LinkedIn post more persuasive and action-oriented to drive better engagement',
    9: 'Improve the opening hook of this LinkedIn post to instantly grab attention and make readers want to read more',
  },
};
