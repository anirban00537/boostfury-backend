import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateWorkspacePersonalAiVoiceDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  personalAiVoice: string;
}
