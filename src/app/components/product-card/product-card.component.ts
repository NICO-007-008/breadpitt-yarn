import { Component, computed, inject, input, output, signal } from '@angular/core';
import { IonIcon, ToastController } from '@ionic/angular';
import { addOutline, checkmarkOutline, star } from 'ionicons/icons';
import { CartService } from '../../services/cart.service';
import { LOW_STOCK_THRESHOLD, Product } from '../../services/products.service';

/**
 * One product tile, used on Home (horizontal rail) and Shop (grid).
 * The whole card opens the detail sheet; the round button adds one to the cart.
 */
@Component({
  selector: 'app-product-card',
  imports: [IonIcon],
  templateUrl: './product-card.component.html',
})
export class ProductCardComponent {
  private readonly cart = inject(CartService);
  private readonly toast = inject(ToastController);

  readonly product = input.required<Product>();
  /** Fixed-width variant for horizontal rails. */
  readonly rail = input(false);
  /** Emitted when the card body is tapped. */
  readonly view = output<Product>();

  readonly added = signal(false);

  readonly addIcon = addOutline;
  readonly doneIcon = checkmarkOutline;
  readonly starIcon = star;

  private readonly stock = computed(() => Number(this.product().stock_quantity) || 0);
  readonly soldOut = computed(() => this.stock() === 0);
  readonly lowStock = computed(() => this.stock() > 0 && this.stock() <= LOW_STOCK_THRESHOLD);
  readonly rating = computed(() => Number(this.product().rating) || 0);
  /** Illustrated stand-in used when a product has no photo. */
  readonly artSrc = computed(() => {
    const c = (this.product().category || '').toLowerCase();
    const kind = c.includes('pastr') ? 'croissant' : c.includes('cake') ? 'cake' : c.includes('cookie') ? 'cookie' : c.includes('muffin') ? 'muffin' : 'boule';
    return `art/${kind}.svg`;
  });
  readonly price = computed(() => `₱${(Number(this.product().price) || 0).toFixed(2)}`);

  async add(event: Event): Promise<void> {
    event.stopPropagation();
    if (this.soldOut()) return;

    const result = await this.cart.addToCart(this.product());
    if (result.success) {
      // The cart bar bumping + the check mark is the confirmation; no toast needed.
      this.added.set(true);
      setTimeout(() => this.added.set(false), 1200);
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
    img.onerror = null; // avoid a loop if the fallback is missing too
    img.src = this.artSrc();
    img.classList.add('bk-pcard__fallback');
  }
}
