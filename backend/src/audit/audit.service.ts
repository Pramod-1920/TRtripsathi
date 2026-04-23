import { Injectable } from '@nestjs/common';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
// AWS S3 SDK is optional for audit shipping. We'll require it dynamically at runtime
// to avoid build-time dependency errors when the package is not installed.

const LOG_DIR = path.join(process.cwd(), 'logs');
const AUDIT_LOG = path.join(LOG_DIR, 'audit.log');

@Injectable()
export class AuditService {
  // optional S3 client (dynamic require), keep as any to avoid strict typing when missing
  private s3Client: any = null;
  private PutObjectCommand: any = null;
  private bucket: string | null = null;

  constructor() {
    try {
      if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    } catch {
      // best-effort
    }

    const bucket = process.env.AUDIT_S3_BUCKET?.trim();
    const region = process.env.AWS_REGION?.trim();
    if (bucket && region) {
      try {
        // attempt dynamic require so the project can build without @aws-sdk/client-s3
        // installed; if it's missing we silently fallback to local file logging

        const s3pkg = require('@aws-sdk/client-s3');
        this.bucket = bucket;
        this.PutObjectCommand = s3pkg.PutObjectCommand;
        this.s3Client = new s3pkg.S3Client({ region });
      } catch (e) {
        // best-effort; fallback to local file
        this.s3Client = null;
        this.bucket = null;
      }
    }
  }

  async logEvent(event: Record<string, unknown>) {
    const payload = { timestamp: new Date().toISOString(), ...event };
    const line = JSON.stringify(payload);

    // write locally (best-effort backup)
    try {
      await fs.promises.appendFile(AUDIT_LOG, line + '\n', 'utf8');
    } catch {
      // swallow — local write is best-effort
    }

    // If S3 configured, upload each event as an individual object for immutability and audit search
    if (this.s3Client && this.bucket && this.PutObjectCommand) {
      try {
        const date = new Date().toISOString().slice(0, 10);
        const key = `audit/${date}/${Date.now()}-${crypto.randomUUID()}.json`;
        const cmd = new this.PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: JSON.stringify(payload),
          ContentType: 'application/json',
        });

        // fire-and-forget but await to surface errors in this process
        await this.s3Client.send(cmd);
      } catch {
        // if upload fails, we silently fallback to local log. In production, consider a retry or DLQ.
      }
    }
  }
}
