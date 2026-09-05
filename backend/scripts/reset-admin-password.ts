import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { createHmac } from 'node:crypto';
import mongoose from 'mongoose';

const MIN_PASSWORD_LENGTH = 12;

function readHidden(prompt: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('This command must be run in an interactive terminal.');
  }

  return new Promise((resolve, reject) => {
    let value = '';
    const stdin = process.stdin;

    const finish = (error?: Error) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };

    const onData = (data: Buffer) => {
      for (const byte of data) {
        if (byte === 3) return finish(new Error('Password reset cancelled.'));
        if (byte === 13 || byte === 10) return finish();
        if (byte === 8 || byte === 127) {
          if (value.length > 0) value = value.slice(0, -1);
          continue;
        }
        if (byte >= 32) value += String.fromCharCode(byte);
      }
    };

    process.stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

async function main() {
  const mongoUri = process.env.MONGODB_URI?.trim();
  if (!mongoUri) throw new Error('MONGODB_URI is required in .env');

  const password = await readHidden('New admin password (input hidden): ');
  const confirmation = await readHidden('Confirm new password (input hidden): ');
  if (password !== confirmation) throw new Error('Passwords do not match.');
  if (password.length < MIN_PASSWORD_LENGTH || password.length > 128) {
    throw new Error('Password must be between 12 and 128 characters.');
  }

  await mongoose.connect(mongoUri);
  const collection = mongoose.connection.db!.collection('auths');
  const admins = await collection
    .find({ role: { $in: ['admin', 'super_admin'] }, isActive: { $ne: false } })
    .project({ _id: 1 })
    .toArray();

  if (admins.length !== 1) {
    throw new Error(`Expected exactly one active admin account; found ${admins.length}.`);
  }

  const pepper = process.env.PASSWORD_PEPPER?.trim() ?? '';
  const material = pepper
    ? createHmac('sha384', pepper).update(password, 'utf8').digest('base64')
    : password;
  const configuredRounds = Number(process.env.PASSWORD_BCRYPT_ROUNDS ?? 12);
  const rounds =
    Number.isInteger(configuredRounds) && configuredRounds >= 10 && configuredRounds <= 15
      ? configuredRounds
      : 12;

  await collection.updateOne(
    { _id: admins[0]._id },
    {
      $set: {
        password: await bcrypt.hash(material, rounds),
        failedLoginAttempts: 0,
        lockUntil: null,
        refreshTokenHash: null,
        refreshTokens: [],
      },
    },
  );

  console.log('Admin password reset successfully. Existing sessions were revoked.');
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
