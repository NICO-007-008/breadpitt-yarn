import { Component, effect, inject, signal } from '@angular/core';
import { IonSpinner } from '@ionic/angular';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-splash-screen',
  standalone: true,
  imports: [IonSpinner],
  template: `
    @if (show()) {
      <div class="splash-overlay" [class.fade-out]="fadeOut()">
        <div class="splash-content">
          <img src="/logo.jpg" alt="Knead to Know" class="splash-logo" (error)="onImageError($event)" />
          <p class="splash-name">Knead to Know</p>
          <p class="splash-tagline">Fresh bread, baked daily</p>
          <ion-spinner name="dots" class="splash-spinner"></ion-spinner>
        </div>
      </div>
    }
  `,
  styles: [`
    .splash-overlay {
      position: fixed;
      inset: 0;
      background: var(--bakery-base);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      transition: opacity 0.35s ease-out, visibility 0.35s ease-out;
    }

    .splash-overlay.fade-out {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }

    .splash-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      text-align: center;
    }

    .splash-logo {
      width: 132px;
      height: 132px;
      border-radius: 40px;
      object-fit: cover;
      box-shadow: 0 18px 40px -18px rgba(77, 42, 0, 0.55);
      animation: splash-in 0.5s var(--bakery-ease) both;
    }

    .splash-name {
      font-family: var(--bakery-font-display);
      font-size: 2rem;
      font-weight: 400;
      color: var(--bakery-dark);
      margin: 0;
      animation: splash-in 0.5s var(--bakery-ease) 0.08s both;
    }

    .splash-tagline {
      font-size: 1rem;
      color: var(--bakery-text-secondary);
      margin: -8px 0 0;
      animation: splash-in 0.5s var(--bakery-ease) 0.16s both;
    }

    .splash-spinner {
      --color: var(--bakery-dark);
      width: 32px;
      height: 32px;
      margin-top: 12px;
    }

    @keyframes splash-in {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @media (prefers-reduced-motion: reduce) {
      .splash-overlay {
        transition: none;
      }
    }
  `],
})
export class SplashScreenComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly show = signal(true);
  readonly fadeOut = signal(false);

  constructor() {
    // Brand moment, then get out of the way (was 2.5s, which felt like a wait).
    setTimeout(() => {
      this.fadeOut.set(true);
      setTimeout(() => {
        this.show.set(false);
        // First launch, signed out: offer sign in / create account / just browsing.
        let seen = true;
        try { seen = !!localStorage.getItem('k2k_welcome_seen'); } catch { /* ignore */ }
        if (!seen && this.auth.ready() && !this.auth.user() && this.router.url.split('?')[0].replace(/\/$/, '') !== '/welcome') {
          void this.router.navigateByUrl('/welcome');
        }
      }, 350);
    }, 1400);

    // If auth is ready and user is logged in, we can proceed
    // Otherwise splash will just time out
    effect(() => {
      if (this.auth.ready() && !this.auth.user()) {
        // User not logged in - splash will still show for full duration
        // to maintain consistent branding experience
      }
    });

    // Cleanup on destroy
    // Note: In a real app, you'd use ngOnDestroy, but for this simple
    // component the timer will be cleaned up when the component is removed
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }
}