import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';

export const WELCOME_SEEN_KEY = 'k2k_welcome_seen';

/**
 * First-run screen: sign in, create an account, or just look around.
 * Shown once per device (see the splash screen); afterwards it is only
 * reachable at /welcome.
 */
@Component({
  selector: 'app-welcome',
  imports: [IonContent, RouterLink],
  template: `
    <ion-content [fullscreen]="true" class="welcome-content">
      <div class="welcome">
        <div class="welcome__art" aria-hidden="true">
          <img class="a a--croissant" src="art/croissant.svg" alt="" />
          <img class="a a--muffin" src="art/muffin.svg" alt="" />
          <img class="a a--boule" src="art/boule.svg" alt="" />
          <img class="a a--cookie" src="art/cookie.svg" alt="" />
          <img class="a a--cake" src="art/cake.svg" alt="" />
        </div>

        <h1>Fresh bread,<br />ready when you are.</h1>
        <p>Order ahead from our bakery and pick it up still warm.</p>

        <div class="welcome__actions">
          <a class="bk-btn bk-btn--dark bk-btn--block" routerLink="/register">Create account</a>
          <a class="bk-btn bk-btn--outline bk-btn--block" routerLink="/login">Sign in</a>
          <button type="button" class="welcome__skip" (click)="browse()">Just browsing for now</button>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .welcome { max-width: 520px; margin: 0 auto; padding: calc(12px + env(safe-area-inset-top, 0px)) 20px calc(24px + env(safe-area-inset-bottom, 0px)); }
    .welcome__art { position: relative; height: 380px; border-radius: 36px; background: var(--bk-butter, #F9D977); overflow: hidden; }
    .a { position: absolute; display: block; }
    .a--croissant { left: -16px; top: 24px; width: 180px; transform: rotate(-8deg); }
    .a--muffin { right: -20px; top: 8px; width: 160px; transform: rotate(10deg); }
    .a--boule { left: 28%; top: 150px; width: 190px; }
    .a--cookie { left: 8px; bottom: 0; width: 108px; transform: rotate(-12deg); }
    .a--cake { right: 6px; bottom: 8px; width: 108px; transform: rotate(8deg); }
    h1 { margin: 26px 0 0; font-family: var(--bakery-font-display); font-weight: 600; font-size: 2.1rem; line-height: 1.1; letter-spacing: -0.01em; color: var(--bakery-dark); }
    p { margin: 10px 0 0; max-width: 30ch; color: var(--bakery-text-secondary); font-size: 1rem; }
    .welcome__actions { display: flex; flex-direction: column; gap: 10px; margin-top: 26px; }
    .welcome__skip { align-self: center; margin-top: 6px; min-height: 44px; padding: 0 12px; border: 0; background: none; color: var(--bakery-dark); font: 800 1rem var(--bakery-font); text-decoration: underline; text-underline-offset: 4px; cursor: pointer; }
    @media (max-height: 700px) { .welcome__art { height: 280px; } .a--boule { top: 100px; width: 150px; } }
  `],
})
export class WelcomeComponent {
  constructor(private readonly router: Router) {
    try { localStorage.setItem(WELCOME_SEEN_KEY, '1'); } catch { /* storage unavailable: it will simply show again */ }
  }

  browse(): void {
    void this.router.navigateByUrl('/dashboard');
  }
}
