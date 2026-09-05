import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SignupDto } from './signup.dto';

describe('SignupDto', () => {
  const validationOptions = {
    whitelist: true,
    forbidNonWhitelisted: true,
  };

  it('accepts complete account details and normalizes a Nepal phone', async () => {
    const dto = plainToInstance(SignupDto, {
      firstName: 'Asha',
      middleName: 'Maya',
      lastName: 'Rai',
      email: 'asha@example.com',
      phoneNumber: '+977 984-123-4567',
      password: 'StrongPassword@123',
      address: 'Kathmandu',
      gender: 'female',
      dateOfBirth: '2000-01-15',
    });

    await expect(validate(dto, validationOptions)).resolves.toHaveLength(0);
    expect(dto.phoneNumber).toBe('9841234567');
  });

  it('rejects malformed account details and short passwords', async () => {
    const dto = plainToInstance(SignupDto, {
      email: 'not-an-email',
      phoneNumber: '123',
      password: 'short',
      gender: 'invalid',
      dateOfBirth: 'not-a-date',
    });
    const errors = await validate(dto, validationOptions);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining([
        'email',
        'phoneNumber',
        'password',
        'gender',
        'dateOfBirth',
      ]),
    );
  });
});
