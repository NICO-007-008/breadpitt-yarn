import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { arrowBackOutline, arrowForwardOutline, closeCircleOutline } from 'ionicons/icons';
import { OrdersService } from '../../services/orders.service';
import { PaymentService } from '../../services/payment.service';

@Component({
  selector: 'app-payment-cancelled',
  imports: [
    RouterLink,
    IonContent,
    IonHeader,
    IonIcon,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './payment-cancelled.component.html',
})
export class PaymentCancelledComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly orders = inject(OrdersService);
  private readonly payment = inject(PaymentService);

  /** 'working' while we release the order, then what happened to it. */
  readonly outcome = signal<'working' | 'released' | 'paid' | 'unknown'>('working');

  readonly orderId = signal<string | null>(null);

  readonly closeCircle = closeCircleOutline;
  readonly arrowBack = arrowBackOutline;
  readonly arrowForward = arrowForwardOutline;

  constructor() {
    const id = this.route.snapshot.queryParamMap.get('order_id');
    if (id) {
      this.orderId.set(id);
      void this.releaseOrder(id);
    } else {
      this.outcome.set('unknown');
    }
  }

  /**
   * The customer backed out of PayMongo. Cancel the unpaid order so its stock and
   * voucher are released (the cart is untouched), instead of leaving a pending
   * order behind that a second checkout would duplicate.
   */
  private async releaseOrder(orderId: string): Promise<void> {
    try {
      const status = await this.payment.checkPaymentStatus(orderId);
      if (status?.payment_status === 'paid') {
        this.outcome.set('paid'); // the payment actually went through
        return;
      }
      await this.orders.cancelMyOrder(orderId);
      this.outcome.set('released');
    } catch {
      this.outcome.set('unknown'); // already cancelled, or no longer pending
    }
  }
}