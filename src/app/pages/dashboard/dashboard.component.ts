import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import { notificationsOutline, nutritionOutline, searchOutline } from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { NewsletterService } from '../../services/newsletter.service';
import { NotificationsService } from '../../services/notifications.service';
import { Product, ProductsService, toErrorMessage } from '../../services/products.service';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { ProductDetailModalComponent } from '../../components/product-detail-modal/product-detail-modal.component';

@Component({
  selector: 'app-dashboard',
  imports: [
    RouterLink,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonMenuButton,
    IonRefresher,
    IonRefresherContent,
    IonTitle,
    IonToolbar,
    ProductCardComponent,
    ProductDetailModalComponent,
  ],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  private readonly auth = inject(AuthService);
  private readonly productsService = inject(ProductsService);
  private readonly cart = inject(CartService);
  private readonly toast = inject(ToastController);
  private readonly newsletter = inject(NewsletterService);
  private readonly notifications = inject(NotificationsService);

  readonly bellIcon = notificationsOutline;
  readonly unreadCount = this.notifications.unreadCount;

  readonly searchIcon = searchOutline;
  readonly fallbackIcon = nutritionOutline;

  readonly products = signal<Product[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly email = signal('');
  readonly subscribed = signal(false);
  readonly featuredAdded = signal(false);

  /** Selected product to display in the detail sheet (null = closed). */
  readonly selectedProduct = signal<Product | null>(null);

  readonly greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  })();

  /** First word of the display name; empty for guests or email-style names. */
  readonly firstName = computed(() => {
    const name = (this.auth.user()?.displayName ?? '').trim();
    return !name || name.includes('@') ? '' : name.split(/\s+/)[0];
  });

  private readonly inStock = computed(() =>
    this.products().filter((p) => (Number(p.stock_quantity) || 0) > 0)
  );

  /** Best-rated in-stock product that has a photo (falls back to any in-stock item). */
  readonly featured = computed<Product | null>(() => {
    const byRating = (a: Product, b: Product) => (Number(b.rating) || 0) - (Number(a.rating) || 0);
    const withPhoto = this.inStock().filter((p) => !!p.image_url).sort(byRating);
    return withPhoto[0] ?? this.inStock()[0] ?? null;
  });

  /** Next-best sellers for the rail, excluding the featured item. */
  readonly popular = computed(() =>
    this.inStock()
      .filter((p) => p.id !== this.featured()?.id)
      .sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0))
      .slice(0, 8)
  );

  /** One tile per category, using the first product photo found in it. */
  readonly categoryTiles = computed(() => {
    const map = new Map<string, { label: string; img: string }>();
    for (const p of this.products()) {
      const entry = map.get(p.category) ?? { label: p.category, img: '' };
      if (!entry.img && p.image_url) entry.img = p.image_url;
      map.set(p.category, entry);
    }
    return [...map.values()];
  });

  constructor() {
    void this.loadProducts();
  }

  /** Pull-to-refresh: reload without flashing the skeleton. */
  async refresh(event: Event): Promise<void> {
    try {
      this.products.set(await this.productsService.list());
      this.errorMessage.set(null);
    } catch (err) {
      this.errorMessage.set(toErrorMessage(err));
    } finally {
      (event as CustomEvent & { target: { complete: () => void } }).target.complete();
    }
  }

  async loadProducts(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      this.products.set(await this.productsService.list());
    } catch (err) {
      this.errorMessage.set(toErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  formatPrice(n: number): string {
    return `₱${(Number(n) || 0).toFixed(2)}`;
  }

  ratingOf(p: Product): number {
    return Number(p.rating) || 0;
  }

  openDetail(product: Product): void {
    this.selectedProduct.set(product);
  }

  closeDetail(): void {
    this.selectedProduct.set(null);
  }

  async addFeatured(product: Product): Promise<void> {
    const result = await this.cart.addToCart(product);
    if (result.success) {
      this.featuredAdded.set(true);
      setTimeout(() => this.featuredAdded.set(false), 1400);
      return;
    }
    await this.showToast(result.message || 'Could not add to cart', 'danger');
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  handleSubscribe(): void {
    void this.subscribe(this.email().trim());
  }

  private async subscribe(email: string): Promise<void> {
    if (!email || !email.includes('@')) {
      await this.showToast('Enter a valid email address.', 'dark');
      return;
    }
    try {
      const { alreadySubscribed } = await this.newsletter.subscribe(email);
      this.email.set('');
      this.subscribed.set(true);
      setTimeout(() => this.subscribed.set(false), 3000);
      await this.showToast(
        alreadySubscribed ? 'You are already on our list.' : 'You are subscribed. Welcome to Knead to Know!',
        'dark'
      );
    } catch {
      await this.showToast('Could not subscribe right now. Please try again later.', 'danger');
    }
  }

  private async showToast(message: string, color: 'dark' | 'danger'): Promise<void> {
    const t = await this.toast.create({ message, duration: 2400, position: 'top', color });
    await t.present();
  }
}
