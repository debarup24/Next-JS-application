import dbConnect from "@/lib/dbConnect";
import UserModel from "@/model/User";
import bcrypt from "bcryptjs";
import { sendVerificationEmail } from "@/helpers/sendVerificationEmail";
import { success } from "zod";
import { messageSchema } from "@/schemas/messageSchema";

export async function POST(request: Request) {
  //connect database
  await dbConnect();

  try {
    //whenever you're taking data from 'req.json' you have to use await
    const { username, email, password } = await request.json();

    //Check: if username is already exist & already verified
    const existingUserVerifiedByUsername = await UserModel.findOne({
      username,
      isVerified: true,
    });

    if (existingUserVerifiedByUsername) {
      return Response.json(
        {
          success: false,
          message: "Username is alreay taken",
        },
        { status: 400 }
      );
    }

    //Check: if username is already exist & already verified
    const existingUserByEmail = await UserModel.findOne({ email });

    const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();

    if (existingUserByEmail) {
      if (existingUserByEmail.isVerified) {
        return Response.json(
          {
            success: false,
            message: "User is alreay exist with this Email",
          },
          { status: 400 }
        );
      } else {
        const hashedPassword = await bcrypt.hash(password, 10);
        existingUserByEmail.password = hashedPassword;
        existingUserByEmail.verifyCode = verifyCode;
        existingUserByEmail.verifyCodeExpiry = new Date(Date.now() + 3600000);
        // Save the user -
        await existingUserByEmail.save();
      }
    } else {
      // means new user
      const hashedPassword = await bcrypt.hash(password, 10);

      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + 1);

      const newUser = new UserModel({
        username,
        email,
        password: hashedPassword,
        verifyCode,
        verifyCodeExpiry: expiryDate,
        isVerified: false,
        isAcceptingMessages: true,
        messages: [],
      });

      await newUser.save();
    }

    // Send Verification Email
    const emailResponse = await sendVerificationEmail(
      email,
      username,
      verifyCode
    );

    if (!emailResponse.success) {
      return Response.json(
        { success: false, message: emailResponse.message },
        { status: 500 }
      );
    }
    return Response.json(
      {
        success: true,
        message: "User successfully registered. Please verify your email",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error registering users!", error); // this response will be shown on terminal
    // this json response will be shown on frontend
    return Response.json(
      {
        success: false,
        message: "Error registering users!",
      },
      {
        status: 500,
      }
    );
  }
}
