import { IsNotEmpty, IsString } from 'class-validator';

export class GenerateContentIdeasForWorkspaceDto {
  @IsString()
  @IsNotEmpty()
  workspaceId: string;
}
