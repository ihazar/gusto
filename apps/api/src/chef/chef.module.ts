import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';
import { ChefController } from './chef.controller';
import { ChefService } from './chef.service';

@Module({
    imports: [AuthModule, OrdersModule],
    controllers: [ChefController],
    providers: [ChefService],
})
export class ChefModule {}
