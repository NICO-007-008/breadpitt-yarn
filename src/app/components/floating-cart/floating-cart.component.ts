import { Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { IonIcon } from '@ionic/angular';
import { addOutline, cartOutline, closeOutline, removeOutline, trashOutline } from 'ionicons/icons';
import { CartService, CartLine } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-floating-cart',
  imports: [IonIcon],
  templateUrl: './floating-cart.component.html',
  styleUrl: './floating-cart.component.scss',
})
export class FloatingCartComponent {
  private readonly cart = inject(CartService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly isOpen = signal(false);

  readonly closeIcon = closeOutline;
  readonly cartIcon = cartOutline;
  readonly addIcon = addOutline;
  readonly removeIcon = removeOutline;
  readonly trashIcon = trashOutline;
  readonly bumpTrigger = signal(0);

  /** Route segments where the FAB should be hidden. */
  private readonly hiddenSegments = ['welcome', 'login', 'register', 'admin', 'order-oversight', 'orders', 'checkout', 'payment-success', 'payment-cancelled', 'order-confirmation'];

  /** Current URL as a signal that updates on navigation. */
  readonly currentUrl = signal('');

  constructor() {
    // Initialize with current URL
    this.currentUrl.set(this.router.url);

    // React to router navigation events for immediate updates
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event) => {
      this.currentUrl.set(event.urlAfterRedirects);
    });

    // Pages read this class to leave room for the cart bar above the bottom nav.
    effect(() =>
      document.body.classList.toggle('has-cart-bar', !this.isHidden() && this.itemCount() > 0)
    );

    // Nudge the bar whenever the item count goes up (from any screen).
    let previous = 0;
    effect(() => {
      const n = this.itemCount();
      if (n > previous) this.triggerBump();
      previous = n;
    });
  }

  /** Whether the FAB should be hidden on the current route. */
  readonly isHidden = computed(() => {
    const url = this.currentUrl();
    return this.hiddenSegments.some((segment) => url.includes(`/${segment}`));
  });

  /** Cart lines from the shared service. */
  readonly lines = this.cart.lines;

  /** Computed totals from the shared service. */
  readonly itemCount = this.cart.itemCount;
  readonly subtotal = this.cart.subtotal;
  readonly deliveryFee = this.cart.deliveryFee;
  readonly tax = this.cart.tax;
  readonly total = this.cart.total;

  /** Opens the cart sheet and triggers the bump animation. */
  onFabClick(): void {
    this.isOpen.set(true);
    this.triggerBump();
  }

  /** Closes the popover. */
  onPopoverDismiss(): void {
    this.isOpen.set(false);
  }

  /** Triggers the "bump" animation on the FAB badge. */
  private triggerBump(): void {
    this.bumpTrigger.update((n) => n + 1);
  }

  /** Increments quantity for a product. */
  async increment(productId: string): Promise<void> {
    const line = this.lines().find((l) => l.product.id === productId);
    if (!line) return;
    const max = Math.max(0, Number(line.product.stock_quantity) || 0);
    if (line.quantity >= max) return;
    await this.cart.setQuantity(productId, line.quantity + 1);
    this.triggerBump();
  }

  /** Decrements quantity for a product. */
  async decrement(productId: string): Promise<void> {
    const line = this.lines().find((l) => l.product.id === productId);
    if (!line) return;
    await this.cart.setQuantity(productId, line.quantity - 1);
  }

  /** Removes a product from the cart. */
  async remove(productId: string): Promise<void> {
    await this.cart.removeFromCart(productId);
  }

  /** Navigates to the full cart page (orders page, cart tab). */
  goToCart(): void {
    this.isOpen.set(false);
    void this.router.navigate(['/orders'], { fragment: 'cart' });
  }

  /** Navigates to checkout. */
  async goToCheckout(): Promise<void> {
    if (this.itemCount() === 0) return;
    this.isOpen.set(false);
    void this.router.navigate(['/checkout']);
  }

  /** Closes popover and navigates to bread catalog. */
  browseCatalog(): void {
    this.isOpen.set(false);
    void this.router.navigate(['/bread-catalog']);
  }

  /** Formats price as ₱X.XX */
  formatPrice(n: number): string {
    return `₱${(Number(n) || 0).toFixed(2)}`;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.isOpen.set(false);
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.onerror = null;
    img.src = 'logo.jpg';
    img.classList.add('cs__img--fallback');
  }
}
