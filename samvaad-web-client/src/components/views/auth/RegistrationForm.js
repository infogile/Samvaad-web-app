/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2018, 2019 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";
import createReactClass from "create-react-class";
import PropTypes from "prop-types";
import * as sdk from "matrix-react-sdk/src/index";
import * as Email from "matrix-react-sdk/src/email";
import { looksValid as phoneNumberLooksValid } from "matrix-react-sdk/src/phonenumber";
import Modal from "matrix-react-sdk/src/Modal";
import { _t } from "matrix-react-sdk/src/languageHandler";
import SdkConfig from "matrix-react-sdk/src/SdkConfig";
import { SAFE_LOCALPART_REGEX } from "matrix-react-sdk/src/Registration";
import withValidation from "matrix-react-sdk/src/components/views/elements/Validation";
import { ValidatedServerConfig } from "matrix-react-sdk/src/utils/AutoDiscoveryUtils";
import PassphraseField from "matrix-react-sdk/src/components/views/auth/PassphraseField";

const FIELD_EMAIL = "field_email";
const FIELD_PHONE_NUMBER = "field_phone_number";
const FIELD_USERNAME = "field_username";
const FIELD_PASSWORD = "field_password";
const FIELD_PASSWORD_CONFIRM = "field_password_confirm";

const PASSWORD_MIN_SCORE = 3; // safely unguessable: moderate protection from offline slow-hash scenario.

/**
 * A pure UI component which displays a registration form.
 */
export default createReactClass({
    displayName: "RegistrationForm",

    propTypes: {
        // Values pre-filled in the input boxes when the component loads
        defaultEmail: PropTypes.string,
        defaultPhoneCountry: PropTypes.string,
        defaultPhoneNumber: PropTypes.string,
        defaultUsername: PropTypes.string,
        defaultPassword: PropTypes.string,
        onRegisterClick: PropTypes.func.isRequired, // onRegisterClick(Object) => ?Promise
        onEditServerDetailsClick: PropTypes.func,
        flows: PropTypes.arrayOf(PropTypes.object).isRequired,
        serverConfig: PropTypes.instanceOf(ValidatedServerConfig).isRequired,
        canSubmit: PropTypes.bool,
        serverRequiresIdServer: PropTypes.bool,
    },

    getDefaultProps: function () {
        return {
            onValidationChange: console.error,
            canSubmit: true,
        };
    },

    getInitialState: function () {
        return {
            // Field error codes by field ID
            fieldValid: {},
            // The ISO2 country code selected in the phone number entry
            phoneCountry: this.props.defaultPhoneCountry,
            username: this.props.defaultUsername || "",
            email: this.props.defaultEmail || "",
            phoneNumber: this.props.defaultPhoneNumber || "",
            password: this.props.defaultPassword || "",
            passwordConfirm: this.props.defaultPassword || "",
            passwordComplexity: null,
        };
    },

    onSubmit: async function (ev) {
        ev.preventDefault();

        if (!this.props.canSubmit) return;

        const allFieldsValid = await this.verifyFieldsBeforeSubmit();
        if (!allFieldsValid) {
            return;
        }

        const self = this;
        if (this.state.email === "") {
            const haveIs = Boolean(this.props.serverConfig.isUrl);

            let desc;
            if (this.props.serverRequiresIdServer && !haveIs) {
                desc = _t(
                    "No identity server is configured so you cannot add an email address in order to " +
                        "reset your password in the future."
                );
            } else if (this._showEmail()) {
                desc = _t(
                    "If you don't specify an email address, you won't be able to reset your password. " +
                        "Are you sure?"
                );
            } else {
                // user can't set an e-mail so don't prompt them to
                self._doSubmit(ev);
                return;
            }

            const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
            Modal.createTrackedDialog(
                "If you don't specify an email address...",
                "",
                QuestionDialog,
                {
                    title: _t("Warning!"),
                    description: desc,
                    button: _t("Continue"),
                    onFinished: function (confirmed) {
                        if (confirmed) {
                            self._doSubmit(ev);
                        }
                    },
                }
            );
        } else {
            self._doSubmit(ev);
        }
    },

    _doSubmit: function (ev) {
        const email = this.state.email.trim();
        const promise = this.props.onRegisterClick({
            username: this.state.username.trim(),
            password: this.state.password.trim(),
            email: email,
            phoneCountry: this.state.phoneCountry,
            phoneNumber: this.state.phoneNumber,
        });

        if (promise) {
            ev.target.disabled = true;
            promise.finally(function () {
                ev.target.disabled = false;
            });
        }
    },

    async verifyFieldsBeforeSubmit() {
        // Blur the active element if any, so we first run its blur validation,
        // which is less strict than the pass we're about to do below for all fields.
        const activeElement = document.activeElement;
        if (activeElement) {
            activeElement.blur();
        }

        const fieldIDsInDisplayOrder = [
            FIELD_USERNAME,
            FIELD_PASSWORD,
            FIELD_PASSWORD_CONFIRM,
            FIELD_EMAIL,
            FIELD_PHONE_NUMBER,
        ];

        // Run all fields with stricter validation that no longer allows empty
        // values for required fields.
        for (const fieldID of fieldIDsInDisplayOrder) {
            const field = this[fieldID];
            if (!field) {
                continue;
            }
            // We must wait for these validations to finish before queueing
            // up the setState below so our setState goes in the queue after
            // all the setStates from these validate calls (that's how we
            // know they've finished).
            await field.validate({ allowEmpty: false });
        }

        // Validation and state updates are async, so we need to wait for them to complete
        // first. Queue a `setState` callback and wait for it to resolve.
        await new Promise((resolve) => this.setState({}, resolve));

        if (this.allFieldsValid()) {
            return true;
        }

        const invalidField = this.findFirstInvalidField(fieldIDsInDisplayOrder);

        if (!invalidField) {
            return true;
        }

        // Focus the first invalid field and show feedback in the stricter mode
        // that no longer allows empty values for required fields.
        invalidField.focus();
        invalidField.validate({ allowEmpty: false, focused: true });
        return false;
    },

    /**
     * @returns {boolean} true if all fields were valid last time they were validated.
     */
    allFieldsValid: function () {
        const keys = Object.keys(this.state.fieldValid);
        for (let i = 0; i < keys.length; ++i) {
            if (!this.state.fieldValid[keys[i]]) {
                return false;
            }
        }
        return true;
    },

    findFirstInvalidField(fieldIDs) {
        for (const fieldID of fieldIDs) {
            if (!this.state.fieldValid[fieldID] && this[fieldID]) {
                return this[fieldID];
            }
        }
        return null;
    },

    markFieldValid: function (fieldID, valid) {
        const { fieldValid } = this.state;
        fieldValid[fieldID] = valid;
        this.setState({
            fieldValid,
        });
    },

    onEmailChange(ev) {
        this.setState({
            email: ev.target.value,
        });
    },

    async onEmailValidate(fieldState) {
        const result = await this.validateEmailRules(fieldState);
        this.markFieldValid(FIELD_EMAIL, result.valid);
        return result;
    },

    validateEmailRules: withValidation({
        description: () => _t("Use an email address to recover your account"),
        rules: [
            {
                key: "required",
                test: function ({ value, allowEmpty }) {
                    return allowEmpty || !true || !!value;
                },
                invalid: () =>
                    _t("Enter email address (required on this homeserver)"),
            },
            {
                key: "email",
                test: ({ value }) => !value || Email.looksValid(value),
                invalid: () => _t("Doesn't look like a valid email address"),
            },
        ],
    }),

    onPasswordChange(ev) {
        this.setState({
            password: ev.target.value,
        });
    },

    onPasswordValidate(result) {
        this.markFieldValid(FIELD_PASSWORD, result.valid);
    },

    onPasswordConfirmChange(ev) {
        this.setState({
            passwordConfirm: ev.target.value,
        });
    },

    async onPasswordConfirmValidate(fieldState) {
        const result = await this.validatePasswordConfirmRules(fieldState);
        this.markFieldValid(FIELD_PASSWORD_CONFIRM, result.valid);
        return result;
    },

    validatePasswordConfirmRules: withValidation({
        rules: [
            {
                key: "required",
                test: ({ value, allowEmpty }) => allowEmpty || !!value,
                invalid: () => _t("Confirm password"),
            },
            {
                key: "match",
                test: function ({ value }) {
                    return !value || value === this.state.password;
                },
                invalid: () => _t("Passwords don't match"),
            },
        ],
    }),

    onUsernameChange(ev) {
        this.setState({
            username: ev.target.value,
        });
    },

    async onUsernameValidate(fieldState) {
        const result = await this.validateUsernameRules(fieldState);
        this.markFieldValid(FIELD_USERNAME, result.valid);
        return result;
    },

    validateUsernameRules: withValidation({
        description: () =>
            _t("Use lowercase letters, numbers, dashes and underscores only"),
        rules: [
            {
                key: "required",
                test: ({ value, allowEmpty }) => allowEmpty || !!value,
                invalid: () => _t("Enter username"),
            },
            {
                key: "safeLocalpart",
                test: ({ value }) => !value || SAFE_LOCALPART_REGEX.test(value),
                invalid: () => _t("Some characters not allowed"),
            },
        ],
    }),

    /**
     * A step is required if all flows include that step.
     *
     * @param {string} step A stage name to check
     * @returns {boolean} Whether it is required
     */
    _authStepIsRequired(step) {
        return this.props.flows.every((flow) => {
            return flow.stages.includes(step);
        });
    },

    /**
     * A step is used if any flows include that step.
     *
     * @param {string} step A stage name to check
     * @returns {boolean} Whether it is used
     */
    _authStepIsUsed(step) {
        return this.props.flows.some((flow) => {
            return flow.stages.includes(step);
        });
    },

    _showEmail() {
        return true;
    },

    renderEmail() {
        if (!this._showEmail()) {
            return null;
        }
        const Field = sdk.getComponent("elements.Field");
        const emailPlaceholder = _t("Email");
        return (
            <Field
                ref={(field) => (this[FIELD_EMAIL] = field)}
                type="text"
                label={emailPlaceholder}
                value={this.state.email}
                onChange={this.onEmailChange}
                onValidate={this.onEmailValidate}
            />
        );
    },

    renderPassword() {
        return (
            <PassphraseField
                id="mx_RegistrationForm_password"
                fieldRef={(field) => (this[FIELD_PASSWORD] = field)}
                minScore={PASSWORD_MIN_SCORE}
                value={this.state.password}
                onChange={this.onPasswordChange}
                onValidate={this.onPasswordValidate}
            />
        );
    },

    renderPasswordConfirm() {
        const Field = sdk.getComponent("elements.Field");
        return (
            <Field
                id="mx_RegistrationForm_passwordConfirm"
                ref={(field) => (this[FIELD_PASSWORD_CONFIRM] = field)}
                type="password"
                autoComplete="new-password"
                label={_t("Confirm")}
                value={this.state.passwordConfirm}
                onChange={this.onPasswordConfirmChange}
                onValidate={this.onPasswordConfirmValidate}
            />
        );
    },

    renderUsername() {
        const Field = sdk.getComponent("elements.Field");
        return (
            <Field
                id="mx_RegistrationForm_username"
                ref={(field) => (this[FIELD_USERNAME] = field)}
                type="text"
                autoFocus={true}
                label={_t("Username")}
                value={this.state.username}
                onChange={this.onUsernameChange}
                onValidate={this.onUsernameValidate}
            />
        );
    },

    render: function () {
        const registerButton = (
            <input
                className="mx_Login_submit"
                type="submit"
                value={_t("Register")}
                disabled={!this.props.canSubmit}
            />
        );

        let emailHelperText = null;
        if (this._showEmail()) {
            emailHelperText = (
                <div>
                    {_t(
                        "Set an email for account recovery. " +
                            "Use email to optionally be discoverable by existing contacts."
                    )}
                </div>
            );
        }
        const haveIs = Boolean(this.props.serverConfig.isUrl);
        let noIsText = null;
        if (this.props.serverRequiresIdServer && !haveIs) {
            noIsText = (
                <div>
                    {_t(
                        "No identity server is configured so you cannot add an email address in order to " +
                            "reset your password in the future."
                    )}
                </div>
            );
        }

        return (
            <div>
                <form onSubmit={this.onSubmit}>
                    <div className="mx_AuthBody_fieldRow">
                        {this.renderUsername()}
                    </div>
                    <div className="mx_AuthBody_fieldRow">
                        {this.renderPassword()}
                        {this.renderPasswordConfirm()}
                    </div>
                    <div className="mx_AuthBody_fieldRow">
                        {this.renderEmail()}
                    </div>
                    {emailHelperText}
                    {noIsText}
                    {registerButton}
                </form>
            </div>
        );
    },
});
