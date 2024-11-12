import { TransformHeadshot } from '../../../shared/decorators/transform-headshot.decorator';
export class BrandingResponseDto {
  id: string;
  userId: number;
  name: string;
  handle: string;

  @TransformHeadshot(process.env.BACKEND_URL)
  headshot: string | null;
}
