import { LoggerService } from '@nestjs/common';
import { inspect } from 'node:util';

type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose' | 'fatal';
const sensitiveKey = /password|token|secret|authorization|cookie|otp/i;

function safeValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => safeValue(item, seen));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      sensitiveKey.test(key) ? '[REDACTED]' : safeValue(item, seen),
    ]),
  );
}

export class StructuredLogger implements LoggerService {
  log(message: unknown, ...params: unknown[]) {
    this.write('log', message, params);
  }
  error(message: unknown, ...params: unknown[]) {
    this.write('error', message, params);
  }
  warn(message: unknown, ...params: unknown[]) {
    this.write('warn', message, params);
  }
  debug(message: unknown, ...params: unknown[]) {
    this.write('debug', message, params);
  }
  verbose(message: unknown, ...params: unknown[]) {
    this.write('verbose', message, params);
  }
  fatal(message: unknown, ...params: unknown[]) {
    this.write('fatal', message, params);
  }

  private write(level: LogLevel, message: unknown, params: unknown[]) {
    const values = [...params];
    const context =
      typeof values.at(-1) === 'string' ? String(values.pop()) : 'Application';
    const stack =
      (level === 'error' || level === 'fatal') && typeof values[0] === 'string'
        ? String(values.shift())
        : undefined;
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message:
        typeof message === 'string'
          ? message.replace(/\u001b\[[0-9;]*m/g, '')
          : safeValue(message),
      ...(values.length ? { metadata: safeValue(values) } : {}),
      ...(stack ? { stack: stack.replace(/\u001b\[[0-9;]*m/g, '') } : {}),
      pid: process.pid,
    };
    const stream =
      level === 'error' || level === 'fatal' ? process.stderr : process.stdout;
    try {
      stream.write(`${JSON.stringify(payload)}\n`);
    } catch {
      process.stderr.write(`${inspect(payload)}\n`);
    }
  }
}
