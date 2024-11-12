import { Expose } from 'class-transformer';
import { TransformHeadshot } from 'src/shared/decorators/transform-headshot.decorator';

export class GetFileDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  originalName: string;

  @Expose()
  mimeType: string;

  @Expose()
  size: number;

  @Expose()
  @TransformHeadshot(process.env.BACKEND_URL)
  url: string;

  @Expose()
  isPublic: boolean;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
