import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsString,
  Max,
  Min,
  ValidateNested,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { coreConstant } from 'src/shared/helpers/coreConstant';

export interface TimeSlotData {
  dayOfWeek: number;
  time: string;
  isActive: boolean;
}

export class SlotInfo {
  @IsNumber()
  @Min(coreConstant.DAYS_OF_WEEK.SUNDAY)
  @Max(coreConstant.DAYS_OF_WEEK.SATURDAY)
  dayOfWeek: number;

  @IsBoolean()
  isActive: boolean;
}

export class TimeSlotGroup {
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Time must be in HH:mm format (24-hour)',
  })
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
