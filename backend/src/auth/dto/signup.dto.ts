import { IsEmail, IsString, Matches, MinLength } from "class-validator";
import { Matches } from 'class-validator';

export class SignupDto {
    @IsString()
    name!: string;
    
    @IsEmail()
    email!: string;

    @Matches(/^\d{10}$/, { message: 'Phone number must be exactly 10 digits' })
    phoneNumber!: string;

    @IsString()
    @MinLength(6)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/, {
        message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    })
    password!: string;
}