export interface LinkedInPostResponse {
  postId: string;
  author: string;
  created?: {
    time: number;
  };
}

export interface LinkedInPostError {
  message: string;
  status?: number;
  code?: string;
}

export interface LinkedInPostMedia {
  status: 'READY';
  description: {
    text: string;
  };
  media: string;
  title: {
    text: string;
  };
}

export interface LinkedInPostPayload {
  author: string;
  lifecycleState: 'PUBLISHED';
  specificContent: {
    'com.linkedin.ugc.ShareContent': {
      shareCommentary: {
        text: string;
      };
      shareMediaCategory: 'NONE' | 'IMAGE';
      media?: LinkedInPostMedia[];
    };
  };
  visibility: {
    'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC';
  };
} 