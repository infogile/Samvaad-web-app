/*
Copyright 2019 New Vector Ltd

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
import * as sdk from "../../../index";
import SdkConfig from "../../../SdkConfig";
import AuthPage from "./AuthPage";
import { _td } from "../../../languageHandler";

// translatable strings for Welcome pages
_td("Sign in with SSO");

export default class Welcome extends React.PureComponent {
    render() {
        const EmbeddedPage = sdk.getComponent("structures.EmbeddedPage");
        const LanguageSelector = sdk.getComponent("auth.LanguageSelector");

        const pagesConfig = SdkConfig.get().embeddedPages;
        let pageUrl = null;
        if (pagesConfig) {
            pageUrl = pagesConfig.welcomeUrl;
        }
        if (!pageUrl) {
            pageUrl = "welcome.html";
        }

        return (
            <AuthPage>
                <div className="mx_Welcome">
                    <EmbeddedPage className="mx_WelcomePage" url={pageUrl} />
                </div>
            </AuthPage>
        );
    }
}
