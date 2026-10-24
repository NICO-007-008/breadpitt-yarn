# UI refresh — what changed

Palette unchanged (butter / gold / crust brown / burnt orange). New roles: brown = main action,
gold = accent, soft surfaces instead of heavy outlines. Young Serif for headings, Inter for the rest.

## Navigation
- Floating bottom nav for customers only: Home, Shop, Orders, Account. Staff (admin / store admin) get no bottom bar and work from the side menu.
- "View cart" bar appears once the cart has items. The side menu stays as "More".
- Default route is now `/dashboard`.

## Rebuilt screens (same logic, new markup)
Home, Shop, product sheet (now with quantity + add to cart), Orders & Cart, Checkout (sticky place-order bar),
Order confirmation (live status tracker), Payment success / cancelled, Account (now has Log out + shortcuts),
Notifications, Promotions (voucher tickets), Reviews, Contact, Custom order, About, Developers,
Sign in, Create account, Splash, Admin console (all 6 tabs), Order oversight (restyled; table → cards on phones).

## New files
- `src/theme/_refresh.scss` — all new styles, classes prefixed `bk-`
- `components/bottom-nav`, `components/product-card`

## Bugs fixed on the way
- Cart "View cart" link opened Order History instead of the cart tab.
- `teal` status badge ("Ready for pickup") had no style.
- Global `:focus-visible { border-radius: 4px }` squared off pill inputs when focused.
- Login page showed a developer note ("first account becomes Admin") to customers.
- Order IDs, labels and inputs: proper `<label for>` association throughout.

## Removed placeholder content
Hero "4.8 ★ 2,400+ reviews", chef section with stock photo, two testimonials with pravatar avatars,
Unsplash banner on Promotions, emoji icons on About/Contact.

## Known issues NOT fixed (need a product decision)
- Contact form does not send anything: it waits 1.2s, clears the form and says "Message sent!".
- Address, phone and hours (Banawe St, 0917…) are hard-coded in several pages.

## Before merging
`npm install && ng build` — written without a compiler. Self-host Inter and Young Serif for offline use.

## Round 2
- **Fit-to-device audit:** every screen was rendered at 320, 340, 360, 390, 412, 768 and 1280px and checked for
  anything wider than the screen. Fixed: filter panel (grid items overflowing), Home featured card, product-card
  add button, checkout place-order bar, product-sheet add button. Section 25 of `_refresh.scss` makes all layout
  grids shrink-safe so new screens can't regress.
- **Polish:** status badges no longer wrap, narrow-phone card footers, address rows wrap, no grey tap flash on Android.
- **New:** pull-to-refresh on Home and Shop; "Order again" on past orders (re-adds still-available items);
  notifications bell with unread count on Home; staggered card entrance animations.
- **Menu overlap fix:** nav / cart bar / checkout bar hide while the side menu is open.

## Round 3 — side menu rebuilt
- **Bug fixed:** the highlighted item stuck on the previous page. `isActive()` compared `router.url` (not a signal) so the
  menu never re-rendered after navigation. Active state now comes from a signal updated on every `NavigationEnd`.
  Items are plain links instead of `ion-item`, which also removes the sticky pressed/focus colour.
- **Design:** account card at the top (tap → Account), Home added, sentence-case titles, notification + cart badges,
  close button, rounded edge, Log out pinned to the bottom with a confirmation.
- **Role-aware:** staff get a "Store" group (Order overview, Fulfillment, Store manager) and no customer-only "Orders & cart".
- **Orders & cart** stays highlighted on checkout / order confirmation / payment screens.
- Styles: `src/theme/_menu.scss` rewritten (classes `bk-menu__*`); old menu rules removed from `_page-shared.scss`.

## Round 4
- **Cart:** the popover is now a bottom sheet. Header and totals/buttons stay fixed, only the item list scrolls (it used to collapse to a sliver on short screens). Nav and cart bar hide while it is open.
- **Product sheet:** the bottom nav no longer covers "Add to cart".
- **Product cards:** equal heights in every row (the `<app-product-card>` wrapper now stretches); entrance animation selectors fixed.
- **Auth:** back button + "Continue browsing" on Sign in / Create account; guests sent to Sign in return to the page they wanted (`returnUrl`).
- **Search:** no longer breaks on products without a description.
- **Polish (section 27 of `_refresh.scss`):** frosted nav, richer cart bar, card hover/press feedback, shimmer skeletons, header edge shadow, focus rings, reduced-motion support.
- **Checked against the progress-report video:** every feature shown there is still present (stats, order history/receipt/cancel, cart, checkout with 5 payment methods + vouchers, PayMongo return screens, print/save receipt, account/addresses/password, notifications "Mark all read", promotions claim, custom order, feedback, about, contact, developers links).

## Round 5 · New look (from the design pack)
- **Tokens** (`theme/_variables.scss`): flour-white page `#FBF9F4`, white cards, rye text `#26170E`, gold accent kept, pill buttons, 24 px cards. Names unchanged, so every page picks it up.
- **Fonts**: Lora (headings) + Lato (UI). `index.html` loads them; `--bakery-font` / `--bakery-font-display` updated.
- **`theme/_newlook.scss`** (loaded last): flat header with round menu/back buttons, flat tab bar with a gold pill behind the active icon, dark cart bar with gold count, colour-block product tiles per category, pistachio celebration banner, butter fallback for the featured card, and order cards as tickets (gold stub showing the first 4 characters of the order number).
- **Product card**: category-coloured tile; products without a photo now show an illustrated stand-in (`public/art/*.svg`) instead of the logo.
- **Welcome screen** (`/welcome`): shown once on first launch when signed out. Create account, Sign in, or "Just browsing for now". Nav and cart bar are hidden there.
