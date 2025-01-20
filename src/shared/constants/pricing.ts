export type PlanId = 'starter' | 'pro';

export interface PricingPlan {
  id: PlanId;
  name: string;
  description: string;
  price: number;
  limits: {
    aiWordsPerMonth: number;
    postsPerMonth: number;
    imageUploads: number;
    linkedInProfiles: number;
    carousels: number;
  };
  features: {
    scheduling: boolean;
    analytics: boolean;
    customBranding: boolean;
    bulkUpload: boolean;
    prioritySupport: boolean;
    aiAssistant: boolean;
    teamCollaboration: boolean;
  };
  featureTexts: string[];
  variants: {
    monthly: string;
    yearly: string;
  };
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for getting started',
    price: 9,
    limits: {
      aiWordsPerMonth: 10000,
      postsPerMonth: 30,
      imageUploads: 5,
      linkedInProfiles: 1,
      carousels: 10,
    },
    features: {
      scheduling: true,
      analytics: false,
      customBranding: false,
      bulkUpload: false,
      prioritySupport: false,
      aiAssistant: true,
      teamCollaboration: false,
    },
    featureTexts: [
      '10,000 AI words per month',
      '30 posts per month',
      '5 image uploads',
      '1 LinkedIn profile',
      '10 carousels',
      'Basic post scheduling',
      'Basic AI assistant',
      'Standard support',
      'Single user',
    ],
    variants: {
      monthly: '525068',
      yearly: '525061',
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For power users',
    price: 29,
    limits: {
      aiWordsPerMonth: 50000,
      postsPerMonth: -1, // Unlimited
      imageUploads: -1, // Unlimited
      linkedInProfiles: -1, // Unlimited
      carousels: -1, // Unlimited
    },
    features: {
      scheduling: true,
      analytics: true,
      customBranding: true,
      bulkUpload: true,
      prioritySupport: true,
      aiAssistant: true,
      teamCollaboration: true,
    },
    featureTexts: [
      '50,000 AI words per month',
      'Unlimited posts',
      'Unlimited image uploads',
      'Unlimited LinkedIn profiles',
      'Unlimited carousels',
      'Advanced post scheduling',
      'Advanced analytics',
      'Custom branding',
      'Bulk upload capability',
      'Priority support',
      'Advanced AI assistant',
      'Team collaboration tools',
    ],
    variants: {
      monthly: '585057',
      yearly: '585058',
    },
  },
];

export const getPlanByVariantId = (variantId: string): PlanId | null => {
  const plan = PRICING_PLANS.find(
    (plan) =>
      plan.variants.monthly === variantId || plan.variants.yearly === variantId,
  );
  return plan?.id || null;
};

export const getVariantId = (planId: PlanId): string | null => {
  const plan = PRICING_PLANS.find((p) => p.id === planId);
  return plan?.variants.monthly || null;
};

export const getPlanById = (planId: PlanId): PricingPlan | null => {
  return PRICING_PLANS.find((p) => p.id === planId) || null;
};

export const isUnlimited = (limit: number): boolean => limit === -1;

export const getLimitText = (limit: number): string => {
  return isUnlimited(limit) ? 'Unlimited' : limit.toString();
};

export const getFormattedFeatures = (plan: PricingPlan): string[] => {
  const features = [
    `${getLimitText(plan.limits.aiWordsPerMonth)} AI words per month`,
    `${getLimitText(plan.limits.postsPerMonth)} posts per month`,
    `${getLimitText(plan.limits.imageUploads)} image uploads`,
    `${getLimitText(plan.limits.linkedInProfiles)} LinkedIn profiles`,
    `${getLimitText(plan.limits.carousels)} carousels`,
  ];

  if (plan.features.scheduling) features.push('Post scheduling');
  if (plan.features.analytics) features.push('Advanced analytics');
  if (plan.features.customBranding) features.push('Custom branding');
  if (plan.features.bulkUpload) features.push('Bulk upload');
  if (plan.features.prioritySupport) features.push('Priority support');
  if (plan.features.aiAssistant) features.push('AI assistant');
  if (plan.features.teamCollaboration) features.push('Team collaboration');

  return features;
};
