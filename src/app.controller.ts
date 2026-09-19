import { Public } from "./auth/decorators/public.decorator";
import { Controller, Get } from "@nestjs/common";

@Public()
@Controller('')
export class AppController {
  @Get()
  getHello(): string {
    return "I'm alive!";
  }
}