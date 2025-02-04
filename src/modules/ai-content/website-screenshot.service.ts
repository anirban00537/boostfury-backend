import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { OpenAIService } from './openai.service';

@Injectable()
export class WebsiteScreenshotService {
  private readonly logger = new Logger(WebsiteScreenshotService.name);
  private readonly tempDir = path.join(process.cwd(), 'temp');

  constructor(
    private readonly configService: ConfigService,
    private readonly openAIService: OpenAIService,
  ) {
    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async captureWebsiteScreenshot(url: string): Promise<string> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(url, { waitUntil: 'networkidle0' });

      // Generate a unique filename
      const timestamp = Date.now();
      const screenshotPath = path.join(this.tempDir, `screenshot_${timestamp}.png`);
      
      // Take screenshot of the full page
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
      });

      return screenshotPath;
    } catch (error) {
      this.logger.error(`Error capturing screenshot: ${error.message}`);
      throw error;
    } finally {
      await browser.close();
    }
  }

  async generateContentFromScreenshot(
    screenshotPath: string,
    prompt?: string,
  ): Promise<string> {
    try {
      const imageBase64 = fs.readFileSync(screenshotPath, { encoding: 'base64' });
      const content = await this.openAIService.generateContentFromScreenshot(imageBase64, prompt);

      // Clean up the screenshot file
      fs.unlinkSync(screenshotPath);

      return content;
    } catch (error) {
      this.logger.error(`Error generating content from screenshot: ${error.message}`);
      // Clean up the screenshot file even if there's an error
      if (fs.existsSync(screenshotPath)) {
        fs.unlinkSync(screenshotPath);
      }
      throw error;
    }
  }

  async generateLinkedInPostFromWebsite(
    url: string,
    customPrompt?: string,
  ): Promise<string> {
    try {
      // Capture screenshot
      const screenshotPath = await this.captureWebsiteScreenshot(url);

      // Generate content using Vision API
      const content = await this.generateContentFromScreenshot(
        screenshotPath,
        customPrompt,
      );

      return content;
    } catch (error) {
      this.logger.error(`Error generating LinkedIn post from website: ${error.message}`);
      throw error;
    }
  }
}
