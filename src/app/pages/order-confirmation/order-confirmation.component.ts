import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent, IonHeader, IonMenuButton, IonTitle, IonToolbar } from '@ionic/angular';
import {
  OrderWithItems,
  OrdersService,
  PAYMENT_LABEL,
  STATUS_BADGE,
  STATUS_FLOW_DELIVERY,
  STATUS_FLOW_PICKUP,
  STATUS_LABEL,
  toErrorMessage,
} from '../../services/orders.service';

@Component({
  selector: 'app-order-confirmation',
  imports: [
    RouterLink,
    IonContent,
    IonHeader,
    IonMenuButton,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './order-confirmation.component.html',
})
export class OrderConfirmationComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly orders = inject(OrdersService);

  readonly order = signal<OrderWithItems | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly orderNumber = computed(() => {
    const o = this.order();
    return o ? o.id.replace(/-/g, '').slice(0, 10).toUpperCase() : '--------';
  });

  /** Progress steps for the tracker (empty for cancelled orders). */
  readonly steps = computed(() => {
    const o = this.order();
    if (!o || o.status === 'cancelled') return [];
    const flow = o.fulfillment_type === 'pickup' ? STATUS_FLOW_PICKUP : STATUS_FLOW_DELIVERY;
    const index = flow.indexOf(o.status);
    return flow.map((status, i) => ({ label: STATUS_LABEL[status], done: i <= index, current: i === index }));
  });

  private readonly orderId = this.route.snapshot.paramMap.get('id');
  private readonly unsubscribe: (() => void) | null;

  constructor() {
    if (this.orderId) void this.load(this.orderId);
    else this.error.set('Order reference missing.');

    // Keep the tracker live while staff move the order along.
    this.unsubscribe = this.orders.subscribeToOrders(() => {
      if (!this.orderId) return;
      this.orders.getOrder(this.orderId).then((o) => this.order.set(o)).catch(() => undefined);
    });
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const order = await this.orders.getOrder(id);
      this.order.set(order);
      // Print is intentionally manual — the button in the template calls
      // printReceipt(). Auto-firing window.print() was removed because
      // browsers may block it and it fires on every navigation to this page.
    } catch (err) {
      this.error.set(toErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  printReceipt(): void {
    window.print();
  }

  formatPrice(n: number): string {
    return `₱${(Number(n) || 0).toFixed(2)}`;
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  coordinates(): string {
    const o = this.order();
    return o?.latitude != null && o?.longitude != null
      ? `${o.latitude.toFixed(5)}, ${o.longitude.toFixed(5)}`
      : '—';
  }

  mapUrl(): string {
    const o = this.order();
    return o ? (this.orders.mapUrl(o) ?? '') : '';
  }

  readonly statusLabel = STATUS_LABEL;
  readonly statusBadge = STATUS_BADGE;
  readonly paymentLabel = PAYMENT_LABEL;
}