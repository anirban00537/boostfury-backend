import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

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

@Injectable()
export class OpenAIService {
  private readonly openai: OpenAI;
  private readonly logger = new Logger(OpenAIService.name);

  constructor(private readonly configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async generateCarouselContentFromTopic(
    topic: string,
    numSlides: number = 5,
    language: string = 'en',
    mood: string = 'neutral',
    contentStyle: string = 'Professional',
    targetAudience: string = 'General',
  ): Promise<string> {
    try {
      const maxTokensPerSlide = 100;
      const maxTokens = Math.min(numSlides * maxTokensPerSlide, 1000);

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini-2024-07-18',
        messages: [
          {
            role: 'user',
            content: `You are an expert LinkedIn carousel content creator. Generate ${numSlides} engaging and informative carousel slides on the topic "${topic}". The ${numSlides} slides should exclude the intro and outro. Use the following format and guidelines:

            Guidelines:
            - Each slide should focus on a single idea or concept.
            - Ensure that the content is concise, clear, and engaging.
            - Reorganize and rephrase content to fit the slide format naturally.
            - **Wrap the most important keywords, phrases, and concepts in both the title and description within <strong></strong> tags.** This is crucial for highlighting key points.
            - Use a consistent tone that matches the specified mood (${mood}) and content style (${contentStyle}).
            - Tailor the content for the ${contentStyle} style and ${targetAudience} audience.
            - Do not provide any markdown formatting.
            
            Format:

            [Intro]
            type: intro
            tagline: [max 60 characters]
            title: [max 60 characters]
            description: [200-300 characters]

            [Slide {n}]
            type: slide
            title: [max 60 characters, with important text wrapped in <strong></strong> tags]
            description: [200-300 characters, with important text wrapped in <strong></strong> tags]

            [Outro]
            type: outro
            tagline: [max 60 characters]
            title: [max 60 characters]
            description: [200-300 characters]

            The content should be in ${language} and convey a ${mood} mood. Ensure that important text is wrapped in <strong></strong> tags as instructed. Do not include any additional text or explanations.
            `,
          },
        ],
        max_tokens: maxTokens,
        temperature: 0.6,
      });

      if (response && response.choices && response.choices.length > 0) {
        return response.choices[0].message.content;
      } else {
        throw new Error('No response from OpenAI');
      }
    } catch (error) {
      this.logger.error('Error generating carousel content:', error);
      throw error;
    }
  }

  async generateCarouselColorPaletteFromPromptTopic(
    topic: string,
    theme: string,
  ): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini-2024-07-18',
        messages: [
          {
            role: 'user',
            content: `Generate a ${theme} theme color palette for "${topic}" with 4 hex color codes for an AI carousel generator.

            Guidelines:
            - Identify brand colors associated with the topic or industry.
            - **color4: Main brand color or most representative color for the topic.**
            - **color3: A lighter version of the brand color.**
            - For "dark" theme: color1 should be dark, color2 should be light.
            - For "light" theme: color1 should be light, color2 should be dark.
            - Ensure high contrast between colors for readability.
            - Palette should be cohesive and appropriate for the topic.
            - Provide only the color palette in the specified format.

            Format:
            color1: [hex code]
            color2: [hex code]
            color3: [hex code] (lighter version of brand color)*
            color4: [hex code] (main brand/representative color)
            `,
          },
        ],
        max_tokens: 100,
        temperature: 0.6,
      });

      if (response && response.choices && response.choices.length > 0) {
        return response.choices[0].message.content;
      } else {
        throw new Error('No response from OpenAI');
      }
    } catch (error) {
      this.logger.error('Error generating color palette:', error);
      throw error;
    }
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

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini-2024-07-18',

        messages: [
          {
            role: 'system',
            content: `
            You are an expert LinkedIn post creator with 10 years of content creation experience.

            Core Writing Elements:
            - Write in a conversational, authentic tone
            - Use simple, relatable language (no jargon)
            - Keep paragraphs short (1-2 lines max)
            - Create punchy, impactful sentences
            - Avoid lengthy explanations
            - Include white space for readability

            Content Structure (Keep it Brief):
            1. Hook (1-2 attention-grabbing lines)
            2. Quick main point with example (2-3 lines)
            3. Short takeaways (3-4 bullet points max)
            4. One-line call-to-action or question

            Engagement Techniques:
            - Challenge common beliefs briefly
            - Add emotional touch (but keep it short)
            - Share quick insights or "aha moments"
            - Give short behind-the-scenes glimpses
            - Address one main pain point

            Value Delivery (Be Concise):
            - One clear actionable insight
            - Brief real-world example
            - Single unique perspective
            - Focus on one solution

            Format Requirements:
            - Plain text only (NO markdown, HTML, **, #, *, _)
            - Use \n\n for paragraph breaks
            - Maximum 3 emojis only
            - STRICT 1300 character limit
            - Use bullet points (•) sparingly
            - Consistent paragraph spacing
            - Avoid long stories or explanations
            - Keep each section short and focused
            `,
          },
          {
            role: 'user',
            content: `
 Create a LinkedIn post about "${prompt}" that will drive engagement.
            Style: ${toneGuide[tone]}
            Language: ${language}
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
}
