import { Injectable, Logger } from '@nestjs/common';
import { successResponse, errorResponse } from 'src/shared/helpers/functions';
import { GenerateCarouselContentDto } from './dto/generate-caorusel-content.dto';
import { GenerateLinkedInPostsDto } from './dto/generate-linkedin-posts.dto';
import { ResponseModel } from 'src/shared/models/response.model';
import { OpenAIService } from './openai.service';
import { PrismaService } from '../prisma/prisma.service';
import { coreConstant } from 'src/shared/helpers/coreConstant';
import { GenerateContentIdeasForWorkspaceDto } from './dto/generate-content-ideas.dto';

interface TokenCheckResult {
  isValid: boolean;
  message: string;
  remainingTokens: number;
  totalTokens: number;
  wordCount: number;
}

@Injectable()
export class AiContentService {
  private readonly logger = new Logger(AiContentService.name);

  constructor(
    private readonly openAIService: OpenAIService,
    private readonly prisma: PrismaService,
  ) {}

  private calculateWordCount(text: string): number {
    return text.trim().split(/\s+/).length;
  }

  private getErrorMessage(message: string): string {
    const errorMessages = {
      TOKEN_NOT_FOUND:
        'Insufficient word tokens available please purchase/upgrade package',
      TOKEN_EXPIRED: 'Word tokens have expired',
      INSUFFICIENT_TOKENS: 'Insufficient word tokens available',
    };
    return errorMessages[message] || 'Error processing word tokens';
  }

  private async checkTokenAvailability(
    userId: string,
    wordCount: number,
  ): Promise<TokenCheckResult> {
    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { userId },
        include: { package: true },
      });

      if (!subscription) {
        return {
          isValid: false,
          message: 'TOKEN_NOT_FOUND',
          remainingTokens: 0,
          totalTokens: 0,
          wordCount: 0,
        };
      }

      if (subscription.endDate < new Date()) {
        return {
          isValid: false,
          message: 'TOKEN_EXPIRED',
          remainingTokens: 0,
          totalTokens: subscription.monthlyWordLimit,
          wordCount: 0,
        };
      }

      const remainingTokens =
        subscription.monthlyWordLimit - subscription.wordsGenerated;

      if (wordCount > remainingTokens) {
        return {
          isValid: false,
          message: 'INSUFFICIENT_TOKENS',
          remainingTokens,
          totalTokens: subscription.monthlyWordLimit,
          wordCount: 0,
        };
      }

      return {
        isValid: true,
        message: 'TOKENS_AVAILABLE',
        remainingTokens,
        totalTokens: subscription.monthlyWordLimit,
        wordCount,
      };
    } catch (error) {
      this.logger.error(`Error checking token availability: ${error.message}`);
      throw error;
    }
  }

  private async deductTokens(
    userId: string,
    wordCount: number,
  ): Promise<boolean> {
    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { userId },
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      await this.prisma.$transaction([
        this.prisma.subscription.update({
          where: { userId },
          data: {
            wordsGenerated: {
              increment: wordCount,
            },
          },
        }),
        this.prisma.wordTokenLog.create({
          data: {
            subscriptionId: subscription.id,
            amount: -wordCount,
            type: coreConstant.WORD_TOKEN_LOG_TYPE.USAGE,
            description: `Content generation: ${wordCount} words`,
            source: 'AI_CONTENT_GENERATION',
          },
        }),
      ]);
      return true;
    } catch (error) {
      this.logger.error(`Error deducting tokens: ${error.message}`);
      throw error;
    }
  }

  async getTokenUsage(userId: string): Promise<ResponseModel> {
    try {
      const now = new Date();
      const subscription = await this.prisma.subscription.findUnique({
        where: { userId },
        select: {
          monthlyWordLimit: true,
          wordsGenerated: true,
          endDate: true,
          nextWordResetDate: true,
          status: true,
        },
      });

      if (!subscription) {
        return errorResponse('No subscription found');
      }

      const total = subscription.monthlyWordLimit;
      const used = subscription.wordsGenerated;
      const isActive =
        subscription.status === coreConstant.SUBSCRIPTION_STATUS.ACTIVE;

      return successResponse('Token usage data', {
        usage: {
          total,
          used,
          remaining: total - used,
          isActive,
          expirationDate: subscription.endDate,
          nextResetDate: subscription.nextWordResetDate,
        },
        percentage: {
          used: Math.round((used / total) * 100) || 0,
          remaining: Math.round(((total - used) / total) * 100) || 0,
        },
      });
    } catch (error) {
      this.logger.error(`Error getting token usage: ${error.message}`);
      return errorResponse('Error fetching token usage data');
    }
  }

  private async checkAndDeductTokens(
    userId: string,
    content: string,
  ): Promise<TokenCheckResult> {
    try {
      const wordCount = this.calculateWordCount(content);

      // Check token availability
      const tokenCheck = await this.checkTokenAvailability(userId, wordCount);
      if (!tokenCheck.isValid) {
        return tokenCheck;
      }

      // Deduct tokens if available
      const deductionResult = await this.deductTokens(userId, wordCount);
      if (!deductionResult) {
        throw new Error('Failed to deduct tokens');
      }

      // Get updated token count after deduction
      const subscription = await this.prisma.subscription.findUnique({
        where: { userId },
        select: {
          monthlyWordLimit: true,
          wordsGenerated: true,
        },
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      return {
        isValid: true,
        message: 'Tokens deducted successfully',
        remainingTokens:
          subscription.monthlyWordLimit - subscription.wordsGenerated,
        totalTokens: subscription.monthlyWordLimit,
        wordCount,
      };
    } catch (error) {
      this.logger.error(`Error in checkAndDeductTokens: ${error.message}`);
      throw error;
    }
  }

  private async checkTokenAvailabilityBeforeGeneration(
    userId: string,
  ): Promise<TokenCheckResult> {
    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { userId },
      });

      if (!subscription) {
        return {
          isValid: false,
          message: 'TOKEN_NOT_FOUND',
          remainingTokens: 0,
          totalTokens: 0,
          wordCount: 0,
        };
      }

      if (subscription.endDate < new Date()) {
        return {
          isValid: false,
          message: 'TOKEN_EXPIRED',
          remainingTokens: 0,
          totalTokens: subscription.monthlyWordLimit,
          wordCount: 0,
        };
      }

      const remainingTokens =
        subscription.monthlyWordLimit - subscription.wordsGenerated;
      if (remainingTokens <= 0) {
        return {
          isValid: false,
          message: 'INSUFFICIENT_TOKENS',
          remainingTokens,
          totalTokens: subscription.monthlyWordLimit,
          wordCount: 0,
        };
      }
      console.log('remainingTokens', remainingTokens);

      return {
        isValid: true,
        message: 'TOKENS_AVAILABLE',
        remainingTokens,
        totalTokens: subscription.monthlyWordLimit,
        wordCount: 0,
      };
    } catch (error) {
      this.logger.error(`Error checking token availability: ${error.message}`);
      throw error;
    }
  }

  async generateCarouselContent(
    userId: string,
    dto: GenerateCarouselContentDto,
  ): Promise<ResponseModel> {
    try {
      // Check token availability first
      const tokenCheck =
        await this.checkTokenAvailabilityBeforeGeneration(userId);
      if (!tokenCheck.isValid) {
        return errorResponse(this.getErrorMessage(tokenCheck.message));
      }

      const content: string =
        await this.openAIService.generateCarouselContentFromTopic(
          dto.topic,
          dto.numSlides,
          dto.language,
          dto.mood,
          dto.contentStyle,
          dto.targetAudience,
        );

      const tokenDeduction = await this.checkAndDeductTokens(userId, content);
      if (!tokenDeduction.isValid) {
        return errorResponse(this.getErrorMessage(tokenDeduction.message));
      }

      let colorPaletteResponse: string | null = null;
      if (dto.themeActive) {
        colorPaletteResponse =
          await this.openAIService.generateCarouselColorPaletteFromPromptTopic(
            dto.topic,
            dto.theme,
          );
      }

      const response = this.openAIService.parseCarouselContentToJSON(content);
      const colorPalette = colorPaletteResponse
        ? this.openAIService.parseColorPaletteToJSON(colorPaletteResponse)
        : null;

      return successResponse('Carousel content generated successfully', {
        response,
        colorPalette,
        wordCount: tokenDeduction.wordCount,
        remainingTokens: tokenDeduction.remainingTokens,
        totalTokens: tokenDeduction.totalTokens,
      });
    } catch (error) {
      this.logger.error(`Error generating carousel content: ${error.message}`);
      return errorResponse('Error generating carousel content');
    }
  }

  async generateLinkedInPosts(
    userId: string,
    dto: GenerateLinkedInPostsDto,
  ): Promise<ResponseModel> {
    try {
      // Check token availability first
      const tokenCheck =
        await this.checkTokenAvailabilityBeforeGeneration(userId);
      if (!tokenCheck.isValid) {
        return errorResponse(this.getErrorMessage(tokenCheck.message));
      }

      const rawContent: string = await this.openAIService.generateLinkedInPosts(
        dto.prompt,
        dto.language,
        dto.tone,
      );

      const tokenDeduction = await this.checkAndDeductTokens(
        userId,
        rawContent,
      );
      if (!tokenDeduction.isValid) {
        return errorResponse(this.getErrorMessage(tokenDeduction.message));
      }

      return successResponse('LinkedIn post generated successfully', {
        post: rawContent,
        wordCount: tokenDeduction.wordCount,
        remainingTokens: tokenDeduction.remainingTokens,
        totalTokens: tokenDeduction.totalTokens,
      });
    } catch (error) {
      this.logger.error(`Error generating LinkedIn post: ${error.message}`);
      return errorResponse('Error generating LinkedIn post');
    }
  }

  async generateContentIdeasForWorkspace(
    userId: string,
    dto: GenerateContentIdeasForWorkspaceDto,
  ): Promise<ResponseModel> {
    try {
      // Initial token availability check
      const tokenCheck =
        await this.checkTokenAvailabilityBeforeGeneration(userId);
      if (!tokenCheck.isValid) {
        return errorResponse(this.getErrorMessage(tokenCheck.message));
      }

      // Get workspace data
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: dto.workspaceId, userId },
        select: {
          personalAiVoice: true,
        },
      });

      if (!workspace) {
        return errorResponse('Workspace not found');
      }

      if (!workspace.personalAiVoice) {
        return errorResponse('Workspace AI voice not configured');
      }

      // Generate content
      const content = await this.openAIService.generateContentIdeasForWorkspace(
        workspace.personalAiVoice,
      );

      // Deduct tokens and get updated counts
      const tokenDeduction = await this.checkAndDeductTokens(userId, content);
      if (!tokenDeduction.isValid) {
        return errorResponse(this.getErrorMessage(tokenDeduction.message));
      }

      // Parse ideas
      const ideas = this.openAIService.parseContentIdeas(content);

      // Get final token count after deduction
      const finalTokenCount = await this.prisma.subscription.findUnique({
        where: { userId },
        select: {
          monthlyWordLimit: true,
          wordsGenerated: true,
        },
      });

      return successResponse('Content ideas generated successfully', {
        ideas,
        tokenUsage: {
          wordCount: tokenDeduction.wordCount,
          remainingTokens:
            finalTokenCount.monthlyWordLimit - finalTokenCount.wordsGenerated,
          totalTokens: finalTokenCount.monthlyWordLimit,
        },
      });
    } catch (error) {
      this.logger.error(
        `Error generating content ideas for workspace: ${error.message}`,
      );
      return errorResponse('Error generating content ideas for workspace');
    }
  }

  async generateLinkedInPostContentForCarousel(
    userId: string,
    topic: string,
  ): Promise<ResponseModel> {
    try {
      // Check token availability first
      const tokenCheck =
        await this.checkTokenAvailabilityBeforeGeneration(userId);
      if (!tokenCheck.isValid) {
        return errorResponse(this.getErrorMessage(tokenCheck.message));
      }

      const content =
        await this.openAIService.generateLinkedInPostContentForCarousel(topic);

      const tokenDeduction = await this.checkAndDeductTokens(userId, content);
      if (!tokenDeduction.isValid) {
        return errorResponse(this.getErrorMessage(tokenDeduction.message));
      }

      return successResponse('LinkedIn post content generated successfully', {
        post: content,
        wordCount: tokenDeduction.wordCount,
        remainingTokens: tokenDeduction.remainingTokens,
        totalTokens: tokenDeduction.totalTokens,
      });
    } catch (error) {
      this.logger.error(
        `Error generating LinkedIn post content for carousel: ${error.message}`,
      );
      return errorResponse(
        'Error generating LinkedIn post content for carousel',
      );
    }
  }

  async addTokens(userId: string, amount: number): Promise<ResponseModel> {
    try {
      await this.prisma.$transaction([
        this.prisma.subscription.update({
          where: { userId },
          data: {
            monthlyWordLimit: {
              increment: amount,
            },
          },
        }),
        this.prisma.wordTokenLog.create({
          data: {
            subscriptionId: userId,
            amount: amount,
            type: coreConstant.WORD_TOKEN_LOG_TYPE.RESET,
            description: `Added ${amount} tokens`,
            source: 'AI_CONTENT_GENERATION',
          },
        }),
      ]);

      return successResponse('Tokens added successfully', { amount });
    } catch (error) {
      this.logger.error(`Error adding tokens: ${error.message}`);
      return errorResponse('Error adding tokens');
    }
  }

  async resetTokens(userId: string): Promise<ResponseModel> {
    try {
      await this.prisma.subscription.update({
        where: { userId },
        data: {
          wordsGenerated: 0,
          lastWordResetDate: new Date(),
        },
      });

      return successResponse('Tokens reset successfully');
    } catch (error) {
      this.logger.error(`Error resetting tokens: ${error.message}`);
      return errorResponse('Error resetting tokens');
    }
  }

  async assignTokenCredits(
    userId: string,
    credits: number,
    expirationDays: number = 30,
  ): Promise<{
    success: boolean;
    credits?: number;
    expirationDate?: Date;
    error?: string;
  }> {
    try {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + expirationDays);
      const now = new Date();
      const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const existingSubscription = await this.prisma.subscription.findUnique({
        where: { userId },
      });

      if (existingSubscription) {
        // Update existing subscription
        await this.prisma.$transaction([
          this.prisma.subscription.update({
            where: { userId },
            data: {
              monthlyWordLimit: {
                increment: credits,
              },
              endDate: expirationDate,
              lastWordResetDate: now,
              nextWordResetDate: nextMonthDate,
              nextPostResetDate: nextMonthDate,
              nextCarouselResetDate: nextMonthDate,
              status: coreConstant.SUBSCRIPTION_STATUS.ACTIVE,
            },
          }),
          this.prisma.wordTokenLog.create({
            data: {
              subscription: {
                connect: {
                  id: existingSubscription.id,
                },
              },
              amount: credits,
              type: coreConstant.WORD_TOKEN_LOG_TYPE.RESET,
              description: `Added ${credits} token credits`,
              source: 'AI_CONTENT_GENERATION',
            },
          }),
        ]);
      } else {
        // Create new subscription
        const newSubscription = await this.prisma.subscription.create({
          data: {
            user: {
              connect: {
                id: userId,
              },
            },
            package: {
              connect: {
                id: '1', // Default package ID
              },
            },
            monthlyWordLimit: credits,
            wordsGenerated: 0,
            linkedInPostsUsed: 0,
            carouselsGenerated: 0,
            endDate: expirationDate,
            lastWordResetDate: now,
            nextWordResetDate: nextMonthDate,
            nextPostResetDate: nextMonthDate,
            nextCarouselResetDate: nextMonthDate,
            status: coreConstant.SUBSCRIPTION_STATUS.ACTIVE,
          },
        });

        // Create initial token log
        await this.prisma.wordTokenLog.create({
          data: {
            subscription: {
              connect: {
                id: newSubscription.id,
              },
            },
            amount: credits,
            type: coreConstant.WORD_TOKEN_LOG_TYPE.RESET,
            description: `Initial assignment of ${credits} token credits`,
            source: 'AI_CONTENT_GENERATION',
          },
        });
      }

      return {
        success: true,
        credits,
        expirationDate,
      };
    } catch (error) {
      this.logger.error(`Error assigning token credits: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
