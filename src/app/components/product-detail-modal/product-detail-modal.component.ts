import { Component, HostListener, computed, inject, input, output, signal } from '@angular/core';
import { IonIcon, ToastController } from '@ionic/angular';
import { addOutline, closeOutline, removeOutline, star } from 'ionicons/icons';
import { CartService } from '../../services/cart.service';
import { LOW_STOCK_THRESHOLD, Product } from '../../services/products.service';

/** Bottom sheet with full product details and a quantity + add-to-cart footer. */
@Component({
  selector: 'app-product-detail-modal',
  imports: [IonIcon],
  templateUrl: './product-detail-modal.component.html',
})
export class ProductDetailModalComponent {
  private readonly cart = inject(CartService);
  private readonly toast = inject(ToastController);

  readonly product = input.required<Product>();
  readonly dismiss = output<void>();

  readonly qty = signal(1);
  readonly adding = signal(false);

  readonly closeIcon = closeOutline;
  readonly addIcon = addOutline;
  readonly removeIcon = removeOutline;
  readonly starIcon = star;

  readonly maxQty = computed(() => Math.max(0, Number(this.product().stock_quantity) || 0));
  readonly soldOut = computed(() => this.maxQty() === 0);
  readonly lowStock = computed(() => this.maxQty() > 0 && this.maxQty() <= LOW_STOCK_THRESHOLD);
  readonly rating = computed(() => Number(this.product().rating) || 0);
  readonly unitPrice = computed(() => this.format(this.product().price));
  readonly lineTotal = computed(() => this.format((Number(this.product().price) || 0) * this.qty()));

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.dismiss.emit();
  }

  increase(): void {
    this.qty.update((q) => Math.min(q + 1, this.maxQty()));
  }

  decrease(): void {
    this.qty.update((q) => Math.max(1, q - 1));
  }

  async addToCart(): Promise<void> {
    if (this.adding() || this.soldOut()) return;
    this.adding.set(true);
    const result = await this.cart.addToCart(this.product(), this.qty());
    this.adding.set(false);

    if (result.success) {
      this.dismiss.emit(); // the cart bar confirms it
      return;
    }
    const t = await this.toast.create({
      message: result.message || 'Could not add to cart',
      duration: 2200,
      position: 'top',
      color: 'danger',
    });
    await t.present();
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.onerror = null;
    img.src = 'logo.jpg';
    img.classList.add('bk-sheet__fallback');
  }

  private format(n: number): string {
    return `₱${(Number(n) || 0).toFixed(2)}`;
  }
}
