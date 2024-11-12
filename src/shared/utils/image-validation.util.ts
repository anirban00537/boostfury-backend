import axios from 'axios';
import { coreConstant } from '../helpers/coreConstant';

export interface ImageValidationResult {
  isValid: boolean;
  error?: string;
}

export interface ImageValidationOptions {
  maxSize?: number;
  supportedTypes?: string[];
  minDimensions?: { WIDTH: number; HEIGHT: number };
  maxDimensions?: { WIDTH: number; HEIGHT: number };
  aspectRatio?: { MIN: number; MAX: number };
}

export async function validateLinkedInImage(
  imageUrl: string,
  options: ImageValidationOptions = {}
): Promise<ImageValidationResult> {
  try {
    // Use default LinkedIn constraints if not provided
    const {
      maxSize = coreConstant.LINKEDIN.MAX_IMAGE_SIZE,
      supportedTypes = coreConstant.LINKEDIN.SUPPORTED_IMAGE_TYPES,
      minDimensions = coreConstant.LINKEDIN.MIN_IMAGE_DIMENSIONS,
      maxDimensions = coreConstant.LINKEDIN.MAX_IMAGE_DIMENSIONS,
      aspectRatio = coreConstant.LINKEDIN.ASPECT_RATIO,
    } = options;

    // Check if URL is valid
    if (!imageUrl || !imageUrl.trim()) {
      return {
        isValid: false,
        error: 'Image URL is required',
      };
    }

    try {
      new URL(imageUrl);
    } catch {
      return {
        isValid: false,
        error: 'Invalid image URL',
      };
    }

    // Get image metadata
    const response = await axios.head(imageUrl);
    
    // Check content type
    const contentType = response.headers['content-type'];
    if (!supportedTypes.includes(contentType)) {
      return {
        isValid: false,
        error: `Unsupported image type. Allowed types: ${supportedTypes.join(', ')}`,
      };
    }

    // Check file size
    const contentLength = parseInt(response.headers['content-length'], 10);
    if (contentLength > maxSize) {
      return {
        isValid: false,
        error: `Image size must be less than ${maxSize / (1024 * 1024)}MB`,
      };
    }

    // Get image dimensions (optional, as it requires downloading the image)
    // You might want to implement this based on your needs
    // This would involve downloading the image and checking dimensions
    // using a library like sharp or image-size

    return { isValid: true };
  } catch (error) {
    console.error('Image validation error:', error);
    return {
      isValid: false,
      error: 'Failed to validate image: ' + (error.message || 'Unknown error'),
    };
  }
}

// Optional: Add more specific validation functions if needed
export function validateImageDimensions(
  width: number,
  height: number,
  minDimensions = coreConstant.LINKEDIN.MIN_IMAGE_DIMENSIONS,
  maxDimensions = coreConstant.LINKEDIN.MAX_IMAGE_DIMENSIONS,
): ImageValidationResult {
  if (width < minDimensions.WIDTH || height < minDimensions.HEIGHT) {
    return {
      isValid: false,
      error: `Image dimensions must be at least ${minDimensions.WIDTH}x${minDimensions.HEIGHT}`,
    };
  }

  if (width > maxDimensions.WIDTH || height > maxDimensions.HEIGHT) {
    return {
      isValid: false,
      error: `Image dimensions must not exceed ${maxDimensions.WIDTH}x${maxDimensions.HEIGHT}`,
    };
  }

  return { isValid: true };
}

export function validateImageAspectRatio(
  width: number,
  height: number,
  aspectRatioLimits = coreConstant.LINKEDIN.ASPECT_RATIO,
): ImageValidationResult {
  const ratio = width / height;
  
  if (ratio < aspectRatioLimits.MIN || ratio > aspectRatioLimits.MAX) {
    return {
      isValid: false,
      error: `Image aspect ratio must be between ${aspectRatioLimits.MIN}:1 and ${aspectRatioLimits.MAX}:1`,
    };
  }

  return { isValid: true };
} 