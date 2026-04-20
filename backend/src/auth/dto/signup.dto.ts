import { IsEmail, IsString, Matches, MinLength } from "class-validator";import { ApiProperty } from '@nestjs/swagger';
export class SignupDto {
    @ApiProperty({ example: 'John Doe', description: 'User full name' })
    @IsString()
    name!: string;
    
    @ApiProperty({ example: 'john@example.com', description: 'User email address' })
    @IsEmail()
    email!: string;

    @ApiProperty({ example: '9876543210', description: 'User phone number (10 digits)' })
    @Matches(/^\d{10}$/, { message: 'Phone number must be exactly 10 digits' })
    phoneNumber!: string;

    @ApiProperty({ 
        example: 'Password@123', 
        description: 'Password with uppercase, lowercase, number and special character' 
    })
    @IsString()
    @MinLength(6)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/, {
        message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    })
    password!: string;
}