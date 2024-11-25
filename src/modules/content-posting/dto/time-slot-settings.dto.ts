import { IsArray, IsString, IsOptional, IsObject, IsNumber, Min, Max, IsBoolean } from 'class-validator';

export class DayTimeSlots {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  times: string[];
}

export class TimeSlotSettingsDto {
  @IsObject()
  monday: DayTimeSlots;

  @IsObject()
  tuesday: DayTimeSlots;

  @IsObject()
  wednesday: DayTimeSlots;

  @IsObject()
  thursday: DayTimeSlots;

  @IsObject()
  friday: DayTimeSlots;

  @IsObject()
  saturday: DayTimeSlots;

  @IsObject()
  sunday: DayTimeSlots;

  @IsNumber()
  @Min(1)
  @Max(10)
  postsPerDay: number;

  @IsNumber()
  @Min(30)
  @Max(1440)
  minTimeGap: number;

  @IsBoolean()
  isEnabled: boolean;
} 