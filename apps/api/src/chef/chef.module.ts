import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChefController } from './chef.controller';
import { ChefService } from './chef.service';

@Module({
    imports: [AuthModule],
    controllers: [ChefController],
    providers: [ChefService],
})
export class ChefModule {}
