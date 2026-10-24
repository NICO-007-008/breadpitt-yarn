import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { closeCircle, optionsOutline, searchOutline } from 'ionicons/icons';
import { Product, ProductsService, toErrorMessage } from '../../services/products.service';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { ProductDetailModalComponent } from '../../components/product-detail-modal/product-detail-modal.component';

export type SortKey = 'default' | 'price_asc' | 'price_desc' | 'rating_desc';

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'default',     label: 'Newest' },
  { key: 'rating_desc', label: 'Most popular' },
  { key: 'price_asc',   label: 'Price: low to high' },
  { key: 'price_desc',  label: 'Price: high to low' },
];

@Component({
  selector: 'app-bread-catalog',
  imports: [
    RouterLink,
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
  templateUrl: './bread-catalog.component.html',
})
export class BreadCatalogComponent {
  private readonly productsService = inject(ProductsService);
  private readonly route = inject(ActivatedRoute);

  readonly sortOptions = SORT_OPTIONS;
  readonly searchIcon = searchOutline;
  readonly optionsIcon = optionsOutline;
  readonly clearIcon = closeCircle;

  readonly products = signal<Product[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  // ── Filter / Search / Sort state ──────────────────────────────────────────

  /** Active category pill. */
  readonly active = signal('All');

  /** Free-text search query (name or description). */
  readonly searchQuery = signal('');

  /** Price range filter. */
  readonly priceMin = signal<number | null>(null);
  readonly priceMax = signal<number | null>(null);

  /** Sort key. */
  readonly sortKey = signal<SortKey>('default');

  /** Whether the filter panel is expanded. */
  readonly filtersOpen = signal(false);

  /** Selected product to display in the detail modal (null = closed). */
  readonly selectedProduct = signal<Product | null>(null);

  // ── Derived ───────────────────────────────────────────────────────────────

  /** Unique category list derived from catalog data. */
  readonly filters = computed(() => [
    'All',
    ...new Set(this.products().map((p) => p.category)),
  ]);

  /** Max price across all products (drives the price slider upper bound). */
  readonly maxProductPrice = computed(() =>
    this.products().reduce((m, p) => Math.max(m, p.price), 0)
  );

  /** Whether any filter beyond category is active (badge indicator). */
  readonly hasActiveFilters = computed(() =>
    this.searchQuery().trim().length > 0 ||
    this.priceMin() !== null ||
    this.priceMax() !== null ||
    this.sortKey() !== 'default'
  );

  /** True when anything at all narrows the list (including the category chip). */
  readonly isFiltered = computed(() => this.hasActiveFilters() || this.active() !== 'All');

  /** Products after applying category, search, price range, and sort. */
  readonly visible = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const min = this.priceMin();
    const max = this.priceMax();
    const cat = this.active();

    let list = this.products();

    // 1. Category filter
    if (cat !== 'All') list = list.filter((p) => p.category === cat);

    // 2. Text search (name + description)
    if (q.length > 0) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description ?? '').toLowerCase().includes(q)
      );
    }

    // 3. Price range
    if (min !== null) list = list.filter((p) => p.price >= min);
    if (max !== null) list = list.filter((p) => p.price <= max);

    // 4. Sort
    const key = this.sortKey();
    if (key === 'price_asc') list = [...list].sort((a, b) => a.price - b.price);
    else if (key === 'price_desc') list = [...list].sort((a, b) => b.price - a.price);
    else if (key === 'rating_desc') list = [...list].sort((a, b) => b.rating - a.rating);
    // 'default' keeps DB order (created_at DESC)

    return list;
  });

  /**
   * Groups visible products by category when "All" is selected; otherwise
   * returns a single group — the template works uniformly either way.
   */
  readonly groupedProducts = computed((): { category: string; items: Product[] }[] => {
    const list = this.visible();
    if (this.active() !== 'All') {
      return list.length ? [{ category: this.active(), items: list }] : [];
    }
    const map = new Map<string, Product[]>();
    for (const p of list) {
      const bucket = map.get(p.category) ?? [];
      bucket.push(p);
      map.set(p.category, bucket);
    }
    return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
  });

  constructor() {
    void this.loadProducts();

    // Home's category tiles link here with ?category=Bread. The page can be reused
    // by the router, so listen for changes rather than reading the URL once.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const category = params.get('category');
      if (category) this.active.set(category);
    });
  }

  // ── Data ──────────────────────────────────────────────────────────────────

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
      if (!this.filters().includes(this.active())) this.active.set('All');
    } catch (err) {
      this.errorMessage.set(toErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  // ── Filter helpers ────────────────────────────────────────────────────────

  clearAllFilters(): void {
    this.searchQuery.set('');
    this.priceMin.set(null);
    this.priceMax.set(null);
    this.sortKey.set('default');
    this.active.set('All');
  }

  setPriceMin(value: string): void {
    const n = parseFloat(value);
    this.priceMin.set(Number.isFinite(n) && n > 0 ? n : null);
  }

  setPriceMax(value: string): void {
    const n = parseFloat(value);
    this.priceMax.set(Number.isFinite(n) && n > 0 ? n : null);
  }

  formatPrice(n: number): string {
    return `₱${(Number(n) || 0).toFixed(2)}`;
  }

  // ── Modal ─────────────────────────────────────────────────────────────────

  openDetail(product: Product): void {
    this.selectedProduct.set(product);
  }

  closeDetail(): void {
    this.selectedProduct.set(null);
  }
}
