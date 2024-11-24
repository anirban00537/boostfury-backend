import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export interface TimeSlotData {
  dayOfWeek: number;
  time: string;
  isActive: boolean;
}

export class SlotInfo {
  @IsNumber()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsBoolean()
  isActive: boolean;
}

export class TimeSlotGroup {
  @IsString()
  time: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SlotInfo)
  slots: SlotInfo[];
}

export class UpdateTimeSlotsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotGroup)
  timeSlots: TimeSlotGroup[];
}
