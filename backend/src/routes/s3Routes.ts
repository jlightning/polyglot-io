import { Router, Request, Response } from 'express';
import { S3Service } from '../services/s3Service';

const router = Router();

// Upload file to S3
router.post('/upload-file', async (req: Request, res: Response) => {
  try {
    const { fileName, fileType } = req.body;

    if (!fileName || !fileType) {
      return res.status(400).json({
        success: false,
        message: 'fileName and fileType are required',
      });
    }

    // Validate file type - only images, text files, and SRT files allowed
    const allowedTypes = [
      // Images
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',

      // Lesson files - only text and subtitles
      'text/plain', // .txt files
      'application/x-subrip', // .srt files
    ];

    if (!allowedTypes.includes(fileType)) {
      return res.status(400).json({
        success: false,
        message: `Unsupported file type: ${fileType}. Only images (JPEG, PNG, GIF, WebP, SVG) and lesson files (TXT, SRT) are allowed.`,
        allowedTypes,
      });
    }

    // Validate file size based on type
    let maxSize: number;
    if (fileType.startsWith('image/')) {
      maxSize = 10 * 1024 * 1024; // 10MB for images
    } else if (
      fileType === 'text/plain' ||
      fileType === 'application/x-subrip'
    ) {
      maxSize = 5 * 1024 * 1024; // 5MB for text and subtitle files
    } else {
      maxSize = 5 * 1024 * 1024; // 5MB default
    }

    const result = await S3Service.getUploadUrl(
      fileName,
      fileType,
      req.userId!,
      maxSize
    );

    return res.json({
      success: true,
      uploadUrl: result.uploadUrl,
      key: result.key,
      maxSize,
      message: 'Upload URL generated successfully',
    });
  } catch (error) {
    console.error('Get upload URL error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate upload URL',
    });
  }
});

export default router;
