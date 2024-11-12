import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';

export const IS_SUBSCRIBED_KEY = 'isSubscribed';
export const IsSubscribed = () => SetMetadata(IS_SUBSCRIBED_KEY, true);
