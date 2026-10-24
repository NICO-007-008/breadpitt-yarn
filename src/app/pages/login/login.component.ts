import { Component, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [RouterLink, IonBackButton, IonButtons, IonContent, IonHeader, IonInput, IonTitle, IonToolbar],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  /** Where to go after signing in (set by authGuard when a guest taps a protected page). */
  readonly returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

  readonly email = signal('');
  readonly password = signal('');
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  constructor() {
    // Already signed in? Send the user to the dashboard for their role.
    effect(() => {
      if (this.auth.ready() && this.auth.user() !== null) {
        void this.auth.redirectAfterAuth(this.returnUrl);
      }
    });
  }

  async handleSubmit(): Promise<void> {
    this.errorMessage.set(null);
    if (!this.email().trim() || !this.password()) {
      this.errorMessage.set('Please enter your email and password.');
      return;
    }

    this.submitting.set(true);
    const result = await this.auth.signIn(this.email().trim(), this.password());
    this.submitting.set(false);

    if (!result.ok) {
      this.errorMessage.set(result.message ?? 'Sign in failed. Please try again.');
      return;
    }

    await this.auth.redirectAfterAuth(this.returnUrl);
  }
}