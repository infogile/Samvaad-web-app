import React from "react";
import PropTypes from "prop-types";
import createReactClass from "create-react-class";
import * as sdk from "matrix-react-sdk";

export default createReactClass({
    displayName: "AuthHeader",

    propTypes: {
        disableLanguageSelector: PropTypes.bool,
    },

    render: function () {
        const AuthHeaderLogo = sdk.getComponent("auth.AuthHeaderLogo");
        const LanguageSelector = sdk.getComponent(
            "views.auth.LanguageSelector"
        );

        return (
            <div className="mx_AuthHeader">
                <AuthHeaderLogo />
                {/* <LanguageSelector
                    disabled={this.props.disableLanguageSelector}
                /> */}
            </div>
        );
    },
});
