import { Injectable, Logger } from '@nestjs/common';
import { successResponse, errorResponse } from 'src/shared/helpers/functions';
import { GenerateCarouselContentDto } from './dto/generate-caorusel-content.dto';
import { GenerateLinkedInPostsDto } from './dto/generate-linkedin-posts.dto';
import { ResponseModel } from 'src/shared/models/response.model';
import { OpenAIService } from './openai.service';
import { PrismaService } from '../prisma/prisma.service';

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
    userId: number,
    wordCount: number,
  ): Promise<TokenCheckResult> {
    try {
      const wordUsage = await this.prisma.aIWordUsage.findUnique({
        where: { userId },
      });

      if (!wordUsage) {
        return {
          isValid: false,
          message: 'TOKEN_NOT_FOUND',
          remainingTokens: 0,
          totalTokens: 0,
          wordCount: 0,
        };
      }

      if (wordUsage.expirationTime < new Date()) {
        return {
          isValid: false,
          message: 'TOKEN_EXPIRED',
          remainingTokens: 0,
          totalTokens: wordUsage.totalWordLimit,
          wordCount: 0,
        };
      }

      const remainingTokens =
        wordUsage.totalWordLimit - wordUsage.wordsGenerated;

      if (wordCount > remainingTokens) {
        return {
          isValid: false,
          message: 'INSUFFICIENT_TOKENS',
          remainingTokens,
          totalTokens: wordUsage.totalWordLimit,
          wordCount: 0,
        };
      }

      return {
        isValid: true,
        message: 'TOKENS_AVAILABLE',
        remainingTokens,
        totalTokens: wordUsage.totalWordLimit,
        wordCount: wordCount,
      };
    } catch (error) {
      this.logger.error(`Error checking token availability: ${error.message}`);
      throw error;
    }
  }

  private async deductTokens(
    userId: number,
    wordCount: number,
  ): Promise<boolean> {
    try {
      await this.prisma.$transaction([
        this.prisma.aIWordUsage.update({
          where: { userId },
          data: {
            wordsGenerated: {
              increment: wordCount,
            },
          },
        }),
        this.prisma.wordTokenLog.create({
          data: {
            aiWordUsageId: userId,
            amount: -wordCount,
            type: 'USAGE',
            description: `Content generation: ${wordCount} words`,
          },
        }),
      ]);
      return true;
    } catch (error) {
      this.logger.error(`Error deducting tokens: ${error.message}`);
      throw error;
    }
  }

  async getTokenUsage(userId: number): Promise<ResponseModel> {
    try {
      const now = new Date();
      const oneMonthFromNow = new Date();
      oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

      let tokenUsage = await this.prisma.aIWordUsage.findUnique({
        where: { userId },
        select: {
          totalWordLimit: true,
          expirationTime: true,
        },
      });

      const total = tokenUsage.totalWordLimit;
      const isActive = tokenUsage.expirationTime > now;

      return successResponse('Token usage data', {
        usage: {
          total,
          isActive,
          expirationDate: tokenUsage.expirationTime,
        },
        percentage: {
          used: Math.round((0 / total) * 100) || 0,
          remaining: Math.round((total / total) * 100) || 0,
        },
      });
    } catch (error) {
      this.logger.error(`Error getting token usage: ${error.message}`);
      return errorResponse('Error fetching token usage data');
    }
  }

  private async checkAndDeductTokens(
    userId: number,
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
      await this.deductTokens(userId, wordCount);

      return {
        isValid: true,
        message: 'Tokens deducted successfully',
        remainingTokens: tokenCheck.remainingTokens - wordCount,
        totalTokens: tokenCheck.totalTokens,
        wordCount, // Added to return word count
      };
    } catch (error) {
      this.logger.error(`Error in checkAndDeductTokens: ${error.message}`);
      throw error;
    }
  }

  private async checkTokenAvailabilityBeforeGeneration(
    userId: number,
  ): Promise<TokenCheckResult> {
    try {
      const wordUsage = await this.prisma.aIWordUsage.findUnique({
        where: { userId },
      });

      if (!wordUsage) {
        return {
          isValid: false,
          message: 'TOKEN_NOT_FOUND',
          remainingTokens: 0,
          totalTokens: 0,
          wordCount: 0,
        };
      }

      if (wordUsage.expirationTime < new Date()) {
        return {
          isValid: false,
          message: 'TOKEN_EXPIRED',
          remainingTokens: 0,
          totalTokens: wordUsage.totalWordLimit,
          wordCount: 0,
        };
      }

      const remainingTokens =
        wordUsage.totalWordLimit - wordUsage.wordsGenerated;
      if (remainingTokens <= 0) {
        return {
          isValid: false,
          message: 'INSUFFICIENT_TOKENS',
          remainingTokens,
          totalTokens: wordUsage.totalWordLimit,
          wordCount: 0,
        };
      }

      return {
        isValid: true,
        message: 'TOKENS_AVAILABLE',
        remainingTokens,
        totalTokens: wordUsage.totalWordLimit,
        wordCount: 0,
      };
    } catch (error) {
      this.logger.error(`Error checking token availability: ${error.message}`);
      throw error;
    }
  }

  async generateCarouselContent(
    userId: number,
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
    userId: number,
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

  async generateLinkedInPostContentForCarousel(
    userId: number,
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

  async addTokens(userId: number, amount: number): Promise<ResponseModel> {
    try {
      await this.prisma.$transaction([
        this.prisma.aIWordUsage.update({
          where: { userId },
          data: {
            totalWordLimit: {
              increment: amount,
            },
          },
        }),
        this.prisma.wordTokenLog.create({
          data: {
            aiWordUsageId: userId,
            amount: amount,
            type: 'CREDIT',
            description: `Added ${amount} tokens`,
          },
        }),
      ]);

      return successResponse('Tokens added successfully', { amount });
    } catch (error) {
      this.logger.error(`Error adding tokens: ${error.message}`);
      return errorResponse('Error adding tokens');
    }
  }

  async resetTokens(userId: number): Promise<ResponseModel> {
    try {
      const oneMonthFromNow = new Date();
      oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

      await this.prisma.aIWordUsage.update({
        where: { userId },
        data: {
          totalWordLimit: 0,
          expirationTime: oneMonthFromNow,
        },
      });

      return successResponse('Tokens reset successfully');
    } catch (error) {
      this.logger.error(`Error resetting tokens: ${error.message}`);
      return errorResponse('Error resetting tokens');
    }
  }

  async assignTokenCredits(
    userId: number,
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

      const existingUsage = await this.prisma.aIWordUsage.findUnique({
        where: { userId },
      });

      if (existingUsage) {
        await this.prisma.$transaction([
          this.prisma.aIWordUsage.update({
            where: { userId },
            data: {
              totalWordLimit: {
                increment: credits,
              },
              expirationTime: expirationDate,
              lastResetDate: new Date(),
            },
          }),
          this.prisma.wordTokenLog.create({
            data: {
              aiWordUsageId: existingUsage.id,
              amount: credits,
              type: 'CREDIT_ASSIGNMENT',
              description: `Assigned ${credits} token credits`,
            },
          }),
        ]);
      } else {
        await this.prisma.aIWordUsage.create({
          data: {
            userId,
            totalWordLimit: credits,
            wordsGenerated: 0,
            expirationTime: expirationDate,
            wordTokenLogs: {
              create: {
                amount: credits,
                type: 'CREDIT_ASSIGNMENT',
                description: `Initial assignment of ${credits} token credits`,
              },
            },
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
