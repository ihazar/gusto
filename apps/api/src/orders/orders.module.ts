import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AcceptTimeoutQueue } from './accept-timeout.queue';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { MockPaymentProvider, PAYMENT_PROVIDER } from './payment.provider';

@Module({
    imports: [AuthModule],
    controllers: [OrdersController],
    providers: [
        OrdersService,
        AcceptTimeoutQueue,
        MockPaymentProvider,
        { provide: PAYMENT_PROVIDER, useExisting: MockPaymentProvider },
    ],
    exports: [OrdersService],
})
export class OrdersModule {}
