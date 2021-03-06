import { Component, OnInit } from "@angular/core";
import { FormControl, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { Title } from "@angular/platform-browser";
import { SessionService } from "../../../common/services/session.service";
import { MessageService } from "../../../common/services/message.service";
import { BaseAuthenticatedRoutableComponent } from "../../../common/pages/base-authenticated-routable.component";
import { EmailValidator, ValidationResult } from "../../../common/validators/email.validator";
import { UrlValidator } from "../../../common/validators/url.validator";
import { MdImgValidator } from "../../../common/validators/md-img.validator";

import { BadgeInstanceManager } from "../../services/badgeinstance-manager.service";
import { BadgeClassManager } from "../../services/badgeclass-manager.service";
import { IssuerManager } from "../../services/issuer-manager.service";

import { Issuer } from "../../models/issuer.model";
import { BadgeClass } from "../../models/badgeclass.model";
import { CommonDialogsService } from "../../../common/services/common-dialogs.service";
import { BadgrApiFailure } from "../../../common/services/api-failure";
import { RecipientIdentifierType } from "../../models/badgeinstance-api.model";
import { typedGroup } from "../../../common/util/typed-forms";
import { TelephoneValidator } from "../../../common/validators/telephone.validator";
import { EventsService } from "../../../common/services/events.service";
import { FormFieldTextInputType } from '../../../common/components/formfield-text';
import * as striptags from 'striptags'
import { DateValidator } from "../../../common/validators/date.validator";
import { AppConfigService } from "../../../common/app-config.service";
import { LinkEntry } from '../../../common/components/bg-breadcrumbs/bg-breadcrumbs.component';


@Component({
	selector: 'badgeclass-issue',
	templateUrl: './badgeclass-issue.component.html'
})
export class BadgeClassIssueComponent extends BaseAuthenticatedRoutableComponent implements OnInit {

	breadcrumbLinkEntries: LinkEntry [] = [];

	get defaultExpiration(): string {
		if (this.badgeClass && this.badgeClass.expiresDuration && this.badgeClass.expiresAmount) {
			return this.badgeClass.expirationDateRelative().toISOString().replace(/T.*/, '')
		}
	}

	get issuerSlug() {
		return this.route.snapshot.params[ 'issuerSlug' ]
	}

	get badgeSlug() {
		return this.route.snapshot.params[ 'badgeSlug' ]
	}

	get recipientIdentifierFieldType(): FormFieldTextInputType {
		switch (this.issueForm.controls.recipient_type.value) {
			case 'email':
				return "email";
			case 'openBadgeId':
			 	return "text";
			case 'telephone':
				return "tel";
			case 'url':
				return "url";
			default:
				return "text";
		}
	}

	expirationDateEditable: boolean = false;

	issuer: Issuer;
	issueForm = typedGroup()
		.addControl("expires", "", this['expirationValidator'])
		.addControl("recipient_type", "email" as RecipientIdentifierType, [ Validators.required ], control => {
			control.untypedControl.valueChanges.subscribe(() => {
				this.issueForm.controls.recipient_identifier.untypedControl.updateValueAndValidity()
			})
		})
		.addControl("recipient_identifier", "", [ Validators.required, this['idValidator'] ])
		.addControl("recipientprofile_name", "")
		.addControl("narrative", "", MdImgValidator.imageTest)
		.addControl("notify_earner", true)
		.addArray("evidence_items", typedGroup()
			.addControl("narrative", "")
			.addControl("evidence_url", "")
			.addControl("expiration", "")
		);

	badgeClass: BadgeClass;

	issueBadgeFinished: Promise<any>;
	issuerLoaded: Promise<any>;
	badgeClassLoaded: Promise<any>;

	identifierOptionMap = {
		email: 'Email Address',
		url: 'URL',
		telephone: 'Telephone',
	};

	evidenceEnabled = false;
	narrativeEnabled = false;
	expirationEnabled = false;
	idValidator: (control: FormControl) => ValidationResult = control => {
		if (this.issueForm) {
			switch (this.issueForm.controls.recipient_type.value) {
				case 'email': return EmailValidator.validEmail(control);
				case 'openBadgeId': return null;
				case 'telephone': return TelephoneValidator.validTelephone(control);
				case 'url': return UrlValidator.validUrl(control);
				default: return null;
			}
		} else {
			return null;
		}
	};
	expirationValidator: (control: FormControl) => ValidationResult = (control) => {
		if (this.expirationEnabled) {
			return Validators.compose([Validators.required, DateValidator.validDate])(control)
		} else {
			return null;
		}
	};

	constructor(
		protected title: Title,
		protected messageService: MessageService,
		protected eventsService: EventsService,
		protected issuerManager: IssuerManager,
		protected badgeClassManager: BadgeClassManager,
		protected badgeInstanceManager: BadgeInstanceManager,
		protected dialogService: CommonDialogsService,
		protected configService: AppConfigService,
		sessionService: SessionService,
		router: Router,
		route: ActivatedRoute
	) {
		super(router, route, sessionService);
		title.setTitle(`Award Badge - ${this.configService.theme['serviceName'] || "Badgr"}`);

		this.issuerLoaded = this.issuerManager.issuerBySlug(this.issuerSlug).then((issuer) => {
			this.issuer = issuer;

			this.badgeClassLoaded = this.badgeClassManager.badgeByIssuerUrlAndSlug(
				issuer.issuerUrl,
				this.badgeSlug
			).then((badgeClass) => {
				this.badgeClass = badgeClass;

				this.breadcrumbLinkEntries = [
					{title: 'Issuers', routerLink: ['/issuer']},
					{title: issuer.name, routerLink: ['/issuer/issuers', this.issuerSlug] },
					{title: badgeClass.name, routerLink: ['/issuer/issuers', this.issuerSlug, 'badges', badgeClass.slug]},
					{title: 'Award Badge'}
				];

				if (badgeClass.expiresDuration && badgeClass.expiresAmount) {
					this.expirationEnabled = true;
				}
				this.issueForm.untypedControls.expires.setValue(this.defaultExpiration);

				this.title.setTitle(`Award Badge - ${badgeClass.name} - ${this.configService.theme['serviceName'] || "Badgr"}`);
			});
		});
	}

	ngOnInit() {
		super.ngOnInit();
	}

	enableEvidence() {
		this.evidenceEnabled = true;

		if (this.issueForm.controls.evidence_items.length < 1) {
			this.addEvidence();
		}
	}

	toggleExpiration() {
		this.expirationEnabled = !this.expirationEnabled;
	}

	addEvidence() {
		this.issueForm.controls.evidence_items.addFromTemplate();
	}

	onSubmit() {
		const formState = this.issueForm.value;
		let cleanedEvidence = formState.evidence_items.filter(e => e.narrative !== "" || e.evidence_url !== "");
		const cleanedName = striptags(formState.recipientprofile_name);

		const recipientProfileContextUrl = "https://openbadgespec.org/extensions/recipientProfile/context.json";
		let extensions = formState.recipientprofile_name ? {
			"extensions:recipientProfile": {
				"@context": recipientProfileContextUrl,
				"type": ["Extension", "extensions:RecipientProfile"],
				"name": cleanedName
			}
		} : undefined;

		let expires = (this.expirationEnabled && formState.expires) ? new Date(formState.expires).toISOString() : undefined;

		this.issueBadgeFinished = this.badgeInstanceManager.createBadgeInstance(
			this.issuerSlug,
			this.badgeSlug,
			{
				issuer: this.issuerSlug,
				badge_class: this.badgeSlug,
				recipient_type: formState.recipient_type,
				recipient_identifier: formState.recipient_identifier,
				narrative: this.narrativeEnabled ? formState.narrative : "",
				create_notification: formState.notify_earner,
				evidence_items: this.evidenceEnabled ? cleanedEvidence : [],
				extensions: extensions,
				expires: expires,
			}
		).then(() => this.badgeClass.update())
			.then(() => {
			this.eventsService.recipientBadgesStale.next([]);
			this.router.navigate(
				['issuer/issuers', this.issuerSlug, 'badges', this.badgeClass.slug]
			);
			this.messageService.setMessage("Badge awarded to " + formState.recipient_identifier, "success");
		}, error => {
			this.messageService.setMessage("Unable to award badge: " + BadgrApiFailure.from(error).firstMessage, "error");
		}).then(() => this.issueBadgeFinished = null)
	}

	async removeEvidence(i: number) {
		const evidence = this.issueForm.controls.evidence_items.value[i];

		if ((evidence.narrative.length === 0 && evidence.evidence_url.length === 0)
			|| await this.dialogService.confirmDialog.openTrueFalseDialog({
				dialogTitle: `Delete Evidence?`,
				dialogBody: `Are you sure you want to delete this evidence?`,
				resolveButtonLabel: `Delete Evidence`,
				rejectButtonLabel: "Cancel"
			})) {
			this.issueForm.controls.evidence_items.removeAt(i);
		}
	}

	clickSubmit(ev: Event) {
		if (!this.issueForm.valid) {
			ev.preventDefault();
			this.issueForm.markTreeDirty();
		}
	}

}
