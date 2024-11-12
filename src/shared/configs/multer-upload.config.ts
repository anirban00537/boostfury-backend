import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage } from 'multer';
import path from 'path';
import fs from 'fs'; // Import the 'fs' module for file system operations
import { coreConstant } from '../helpers/coreConstant';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

/** Constant containing a Regular Expression
 * with the valid image upload types
 */
export const validImageUploadTypesRegex = /jpeg|jpg|png|pdf/;

/** Constant that sets the maximum image upload file size */
export const maxImageUploadSize = 7 * 1024 * 1024; // 7MB

// Create the upload directory if it doesn't exist
const uploadDirectory = path.resolve(
  process.cwd(),
  coreConstant.FILE_DESTINATION,
);
fs.mkdirSync(uploadDirectory, { recursive: true });

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/** Configurations for the multer library used for file upload.
 *
 * Accepts types jpeg, jpg, and png of size up to 3MB
 */
export const multerUploadConfig: MulterOptions = {
  fileFilter: (request, file, callback) => {
    const mimetype = validImageUploadTypesRegex.test(file.mimetype);
    const extname = validImageUploadTypesRegex.test(
      path.extname(file.originalname).toLowerCase(),
    );

    if (mimetype && extname) {
      return callback(null, true);
    }
    callback(new Error('Invalid file type'), false);
  },

  limits: {
    fileSize: maxImageUploadSize,
  },
};

export const uploadFile = async (
  file: Express.Multer.File,
  userId: number,
): Promise<string | null> => {
  if (!file || !file.buffer) {
    console.warn('No file or file buffer provided for upload');
    return null;
  }

  const fileExtension = file.originalname.split('.').pop();
  const key = `${userId}/${uuidv4()}.${fileExtension}`;

  try {
    console.log('Attempting to upload to S3:', key);

    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );

    // Generate a non-expiring URL for the uploaded object
    const url = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    console.log('File uploaded successfully to S3. URL:', url);
    return url;
  } catch (error) {
    console.error('Detailed S3 upload error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    // Log AWS-specific error details if available
    if ('name' in error && 'code' in error && '$metadata' in error) {
      console.error('AWS Error Name:', error.name);
      console.error('AWS Error Code:', error.code);
      console.error('AWS Error Metadata:', error.$metadata);
    }
    return null;
  }
};

export const deleteFileFromS3 = async (url: string): Promise<void> => {
  try {
    const key = new URL(url).pathname.slice(1); // Remove leading '/'
    console.log('Attempting to delete file from S3:', key);

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: key,
      }),
    );

    console.log('File successfully deleted from S3');
  } catch (error) {
    console.error('Error deleting file from S3:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    // We're not throwing the error here to allow the process to continue
  }
};
