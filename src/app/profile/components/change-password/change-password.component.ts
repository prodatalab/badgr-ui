import { Component } from "@angular/core";

import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { SessionService } from "../../../common/services/session.service";
import { MessageService } from "../../../common/services/message.service";
import { Title } from "@angular/platform-browser";
import { markControlsDirty } from "../../../common/util/form-util";
import { BaseRoutableComponent } from "../../../common/pages/base-routable.component";
import { UserProfileManager } from "../../../common/services/user-profile-manager.service";
import { UserProfile } from "../../../common/model/user-profile.model";
import { AppConfigService } from "../../../common/app-config.service";


@Component({
	selector: 'change-password',
	templateUrl: './change-password.component.html'
})
export class ChangePasswordComponent extends BaseRoutableComponent {
	changePasswordForm: FormGroup;
	profile: UserProfile;

	constructor(
		private fb: FormBuilder,
		private title: Title,
		private sessionService: SessionService,
		private profileManager: UserProfileManager,
		route: ActivatedRoute,
		router: Router,
		protected configService: AppConfigService,
		private _messageService: MessageService
	) {
		super(router, route);

		title.setTitle(`Change Password - ${this.configService.theme['serviceName'] || "Badgr"}`);

		this.profileManager.userProfilePromise
			.then(profile => this.profile = profile);

		this.changePasswordForm = this.fb.group({
				password1: [ '', Validators.required ],
				password2: [ '', Validators.required ],
				current_password: [ '', Validators.required ]
			}, { validator: this.passwordsMatch }
		);
	}

	submitChange() {
		const NEW_PASSWORD: string = this.changePasswordForm.controls[ 'password1' ].value;
		const CURRENT_PASSWORD: string = this.changePasswordForm.controls[ 'current_password' ].value;

		this.profile.updatePassword(NEW_PASSWORD, CURRENT_PASSWORD)
			.then(
				() => {
					this._messageService.reportMajorSuccess('Your password has been changed successfully.', true);
					this.router.navigate([ "/profile/profile" ]);
				},
				err => this._messageService.reportAndThrowError('Your password must be uncommon and at least 8 characters. Please try again.', err)
			);
	}

	forgotPassword() {
		this.sessionService.logout();
		this.router.navigate(['/auth/request-password-reset']);
	}

	clickSubmit(ev: Event) {
		if (!this.changePasswordForm.valid) {
			ev.preventDefault();
			markControlsDirty(this.changePasswordForm);
		}
	}

	passwordsMatch(group: FormGroup) {
		const p1 = group.controls.password1.value;
		const p2 = group.controls.password1.value;

		if (p1 && p2 && p1 !== p2) {
			return { passwordsMatch: "Passwords do not match" };
		}

		return null;
	}

	cancel() {
		this.router.navigate(["/profile/profile"]);
	}
}


