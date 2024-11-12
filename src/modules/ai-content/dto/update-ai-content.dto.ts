import { PartialType } from '@nestjs/swagger';
import { CreateAiContentDto } from './create-ai-content.dto';

export class UpdateAiContentDto extends PartialType(CreateAiContentDto) {}
