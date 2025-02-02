import { Injectable, Logger } from '@nestjs/common';
import { successResponse, errorResponse } from 'src/shared/helpers/functions';
import { GenerateLinkedInPostsDto } from './dto/generate-linkedin-posts.dto';
import { ResponseModel } from 'src/shared/models/response.model';
import { OpenAIService } from './openai.service';
import { PrismaService } from '../prisma/prisma.service';
import { coreConstant } from 'src/shared/helpers/coreConstant';
import { RewriteContentDto } from './dto/rewrite-content.dto';
import { UpdateAiStyleDto } from './dto/update-ai-style.dto';
import { GeneratePersonalizedPostDto } from './dto/generate-personalized-post.dto';

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
        dto.postLength,
        dto.category,
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
      console.log(error, 'error');
      return errorResponse('Error generating LinkedIn post');
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
            endDate: expirationDate,
            lastWordResetDate: now,
            nextWordResetDate: nextMonthDate,
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

  async rewriteContent(
    userId: string,
    dto: RewriteContentDto,
  ): Promise<ResponseModel> {
    try {
      // Check if the LinkedIn post exists and belongs to the user
      const post = await this.prisma.linkedInPost.findFirst({
        where: {
          id: dto.linkedInPostId,
          userId: userId,
        },
      });

      if (!post) {
        return errorResponse(
          'LinkedIn post not found or you do not have permission to rewrite it',
        );
      }

      // Get the instruction prompt based on the type
      const instruction =
        coreConstant.LINKEDIN_REWRITE_PROMPTS[dto.instructionType];
      if (!instruction) {
        return errorResponse('Invalid instruction type');
      }

      // Check token availability first
      const tokenCheck =
        await this.checkTokenAvailabilityBeforeGeneration(userId);
      if (!tokenCheck.isValid) {
        return errorResponse(this.getErrorMessage(tokenCheck.message));
      }

      const rewrittenContent = await this.openAIService.rewriteContent(
        post.content,
        instruction,
      );

      const tokenDeduction = await this.checkAndDeductTokens(
        userId,
        rewrittenContent,
      );
      if (!tokenDeduction.isValid) {
        return errorResponse(this.getErrorMessage(tokenDeduction.message));
      }

      return successResponse('Content rewritten successfully', {
        content: rewrittenContent,
        originalContent: post.content,
        wordCount: tokenDeduction.wordCount,
        remainingTokens: tokenDeduction.remainingTokens,
        totalTokens: tokenDeduction.totalTokens,
        instructionType: dto.instructionType,
        instruction,
      });
    } catch (error) {
      this.logger.error(`Error rewriting content: ${error.message}`);
      return errorResponse('Error rewriting content');
    }
  }

  async updateAiStyle(
    userId: string,
    linkedInProfileId: string,
    updateAiStyleDto: UpdateAiStyleDto,
  ): Promise<ResponseModel> {
    try {
      // Verify LinkedIn profile belongs to user
      const linkedInProfile = await this.prisma.linkedInProfile.findFirst({
        where: {
          id: linkedInProfileId,
          userId,
        },
      });

      if (!linkedInProfile) {
        return errorResponse('LinkedIn profile not found');
      }

      // Update AI style preferences
      const updatedProfile = await this.prisma.linkedInProfile.update({
        where: { id: linkedInProfileId },
        data: {
          professionalIdentity: updateAiStyleDto.professionalIdentity,
          contentTopics: updateAiStyleDto.contentTopics,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          professionalIdentity: true,
          contentTopics: true,
        },
      });

      return successResponse('AI style preferences updated successfully', {
        aiStyle: updatedProfile,
      });
    } catch (error) {
      this.logger.error(`Error updating AI style: ${error.message}`);
      return errorResponse('Failed to update AI style preferences');
    }
  }

  async getAiStyle(
    userId: string,
    linkedInProfileId: string,
  ): Promise<ResponseModel> {
    try {
      const linkedInProfile = await this.prisma.linkedInProfile.findFirst({
        where: {
          id: linkedInProfileId,
          userId,
        },
        select: {
          id: true,
          professionalIdentity: true,
          contentTopics: true,
        },
      });

      if (!linkedInProfile) {
        return errorResponse('LinkedIn profile not found');
      }

      return successResponse('AI style preferences retrieved successfully', {
        aiStyle: linkedInProfile,
      });
    } catch (error) {
      this.logger.error(`Error retrieving AI style: ${error.message}`);
      return errorResponse('Failed to retrieve AI style preferences');
    }
  }

  async generatePersonalizedPost(
    userId: string,
    dto: GeneratePersonalizedPostDto,
  ): Promise<ResponseModel> {
    try {
      // Check token availability first
      const tokenCheck =
        await this.checkTokenAvailabilityBeforeGeneration(userId);
      if (!tokenCheck.isValid) {
        return errorResponse(this.getErrorMessage(tokenCheck.message));
      }

      // Get LinkedIn profile data
      const linkedInProfile = await this.prisma.linkedInProfile.findFirst({
        where: {
          id: dto.linkedInProfileId,
          userId,
        },
        select: {
          professionalIdentity: true,
          contentTopics: true,
        },
      });

      if (!linkedInProfile) {
        return errorResponse('LinkedIn profile not found');
      }

      if (!linkedInProfile.professionalIdentity) {
        return errorResponse('Professional identity not set');
      }

      if (!linkedInProfile.contentTopics?.length) {
        return errorResponse('No content topics defined');
      }

      // Randomly select one topic from the available topics
      const selectedTopic =
        linkedInProfile.contentTopics[
          Math.floor(Math.random() * linkedInProfile.contentTopics.length)
        ];

      // Generate the content
      const rawContent =
        await this.openAIService.generatePersonalizedLinkedInPost(
          linkedInProfile.professionalIdentity,
          selectedTopic,
          dto.language,
          dto.postLength,
        );

      // Check and deduct tokens
      const tokenDeduction = await this.checkAndDeductTokens(
        userId,
        rawContent,
      );
      if (!tokenDeduction.isValid) {
        return errorResponse(this.getErrorMessage(tokenDeduction.message));
      }

      return successResponse(
        'Personalized LinkedIn post generated successfully',
        {
          post: rawContent,
          selectedTopic,
          wordCount: tokenDeduction.wordCount,
          remainingTokens: tokenDeduction.remainingTokens,
          totalTokens: tokenDeduction.totalTokens,
        },
      );
    } catch (error) {
      this.logger.error('Error generating personalized post:', error);
      return errorResponse('Error generating personalized post');
    }
  }
}
