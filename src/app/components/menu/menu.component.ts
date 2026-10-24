import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import {
  AlertController,
  IonContent,
  IonIcon,
  IonMenu,
  IonMenuToggle,
} from '@ionic/angular';
import { filter } from 'rxjs/operators';
import {
  bagHandleOutline,
  chevronForwardOutline,
  clipboardOutline,
  closeOutline,
  codeSlashOutline,
  colorPaletteOutline,
  cubeOutline,
  homeOutline,
  logInOutline,
  logOutOutline,
  mailOutline,
  notificationsOutline,
  nutritionOutline,
  personOutline,
  pricetagOutline,
  receiptOutline,
  starOutline,
  storefrontOutline,
} from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { NotificationsService } from '../../services/notifications.service';

// ─── Navigation map ──────────────────────────────────────────────────────────

type Group = 'Store' | 'Shop' | 'Account' | 'More';

interface AppPage {
  title: string;
  url: string;
  icon: string;
  group: Group;
  /** Who sees it. Staff run the store, so their "orders" page is fulfillment. */
  audience: 'all' | 'customer' | 'staff';
  /** Other routes that belong to this entry (so it stays highlighted on them). */
  alsoActiveOn?: string[];
}

const appPages: AppPage[] = [
  // Staff tools
  { title: 'Order overview',  url: '/order-oversight', icon: clipboardOutline,     group: 'Store',   audience: 'staff' },
  { title: 'Fulfillment',     url: '/orders',          icon: receiptOutline,       group: 'Store',   audience: 'staff' },
  { title: 'Store manager',   url: '/admin',           icon: cubeOutline,          group: 'Store',   audience: 'staff' },

  // Shopping
  { title: 'Home',            url: '/dashboard',       icon: homeOutline,          group: 'Shop',    audience: 'all' },
  { title: 'Shop',            url: '/bread-catalog',   icon: storefrontOutline,    group: 'Shop',    audience: 'all' },
  { title: 'Custom order',    url: '/custom-order',    icon: colorPaletteOutline,  group: 'Shop',    audience: 'all' },
  {
    title: 'Orders & cart',   url: '/orders',          icon: bagHandleOutline,     group: 'Shop',    audience: 'customer',
    alsoActiveOn: ['/checkout', '/order-confirmation', '/payment-success', '/payment-cancelled'],
  },

  // Account
  { title: 'Account',         url: '/profile',         icon: personOutline,        group: 'Account', audience: 'all' },
  { title: 'Notifications',   url: '/notifications',   icon: notificationsOutline, group: 'Account', audience: 'all' },

  // Everything else
  { title: 'Promotions',      url: '/promotions',      icon: pricetagOutline,      group: 'More',    audience: 'all' },
  { title: 'Reviews',         url: '/feedback',        icon: starOutline,          group: 'More',    audience: 'all' },
  { title: 'Our craft',       url: '/about-products',  icon: nutritionOutline,     group: 'More',    audience: 'all' },
  { title: 'Contact us',      url: '/contact-us',      icon: mailOutline,          group: 'More',    audience: 'all' },
  { title: 'Developers',      url: '/developers',      icon: codeSlashOutline,     group: 'More',    audience: 'all' },
];

const pathOf = (url: string): string => url.split(/[?#]/)[0] || '/';

// ─── Component ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-menu',
  imports: [RouterLink, IonContent, IonIcon, IonMenu, IonMenuToggle],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.scss',
})
export class MenuComponent implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationsService);
  private readonly alertCtrl = inject(AlertController);

  readonly closeIcon = closeOutline;
  readonly chevronIcon = chevronForwardOutline;
  readonly logOutIcon = logOutOutline;
  readonly logInIcon = logInOutline;
  readonly isLoggingOut = signal(false);

  readonly user = this.auth.user;
  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly canManageProducts = this.auth.canManageProducts;

  /** Unread notification count (0 hides the badge). */
  readonly unreadCount = this.notifications.unreadCount;
  /** Items in the cart (badge on "Orders & cart"). */
  readonly itemCount = this.cart.itemCount;

  /**
   * The current route as a SIGNAL. The old code compared `router.url` inside the
   * template, which is not reactive, so the highlight stayed on the previous page.
   */
  private readonly currentPath = signal(pathOf(this.router.url));

  readonly initial = computed(() => {
    const u = this.user();
    return ((u?.displayName || u?.email || '?').trim()[0] ?? '?').toUpperCase();
  });

  readonly roleLabel = computed(() => {
    const role = this.user()?.role;
    return role === 'admin' ? 'Admin' : role === 'store_admin' ? 'Store admin' : 'Customer';
  });

  private readonly unsubscribe: (() => void) | null;

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe((e) => this.currentPath.set(pathOf(e.urlAfterRedirects)));

    // Keep the badge live via realtime changes…
    this.unsubscribe = this.notifications.subscribe(() => void this.refreshUnread());
    // …and refresh whenever the auth state flips (e.g. right after login).
    effect(() => {
      if (this.isAuthenticated()) void this.refreshUnread();
    });
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
  }

  private async refreshUnread(): Promise<void> {
    try {
      await this.notifications.refresh();
    } catch {
      // badge is cosmetic — never block navigation on a refresh failure
    }
  }

  /** Entries this role may see; staff get the store tools first. */
  readonly groupedPages = computed(() => {
    const staff = this.canManageProducts();
    const pages = appPages.filter((p) => p.audience === 'all' || (staff ? p.audience === 'staff' : p.audience === 'customer'));
    const order: Group[] = staff ? ['Store', 'Shop', 'Account', 'More'] : ['Shop', 'Account', 'More'];
    return order
      .map((label) => ({ label, pages: pages.filter((p) => p.group === label) }))
      .filter((section) => section.pages.length > 0);
  });

  isActive(page: AppPage): boolean {
    const path = this.currentPath();
    return [page.url, ...(page.alsoActiveOn ?? [])].some((p) => path === p || path.startsWith(`${p}/`));
  }

  async confirmLogout(): Promise<void> {
    if (this.isLoggingOut()) return;
    const alert = await this.alertCtrl.create({
      header: 'Log out?',
      message: 'You can sign back in any time. Items in your cart are kept.',
      buttons: [
        { text: 'Stay signed in', role: 'cancel' },
        { text: 'Log out', role: 'destructive', handler: () => this.logout() },
      ],
    });
    await alert.present();
  }

  private logout(): void {
    this.isLoggingOut.set(true);
    void this.auth.signOut().finally(() => this.isLoggingOut.set(false));
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }
}
