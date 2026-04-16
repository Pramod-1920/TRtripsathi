import { Inject, Injectable } from '@nestjs/common';
import { SignupDto } from './dto/signup.dto';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Auth } from './schemas/auth.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {

  constructor(@InjectModel(Auth.name) private UserModel: Model<Auth>) {}
  async create(signupData: SignupDto) {
    const { name, email, phoneNumber, password } = signupData;
    
  //check if email is in use
  const emailInUse = await this.UserModel.findOne({ email: email });
  if (emailInUse) {
    throw new Error('Email is already in use');
  }

  //CHeck the phone number is in use
  const numberInUse = await this.UserModel.findOne({ phoneNumber: phoneNumber });
  if (numberInUse) {
    throw new Error('Phone number is already in use');
  }

  //Hash the password

  const hashedPassword = await bcrypt.hash(password, 10);

  //TODO: save the user in the database

  await this.UserModel.create({
    name,
    email,
    phoneNumber,
    password: hashedPassword,
  });

  }
}
