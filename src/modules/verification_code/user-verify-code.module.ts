import { Module } from "@nestjs/common";
import { UserVerificationCodeService } from "./user-verify-code.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  controllers: [],
  providers: [UserVerificationCodeService],
  imports: [PrismaModule],
  exports: [UserVerificationCodeService],
})
export class UserVerificationCodeModule {}
