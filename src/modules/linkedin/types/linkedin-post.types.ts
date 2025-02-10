export interface LinkedInPostResponse {
  id: string;
  author: string;
  createdAt: number;
  lastModifiedAt: number;
  lifecycleState: string;
  visibility: string;
}

export interface LinkedInPostError {
  message: string;
  status?: number;
  code?: string;
}

export interface LinkedInMediaAsset {
  id: string;
  type: 'IMAGE' | 'VIDEO' | 'ARTICLE' | 'DOCUMENT';
  title?: string;
  altText?: string;
}

export interface LinkedInPostContent {
  text: string;
  media?: LinkedInMediaAsset[];
}

export interface LinkedInPostPayload {
  author: string;
  commentary: string;
  content?: LinkedInPostContent;
  visibility: 'PUBLIC' | 'CONNECTIONS' | 'LOGGED_IN';
  distribution?: {
    feedDistribution: 'MAIN_FEED' | 'NONE';
    targetEntities?: string[];
  };
  lifecycleState?: 'DRAFT' | 'PUBLISHED';
  isReshareDisabledByAuthor?: boolean;
}

export interface LinkedInMediaUploadResponse {
  value: {
    uploadMechanism: {
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
        uploadUrl: string;
      };
    };
    asset: string;
  };
}

export interface LinkedInMediaUploadRequest {
  registerUploadRequest: {
    recipes: string[];
    owner: string;
    serviceRelationships: Array<{
      relationshipType: string;
      identifier: string;
    }>;
  };
} 