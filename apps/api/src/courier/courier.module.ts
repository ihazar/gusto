import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';
import { CourierController } from './courier.controller';
import { CourierService } from './courier.service';

@Module({
    imports: [AuthModule, OrdersModule],
    controllers: [CourierController],
    providers: [CourierService],
})
export class CourierModule {}
