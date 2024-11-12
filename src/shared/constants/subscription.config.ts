export const SUBSCRIPTION_CONFIG = {
  TRIAL: {
    DURATION_DAYS: 5,
    TOKEN_LIMIT: 3000,
    FEATURES: {
      POSTS_LIMIT: 10,
      IMAGE_UPLOADS: 3,
      WORKSPACES: 1,
      LINKEDIN_PROFILES: 1,
      CAROUSELS: 3,
    },
    PRODUCT_NAME: 'Trial Subscription',
    VARIANT_NAME: 'Trial',
    PLAN_ID: 'trial',
  },
  
  STATUS: {
    TRIAL: 'trial',
    ACTIVE: 'active',
    EXPIRED: 'expired',
    CANCELLED: 'cancelled',
  },

  TOKEN_LOG_TYPES: {
    TRIAL: 'TRIAL',
    PURCHASE: 'PURCHASE',
    USAGE: 'USAGE',
    EXPIRY: 'EXPIRY',
  },

  MESSAGES: {
    TRIAL_USED: 'Trial period has already been used',
    TRIAL_ACTIVE: 'Trial period is currently active',
    TRIAL_EXPIRED: 'Trial period has expired',
    TRIAL_CREATED: 'Trial subscription created successfully',
    SUBSCRIPTION_REQUIRED: 'Active subscription required to access this feature',
  },
} as const;

// Helper functions
export const getTrialEndDate = (startDate: Date = new Date()): Date => {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + SUBSCRIPTION_CONFIG.TRIAL.DURATION_DAYS);
  return endDate;
};

export const generateTrialOrderId = (userId: number): string => {
  return `trial-${userId}-${Date.now()}`;
};

export const isTrialExpired = (endDate: Date): boolean => {
  return new Date() > new Date(endDate);
};

export const getTrialSubscriptionData = (userId: number) => {
  const trialEndDate = getTrialEndDate();
  
  return {
    subscription: {
      userId,
      status: SUBSCRIPTION_CONFIG.STATUS.TRIAL,
      endDate: trialEndDate,
      isTrial: true,
      trialUsed: true,
      planId: SUBSCRIPTION_CONFIG.TRIAL.PLAN_ID,
      productName: SUBSCRIPTION_CONFIG.TRIAL.PRODUCT_NAME,
      variantName: SUBSCRIPTION_CONFIG.TRIAL.VARIANT_NAME,
      subscriptionLengthInMonths: 0,
      totalAmount: 0,
      currency: 'USD',
      orderId: generateTrialOrderId(userId),
    },
    tokenUsage: {
      userId,
      totalWordLimit: SUBSCRIPTION_CONFIG.TRIAL.TOKEN_LIMIT,
      wordsGenerated: 0,
      expirationTime: trialEndDate,
      tokenLog: {
        amount: SUBSCRIPTION_CONFIG.TRIAL.TOKEN_LIMIT,
        type: SUBSCRIPTION_CONFIG.TOKEN_LOG_TYPES.TRIAL,
        description: 'Trial subscription token allocation',
      },
    },
  };
}; 