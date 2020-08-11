import React from "react";
import PropTypes from "prop-types";
import classNames from "classnames";
import * as sdk from "matrix-react-sdk";
import { _t } from "matrix-react-sdk/src/languageHandler";
import SdkConfig from "matrix-react-sdk/src/SdkConfig";
import { ValidatedServerConfig } from "matrix-react-sdk/src/utils/AutoDiscoveryUtils";
import AccessibleButton from "matrix-react-sdk/src/components//views/elements/AccessibleButton";

/**
 * A pure UI component which displays a username/password form.
 */
export default class PasswordLogin extends React.Component {
    static propTypes = {
        onSubmit: PropTypes.func.isRequired, // fn(username, password)
        onError: PropTypes.func,
        onForgotPasswordClick: PropTypes.func, // fn()
        initialUsername: PropTypes.string,
        initialPhoneCountry: PropTypes.string,
        initialPhoneNumber: PropTypes.string,
        initialPassword: PropTypes.string,
        onUsernameChanged: PropTypes.func,
        onPhoneCountryChanged: PropTypes.func,
        onPhoneNumberChanged: PropTypes.func,
        onPasswordChanged: PropTypes.func,
        loginIncorrect: PropTypes.bool,
        disableSubmit: PropTypes.bool,
        serverConfig: PropTypes.instanceOf(ValidatedServerConfig).isRequired,
        busy: PropTypes.bool,
    };

    static defaultProps = {
        onError: function () {},
        onUsernameChanged: function () {},
        onUsernameBlur: function () {},
        onPasswordChanged: function () {},
        onPhoneCountryChanged: function () {},
        onPhoneNumberChanged: function () {},
        onPhoneNumberBlur: function () {},
        initialUsername: "",
        initialPhoneCountry: "",
        initialPhoneNumber: "",
        initialPassword: "",
        loginIncorrect: false,
        disableSubmit: false,
    };

    static LOGIN_FIELD_EMAIL = "login_field_email";
    static LOGIN_FIELD_MXID = "login_field_mxid";
    static LOGIN_FIELD_PHONE = "login_field_phone";

    constructor(props) {
        super(props);
        this.state = {
            username: this.props.initialUsername,
            password: this.props.initialPassword,
            phoneCountry: this.props.initialPhoneCountry,
            phoneNumber: this.props.initialPhoneNumber,
            loginType: PasswordLogin.LOGIN_FIELD_MXID,
        };

        this.onForgotPasswordClick = this.onForgotPasswordClick.bind(this);
        this.onSubmitForm = this.onSubmitForm.bind(this);
        this.onUsernameChanged = this.onUsernameChanged.bind(this);
        this.onUsernameBlur = this.onUsernameBlur.bind(this);
        this.onLoginTypeChange = this.onLoginTypeChange.bind(this);
        this.onPhoneCountryChanged = this.onPhoneCountryChanged.bind(this);
        this.onPhoneNumberChanged = this.onPhoneNumberChanged.bind(this);
        this.onPhoneNumberBlur = this.onPhoneNumberBlur.bind(this);
        this.onPasswordChanged = this.onPasswordChanged.bind(this);
        this.isLoginEmpty = this.isLoginEmpty.bind(this);
    }

    onForgotPasswordClick(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        this.props.onForgotPasswordClick();
    }

    onSubmitForm(ev) {
        ev.preventDefault();

        let username = ""; // XXX: Synapse breaks if you send null here:
        let phoneCountry = null;
        let phoneNumber = null;
        let error;

        switch (this.state.loginType) {
            case PasswordLogin.LOGIN_FIELD_EMAIL:
                username = this.state.username;
                if (!username) {
                    error = _t("The email field must not be blank.");
                }
                break;
            case PasswordLogin.LOGIN_FIELD_MXID:
                username = this.state.username;
                if (!username) {
                    error = _t("The username field must not be blank.");
                }
                break;
            case PasswordLogin.LOGIN_FIELD_PHONE:
                phoneCountry = this.state.phoneCountry;
                phoneNumber = this.state.phoneNumber;
                if (!phoneNumber) {
                    error = _t("The phone number field must not be blank.");
                }
                break;
        }

        if (error) {
            this.props.onError(error);
            return;
        }

        if (!this.state.password) {
            this.props.onError(_t("The password field must not be blank."));
            return;
        }

        this.props.onSubmit(
            username,
            phoneCountry,
            phoneNumber,
            this.state.password
        );
    }

    onUsernameChanged(ev) {
        this.setState({ username: ev.target.value });
        this.props.onUsernameChanged(ev.target.value);
    }

    onUsernameBlur(ev) {
        this.props.onUsernameBlur(ev.target.value);
    }

    onLoginTypeChange(ev) {
        const loginType = ev.target.value;
        this.props.onError(null); // send a null error to clear any error messages
        this.setState({
            loginType: loginType,
            username: "", // Reset because email and username use the same state
        });
    }

    onPhoneCountryChanged(country) {
        this.setState({
            phoneCountry: country.iso2,
            phonePrefix: country.prefix,
        });
        this.props.onPhoneCountryChanged(country.iso2);
    }

    onPhoneNumberChanged(ev) {
        this.setState({ phoneNumber: ev.target.value });
        this.props.onPhoneNumberChanged(ev.target.value);
    }

    onPhoneNumberBlur(ev) {
        this.props.onPhoneNumberBlur(ev.target.value);
    }

    onPasswordChanged(ev) {
        this.setState({ password: ev.target.value });
        this.props.onPasswordChanged(ev.target.value);
    }

    renderLoginField(loginType, autoFocus) {
        const Field = sdk.getComponent("elements.Field");

        const classes = {};
        classes.error = this.props.loginIncorrect && !this.state.username;
        return (
            <Field
                className={classNames(classes)}
                name="username" // make it a little easier for browser's remember-password
                key="email_input"
                type="text"
                label={_t("Email or Username")}
                placeholder="Email or Username"
                value={this.state.username}
                onChange={this.onUsernameChanged}
                onBlur={this.onUsernameBlur}
                disabled={this.props.disableSubmit}
                autoFocus={autoFocus}
            />
        );
    }

    isLoginEmpty() {
        switch (this.state.loginType) {
            case PasswordLogin.LOGIN_FIELD_EMAIL:
            case PasswordLogin.LOGIN_FIELD_MXID:
                return !this.state.username;
            case PasswordLogin.LOGIN_FIELD_PHONE:
                return !this.state.phoneCountry || !this.state.phoneNumber;
        }
    }

    render() {
        const Field = sdk.getComponent("elements.Field");

        let forgotPasswordJsx;

        if (this.props.onForgotPasswordClick) {
            forgotPasswordJsx = (
                <span>
                    {_t(
                        "Not sure of your password? <a>Set a new one</a>",
                        {},
                        {
                            a: (sub) => (
                                <AccessibleButton
                                    className="mx_Login_forgot"
                                    disabled={this.props.busy}
                                    kind="link"
                                    onClick={this.onForgotPasswordClick}
                                >
                                    {sub}
                                </AccessibleButton>
                            ),
                        }
                    )}
                </span>
            );
        }

        const pwFieldClass = classNames({
            error: this.props.loginIncorrect && !this.isLoginEmpty(), // only error password if error isn't top field
        });

        // If login is empty, autoFocus login, otherwise autoFocus password.
        // this is for when auto server discovery remounts us when the user tries to tab from username to password
        const autoFocusPassword = !this.isLoginEmpty();
        const loginField = this.renderLoginField(
            this.state.loginType,
            !autoFocusPassword
        );

        return (
            <div>
                <form onSubmit={this.onSubmitForm}>
                    {loginField}
                    <Field
                        className={pwFieldClass}
                        type="password"
                        name="password"
                        label={_t("Password")}
                        value={this.state.password}
                        onChange={this.onPasswordChanged}
                        disabled={this.props.disableSubmit}
                        autoFocus={autoFocusPassword}
                    />
                    {forgotPasswordJsx}
                    {!this.props.busy && (
                        <input
                            className="mx_Login_submit"
                            type="submit"
                            value={_t("Sign in")}
                            disabled={this.props.disableSubmit}
                        />
                    )}
                </form>
            </div>
        );
    }
}
