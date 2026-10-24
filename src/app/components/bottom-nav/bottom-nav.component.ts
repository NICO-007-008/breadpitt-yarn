import { Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { filter } from 'rxjs/operators';
import {
  bagHandle,
  bagHandleOutline,
  home,
  homeOutline,
  person,
  personOutline,
  storefront,
  storefrontOutline,
} from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { NotificationsService } from '../../services/notifications.service';

interface Tab {
  label: string;
  url: string;
  icon: string;
  iconActive: string;
  badge?: 'cart' | 'unread';
}

/** Routes where the nav would get in the way (auth and payment flows). */
const HIDDEN_ON = [
  '/welcome',
  '/login',
  '/register',
  '/checkout',
  '/payment-success',
  '/payment-cancelled',
  '/order-confirmation',
];

/**
 * Floating bottom navigation for the four things customers do most.
 * Everything else (offers, feedback, contact…) stays in the side menu.
 */
@Component({
  selector: 'app-bottom-nav',
  imports: [RouterLink, IonIcon],
  templateUrl: './bottom-nav.component.html',
})
export class BottomNavComponent {
  private readonly router = inject(Router);
  private readonly cart = inject(CartService);
  private readonly notifications = inject(NotificationsService);
  private readonly auth = inject(AuthService);

  readonly tabs: Tab[] = [
    { label: 'Home',    url: '/dashboard',     icon: homeOutline,       iconActive: home },
    { label: 'Shop',    url: '/bread-catalog', icon: storefrontOutline, iconActive: storefront },
    { label: 'Orders',  url: '/orders',        icon: bagHandleOutline,  iconActive: bagHandle, badge: 'cart' },
    { label: 'Account', url: '/profile',       icon: personOutline,     iconActive: person,    badge: 'unread' },
  ];


  readonly cartCount = this.cart.itemCount;
  readonly unreadCount = this.notifications.unreadCount;

  private readonly url = signal(this.router.url);
  /** True while a text field has focus, so the nav doesn't ride above the keyboard. */
  private readonly typing = signal(false);

  /** Customers only: staff work from the side menu, so they get no bottom bar. */
  readonly onAllowedRoute = computed(() => {
    if (this.auth.canManageProducts()) return false;
    const path = this.url().split(/[?#]/)[0];
    return !HIDDEN_ON.some((p) => path === p || path.startsWith(`${p}/`));
  });
  readonly hidden = computed(() => this.typing());

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.url.set(e.urlAfterRedirects));

    // Pages read this class to reserve space at the bottom of their scroll area.
    effect(() => document.body.classList.toggle('has-bottom-nav', this.onAllowedRoute()));
  }

  @HostListener('document:focusin', ['$event'])
  onFocusIn(e: FocusEvent): void {
    const el = e.target as HTMLElement | null;
    this.typing.set(!!el && /^(INPUT|TEXTAREA|SELECT|ION-INPUT|ION-TEXTAREA)$/.test(el.tagName));
  }

  @HostListener('document:focusout')
  onFocusOut(): void {
    this.typing.set(false);
  }

  isActive(tab: Tab): boolean {
    const path = this.url().split(/[?#]/)[0];
    return path === tab.url || path.startsWith(`${tab.url}/`);
  }
}
