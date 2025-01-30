import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { exec } from 'child_process';
import { promisify } from 'util';
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);
const PG_DUMP_PATH = '/usr/bin/pg_dump';

@Injectable()
export class DatabaseBackupCronService {
  private readonly s3Client: S3Client;
  private readonly BACKUP_PREFIX = 'database-backups/';
  private readonly MAX_BACKUPS = 3;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  @Cron('* * * * *')  // Run every minute
  async handleDatabaseBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `backup-${timestamp}.sql.gz`;  // Using .gz extension for compressed file
    const backupPath = path.join(process.cwd(), 'temp', backupFileName);
    
    // Enhanced pg_dump command with proper options
    const dumpCommand = [
      PG_DUMP_PATH,
      '--dbname=postgresql://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}',
      '--format=plain',           // Plain text format
      '--no-owner',              // Don't include ownership commands
      '--no-acl',               // Don't include access control commands
      '--no-comments',          // Don't include comments
      '--compress=9',           // Maximum compression
      '--verbose',              // Show detailed progress
      '--file=${backupPath}'    // Output file
    ].join(' ');

    try {
      console.log('\n[Database Backup] Starting backup process...');
      console.log('[Database Backup] Creating backup file:', backupFileName);
      
      // Ensure temp directory exists
      if (!fs.existsSync(path.join(process.cwd(), 'temp'))) {
        fs.mkdirSync(path.join(process.cwd(), 'temp'), { recursive: true });
      }

      // Create backup using pg_dump
      console.log('[Database Backup] Running pg_dump command...');
      const { stdout, stderr } = await execAsync(dumpCommand, {
        env: {
          ...process.env,
          PGPASSWORD: process.env.DB_PASSWORD,
          PGUSER: process.env.DB_USERNAME,
          PGHOST: process.env.DB_HOST,
          PGPORT: process.env.DB_PORT,
          PGDATABASE: process.env.DB_NAME,
        },
        maxBuffer: 50 * 1024 * 1024  // 50MB buffer for large databases
      });

      if (stdout) {
        console.log('[Database Backup] pg_dump output:', stdout);
      }

      if (stderr && !stderr.includes('warning')) {
        throw new Error(`pg_dump stderr: ${stderr}`);
      }

      // Verify backup file exists and has content
      if (!fs.existsSync(backupPath) || fs.statSync(backupPath).size === 0) {
        throw new Error('Backup file is empty or was not created');
      }

      // Upload to S3
      console.log('[Database Backup] Uploading to S3...');
      const fileStream = fs.createReadStream(backupPath);
      const uploadParams = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: `${this.BACKUP_PREFIX}${backupFileName}`,
        Body: await streamToBuffer(fileStream),
        ContentType: 'application/gzip',
        ContentEncoding: 'gzip'
      };

      await this.s3Client.send(new PutObjectCommand(uploadParams));

      // Clean up local backup file
      fs.unlinkSync(backupPath);

      // Clean up old backups
      await this.cleanupOldBackups();

      console.log(`[Database Backup] Backup completed successfully: ${backupFileName}`);
    } catch (error) {
      console.error('\n[Database Backup] Backup failed:');
      console.error({
        error: error.message,
        stack: error.stack,
        command: dumpCommand.replace(process.env.DB_PASSWORD, '****'),  // Hide password in logs
        timestamp: new Date().toISOString(),
        path: backupPath,
        envVars: {
          DB_USERNAME: process.env.DB_USERNAME,
          DB_HOST: process.env.DB_HOST,
          DB_PORT: process.env.DB_PORT,
          DB_NAME: process.env.DB_NAME,
          AWS_REGION: process.env.AWS_REGION,
          AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME,
        }
      });

      // Cleanup any leftover temp file if it exists
      if (fs.existsSync(backupPath)) {
        try {
          fs.unlinkSync(backupPath);
          console.log('[Database Backup] Cleaned up temporary backup file');
        } catch (cleanupError) {
          console.error('[Database Backup] Failed to cleanup temp backup file:', cleanupError);
        }
      }
    }
  }

  private async cleanupOldBackups() {
    try {
      console.log('[Database Backup] Checking for old backups to clean up...');
      const listCommand = new ListObjectsV2Command({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Prefix: this.BACKUP_PREFIX,
      });

      const response = await this.s3Client.send(listCommand);
      if (!response.Contents) return;

      // Sort backups by date (newest first)
      const sortedBackups = response.Contents
        .sort((a, b) => (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0));

      // Keep only the last MAX_BACKUPS number of backups
      const backupsToDelete = sortedBackups.slice(this.MAX_BACKUPS);

      // Delete old backups
      for (const backup of backupsToDelete) {
        if (backup.Key) {
          await this.s3Client.send(
            new DeleteObjectCommand({
              Bucket: process.env.AWS_S3_BUCKET_NAME,
              Key: backup.Key,
            })
          );
          console.log(`[Database Backup] Deleted old backup: ${backup.Key}`);
        }
      }
    } catch (error) {
      console.error('[Database Backup] Failed to cleanup old backups:', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    }
  }
}

// Helper function to convert stream to buffer
async function streamToBuffer(stream: fs.ReadStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
