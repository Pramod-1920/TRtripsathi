import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Model } from 'mongoose';
import { AuditEvent } from './audit-event.schema';

const LOG_DIR = path.join(process.cwd(), 'logs');
const AUDIT_LOG = path.join(LOG_DIR, 'audit.log');

@Injectable()
export class AuditService implements OnModuleInit {
  private s3Client: any = null;
  private PutObjectCommand: any = null;
  private bucket: string | null = null;

  constructor(
    @InjectModel(AuditEvent.name)
    private readonly auditModel: Model<AuditEvent>,
  ) {
    try {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    } catch {}
    const bucket = process.env.AUDIT_S3_BUCKET?.trim();
    const region = process.env.AWS_REGION?.trim();
    if (bucket && region) {
      try {
        const s3pkg = require('@aws-sdk/client-s3');
        this.bucket = bucket;
        this.PutObjectCommand = s3pkg.PutObjectCommand;
        this.s3Client = new s3pkg.S3Client({ region });
      } catch {
        this.s3Client = null;
        this.bucket = null;
      }
    }
  }

  async onModuleInit() {
    try {
      const lines = (await fs.promises.readFile(AUDIT_LOG, 'utf8'))
        .split(/\r?\n/)
        .filter(Boolean);
      const operations = lines.flatMap((line) => {
        try {
          const event = JSON.parse(line) as Record<string, unknown>;
          const normalized = this.normalize(
            event,
            crypto.createHash('sha256').update(line).digest('hex'),
          );
          return [
            {
              updateOne: {
                filter: { eventId: normalized.eventId },
                update: { $setOnInsert: normalized },
                upsert: true,
              },
            },
          ];
        } catch {
          return [];
        }
      });
      if (operations.length)
        await this.auditModel.bulkWrite(operations, { ordered: false });
    } catch {
      /* A new installation has no legacy audit file. */
    }
  }

  async logEvent(event: Record<string, unknown>) {
    const payload = {
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...event,
    };
    try {
      await this.auditModel.create(this.normalize(payload));
    } catch {}
    try {
      await fs.promises.appendFile(
        AUDIT_LOG,
        `${JSON.stringify(payload)}\n`,
        'utf8',
      );
    } catch {}

    if (this.s3Client && this.bucket && this.PutObjectCommand) {
      try {
        const date = String(payload.timestamp).slice(0, 10);
        await this.s3Client.send(
          new this.PutObjectCommand({
            Bucket: this.bucket,
            Key: `audit/${date}/${payload.eventId}.json`,
            Body: JSON.stringify(payload),
            ContentType: 'application/json',
          }),
        );
      } catch {
        /* Mongo and local JSONL remain available. */
      }
    }
  }

  async listEvents(options: { page?: number; limit?: number; type?: string }) {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 50));
    try {
      const escaped = options.type?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const filter = escaped ? { type: { $regex: `^${escaped}` } } : {};
      const [records, total] = await Promise.all([
        this.auditModel
          .find(filter)
          .sort({ timestamp: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        this.auditModel.countDocuments(filter),
      ]);
      return {
        items: records.map((record) => ({
          eventId: record.eventId,
          timestamp: record.timestamp,
          type: record.type,
          actorId: record.actorId,
          ...(record.details ?? {}),
        })),
        total,
        page,
        limit,
      };
    } catch {
      return this.listFileEvents(page, limit, options.type);
    }
  }

  private normalize(event: Record<string, unknown>, fallbackId?: string) {
    const { eventId, timestamp, type, actorId, adminId, userId, ...details } =
      event;
    return {
      eventId: String(eventId ?? fallbackId ?? crypto.randomUUID()),
      type: String(type ?? 'unknown'),
      actorId: String(actorId ?? adminId ?? userId ?? '') || undefined,
      details,
      timestamp: new Date(String(timestamp ?? new Date().toISOString())),
    };
  }

  private async listFileEvents(page: number, limit: number, type?: string) {
    let lines: string[] = [];
    try {
      lines = (await fs.promises.readFile(AUDIT_LOG, 'utf8'))
        .split(/\r?\n/)
        .filter(Boolean);
    } catch {}
    const events = lines
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as Record<string, unknown>];
        } catch {
          return [];
        }
      })
      .filter((event) => !type || String(event.type ?? '').startsWith(type))
      .reverse();
    const start = (page - 1) * limit;
    return {
      items: events.slice(start, start + limit),
      total: events.length,
      page,
      limit,
    };
  }
}
