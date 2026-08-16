import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto';

describe('LoginDto', () => {
  const validationOptions = {
    whitelist: true,
    forbidNonWhitelisted: true,
  };

  it('accepts and normalizes a Nepal phone number', async () => {
    const dto = plainToInstance(LoginDto, {
      phoneNumber: '+977 984-123-4567',
      password: 'Password@123',
    });

    await expect(validate(dto, validationOptions)).resolves.toHaveLength(0);
    expect(dto.phoneNumber).toBe('9841234567');
  });

  it('rejects email-only login payloads', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'traveller@example.com',
      password: 'Password@123',
    });
    const errors = await validate(dto, validationOptions);

    expect(errors.some((error) => error.property === 'email')).toBe(true);
    expect(errors.some((error) => error.property === 'phoneNumber')).toBe(true);
  });
});
