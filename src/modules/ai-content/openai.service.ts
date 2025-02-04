import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export interface BackgroundColors {
  color1: string; // Background Color
  color2: string; // Text Color
  color3: string; // Tint Color
  color4: string; // Accent Color
}

type Slide = {
  tagline?: string;
  title?: string;
  paragraph?: string;
  'Call to action'?: string;
};

interface LinkedInPost {
  content: string;
}

interface ContentIdea {
  idea: string;
}

@Injectable()
export class OpenAIService {
  private readonly openai: OpenAI;
  private readonly logger = new Logger(OpenAIService.name);

  constructor(private readonly configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  parseCarouselContentToJSON(content: string): Slide[] {
    const slides: Slide[] = [];
    const sections = content
      .split(/\[|\]/)
      .filter((section) => section.trim() !== '');

    sections.forEach((section) => {
      const lines = section.split('\n').filter((line) => line.trim() !== '');
      if (lines.length === 0) return;

      const slide: Slide = {};
      lines.forEach((line) => {
        const [key, ...value] = line.split(':');
        if (key && value.length > 0) {
          const trimmedKey = key.trim();
          if (this.isValidSlideKey(trimmedKey)) {
            slide[trimmedKey] = value.join(':').trim();
          }
        }
      });

      // Only push the slide if it has at least one key-value pair
      if (Object.keys(slide).length > 0) {
        slides.push(slide);
      }
    });

    return slides;
  }

  parseColorPaletteToJSON(content: string): BackgroundColors {
    const colors: BackgroundColors = {
      color1: '',
      color2: '',
      color3: '',
      color4: '',
    };
    const lines = content.split('\n').filter((line) => line.trim() !== '');
    lines.forEach((line) => {
      const [key, ...value] = line.split(':');
      if (key && value.length > 0) {
        const trimmedKey = key.trim();
        if (this.isValidColorKey(trimmedKey)) {
          colors[trimmedKey] = value.join(':').trim();
        }
      }
    });
    return colors;
  }

  private isValidSlideKey(key: string): key is keyof Slide {
    return ['type', 'tagline', 'title', 'description'].includes(key);
  }

  private isValidColorKey(key: string): key is keyof BackgroundColors {
    return ['color1', 'color2', 'color3', 'color4'].includes(key);
  }

  async generateLinkedInPosts(
    prompt: string,
    language: string = 'en',
    tone: string = 'professional',
    postLength: string = 'medium',
    category?: string,
  ): Promise<string> {
    try {
      const toneGuide = {
        professional: 'Use polished, industry-expert voice',
        casual: 'Write in a relaxed, approachable manner',
        friendly: 'Maintain a warm, welcoming tone',
        authoritative: 'Project expertise and leadership',
        humorous: 'Include light-hearted, witty elements',
        formal: 'Maintain sophisticated, business-appropriate language',
        inspirational: 'Use motivational, uplifting messaging',
        technical: 'Employ precise, technical terminology',
      };

      const lengthGuide = {
        short: 'Keep the post concise and brief (max 500 characters)',
        medium: 'Write a balanced post (max 1000 characters)',
        long: 'Create a detailed post (max 1500 characters)',
      };

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `
            You are a seasoned LinkedIn content strategist with over a decade of experience creating viral posts.

            Core Writing Elements:
            - Write in a conversational, authentic tone
            - Use simple, relatable language (no jargon)
            - Keep paragraphs short (1-2 lines max)
            - Create punchy, impactful sentences
            - Avoid lengthy explanations
            - Include white space for readability

            Content Structure:
            1. **Hook**: Start with 1-2 attention-grabbing lines to captivate the reader
            2. **Main Point**: Present a compelling main idea with a quick example (2-3 lines)
            3. **Takeaways**: Provide short, valuable insights or lessons (up to 3 bullet points)
            4. **Call-to-Action**: End with a one-line question or prompt to encourage engagement

            Engagement Techniques:
            - Challenge common beliefs or assumptions
            - Evoke emotions that resonate with the audience
            - Share unique insights or "aha" moments
            - Include a personal anecdote or experience
            - Address a pressing pain point with a fresh perspective

            Value Delivery:
            - Offer clear, actionable advice or tips
            - Present a new angle on a well-known topic
            - Inspire readers to think differently or take action
            - Ensure the content is highly shareable and relatable

            Format Requirements:
            - ***Plain text only (NO markdown, HTML, **, #, *, _)***
            - Use \n\n for paragraph breaks
            - ${lengthGuide[postLength]}
            - Use bullet points (•) sparingly and effectively donot add any **, #, *, _
            - Maintain consistent paragraph spacing
            - Avoid long stories; keep the content focused and impactful
            - Do not use any * ** ***

            Additional Instructions:
            - Integrate trending topics or relevant hashtags subtly
            - Encourage interaction by posing thought-provoking questions
            - Maintain authenticity and avoid clichés
            - Tailor the content to resonate with a professional audience
            ${category ? `- Focus on the ${category} category and its specific audience` : ''}
            `,
          },
          {
            role: 'user',
            content: `
            Create a LinkedIn post about "${prompt}" that is highly engaging and has the potential to go viral.

            Style: ${toneGuide[tone]}
            Language: ${language}
            Length: ${lengthGuide[postLength]}
            ${category ? `Category: ${category}` : ''}
            `,
          },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });

      if (response && response.choices && response.choices.length > 0) {
        return response.choices[0].message.content;
      } else {
        throw new Error('No response from OpenAI');
      }
    } catch (error) {
      this.logger.error('Error generating LinkedIn post:', error);
      throw error;
    }
  }

  async generateLinkedInPostContentForCarousel(topic: string): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini-2024-07-18',
        messages: [
          {
            role: 'user',
            content: `You are a professional LinkedIn content strategist specializing in carousel posts.

Your task: Create a compelling LinkedIn post to introduce a carousel about "${topic}".

Requirements:
- Keep it concise 300 characters max
- Include a hook in the first line
- Focus on value proposition
- Create curiosity about the carousel content
- Add a clear call-to-action to check the carousel
- Use professional but conversational tone
- Include relevant emojis (2-3 max)
- Don't reveal all the carousel content
- Plain text only (NO markdown, HTML, **, #, *, _)
- Create punchy, impactful sentences
- Avoid lengthy explanations
- Include white space for readability
- Use \n\n for paragraph breaks
- Consistent paragraph spacing
- End with "Swipe through the carousel to learn more ➡️"

Make it engaging and professional while maintaining brevity.
            `,
          },
        ],
        max_tokens: 200,
        temperature: 0.7,
      });

      if (response && response.choices && response.choices.length > 0) {
        return response.choices[0].message.content;
      } else {
        throw new Error('No response from OpenAI');
      }
    } catch (error) {
      this.logger.error('Error generating LinkedIn post:', error);
      throw error;
    }
  }

  parseLinkedInPostsToJSON(content: string): LinkedInPost[] {
    try {
      // Find the content after [Main Post]
      const mainPostMatch = content.match(
        /\[Main Post\]\s*content:\s*([\s\S]*?)(?=\d\.|$)/,
      );

      if (mainPostMatch && mainPostMatch[1]) {
        const postContent = mainPostMatch[1].trim();

        return [
          {
            content: postContent,
          },
        ];
      }

      // If no match found, return the entire content
      return [
        {
          content: content.trim(),
        },
      ];
    } catch (error) {
      this.logger.error('Error parsing LinkedIn post:', error);
      return [
        {
          content: content.trim(), // Return original content if parsing fails
        },
      ];
    }
  }

  parseContentIdeas(content: string): ContentIdea[] {
    try {
      // Split content by [idea] markers and filter empty strings
      const ideas = content
        .split(/\[idea\d+\]/)
        .map((idea) => idea.trim())
        .filter((idea) => idea.length > 0)
        .map((idea) => ({
          idea: idea.trim(),
        }));

      // If no ideas were found using the [idea] format, try splitting by line
      if (ideas.length === 0) {
        const lineIdeas = content
          .split('\n')
          .map((line) => line.trim())
          .filter(
            (line) =>
              line.length > 0 && !line.startsWith('[') && !line.startsWith('#'),
          )
          .map((idea) => ({
            idea: idea.trim(),
          }));

        return lineIdeas.slice(0, 5); // Ensure we only return 5 ideas
      }

      return ideas.slice(0, 5); // Ensure we only return 5 ideas
    } catch (error) {
      this.logger.error('Error parsing content ideas:', error);
      // Return the entire content as a single idea if parsing fails
      return [
        {
          idea: content.trim(),
        },
      ];
    }
  }

  async rewriteContent(content: string, instructions: string): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini-2024-07-18',
        messages: [
          {
            role: 'system',
            content: `You are an expert content writer and editor. Your task is to rewrite the provided content according to specific instructions while maintaining the core message and ensuring high quality.
            Instructions:
            ${instructions}

            Guidelines:
            - Maintain the original meaning and key points
            
            Please provide only the rewritten content without any additional comments or explanations.`,
          },
          {
            role: 'user',
            content: content,
          },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });

      if (!response?.choices?.[0]?.message?.content) {
        throw new Error('Invalid response from OpenAI');
      }

      return response.choices[0].message.content;
    } catch (error) {
      this.logger.error('Error rewriting content:', error);
      throw error;
    }
  }

  async generatePersonalizedLinkedInPost(
    professionalIdentity: string,
    selectedTopic: string,
    language: string = 'en',
    postLength: string = 'medium',
  ): Promise<string> {
    try {
      const lengthGuide = {
        short: 'Keep the post concise and brief (max 500 characters)',
        medium: 'Write a balanced post (max 1000 characters)',
        long: 'Create a detailed post (max 1500 characters)',
      };

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini-2024-07-18',
        messages: [
          {
            role: 'system',
            content: `
            You are an expert LinkedIn content creator specializing in professional thought leadership.

            Context (For Understanding Only):
            - Writer's Background: ${professionalIdentity}
            - Topic to Focus On: ${selectedTopic}
            
            Content Guidelines:
            - Create focused, insightful content about ${selectedTopic}
            - Provide industry insights and professional perspectives
            - Share practical knowledge and actionable advice
            - Maintain an authoritative yet approachable tone
            - Focus entirely on the topic, not on personal introductions

            Content Structure:
            1. Hook: Brief attention-grabbing opener (1 line max)
            2. Core Message: Share key insights about ${selectedTopic}
            3. Main Points: 2-3 valuable takeaways
            4. Practical Application: How this knowledge can be applied
            5. Engagement: End with a thought-provoking question

            Format Requirements:
            - Plain text only (NO markdown, HTML, **, #, *, _)
            - Use \n\n for paragraph breaks
            - ${lengthGuide[postLength]}
            - Use bullet points (•) sparingly
            - Keep paragraphs short (2-3 lines max)
            `,
          },
          {
            role: 'user',
            content: `Create an engaging LinkedIn post about ${selectedTopic} from your professional perspective. Share insights that would be valuable to your network.`,
          },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });

      if (!response?.choices?.[0]?.message?.content) {
        throw new Error('No response from OpenAI');
      }

      return response.choices[0].message.content;
    } catch (error) {
      this.logger.error('Error generating personalized LinkedIn post:', error);
      throw error;
    }
  }

  async generateContentFromScreenshot(
    imageBase64: string,
    customPrompt?: string,
  ): Promise<string> {
    try {
      const basePrompt = `You are a professional LinkedIn content creator. Your task is to analyze this website screenshot and create an engaging LinkedIn post.

Key Guidelines:
1. Start with a compelling hook or question
2. Highlight the website's unique value proposition and key features
3. Use professional but conversational tone
4. Include specific benefits or solutions
5. End with a clear call-to-action
6. Keep it concise and impactful (2-3 paragraphs)
7. Use emojis sparingly but effectively
8. Add relevant hashtags (3-5)

Format the post with proper spacing and line breaks for better readability.`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: basePrompt,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: customPrompt || "Based on this website screenshot, create an engaging LinkedIn post following the guidelines above.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
        store: true,
      });

      if (!response.choices?.[0]?.message?.content) {
        throw new Error('No content generated from OpenAI');
      }

      return response.choices[0].message.content;
    } catch (error) {
      this.logger.error(`Error generating content from screenshot: ${error.message}`);
      throw error;
    }
  }
}
