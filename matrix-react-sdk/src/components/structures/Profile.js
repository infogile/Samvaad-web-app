import React, { createRef } from "react";
import { _t } from "../../languageHandler";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import Field from "../views/elements/Field";
import { User } from "matrix-js-sdk";
import * as sdk from "../../index";
import Navigation from "./BottomNavigation";
import GeneralUserSettingsTab from "../views/settings/tabs/user/GeneralUserSettingsTab";
import { getThreepidsWithBindStatus } from "../../../src/boundThreepids";
import "./profile.css";
export default class ProfileSettings extends React.Component {
    constructor() {
        super();

        const client = MatrixClientPeg.get();
        let user = client.getUser(client.getUserId());
        if (!user) {
            // XXX: We shouldn't have to do this.
            // There seems to be a condition where the User object won't exist until a room
            // exists on the account. To work around this, we'll just create a temporary User
            // and use that.
            console.warn(
                "User object not found - creating one for ProfileSettings"
            );
            user = new User(client.getUserId());
        }
        let avatarUrl = user.avatarUrl;
        if (avatarUrl) {
            avatarUrl = client.mxcUrlToHttp(avatarUrl, 96, 96, "crop", false);
        }
        this.state = {
            userId: user.userId,
            originalDisplayName: user.rawDisplayName,
            displayName: user.rawDisplayName,
            originalAvatarUrl: avatarUrl,
            avatarUrl: avatarUrl,
            avatarFile: null,
            enableProfileSave: false,
            emails: [],
            loading3pids: true,
        };

        this._avatarUpload = createRef();
    }

    // TODO: [REACT-WARNING] Move this to constructor
    async UNSAFE_componentWillMount() {
        // eslint-disable-line camelcase
        this._getThreepidState();
    }

    _uploadAvatar = () => {
        this._avatarUpload.current.click();
    };

    _removeAvatar = () => {
        // clear file upload field so same file can be selected
        this._avatarUpload.current.value = "";
        this.setState({
            avatarUrl: undefined,
            avatarFile: undefined,
            enableProfileSave: true,
        });
    };

    _saveProfile = async (e) => {
        e.stopPropagation();
        e.preventDefault();
        console.log("Saving...2");
        console.log(this.state);
        console.log(this.state.enableProfileSave);
        if (!this.state.enableProfileSave) return;
        this.setState({ enableProfileSave: false });

        const client = MatrixClientPeg.get();
        const newState = {};

        // TODO: What do we do about errors?

        if (this.state.originalDisplayName !== this.state.displayName) {
            await client.setDisplayName(this.state.displayName);
            newState.originalDisplayName = this.state.displayName;
        }
        console.log("saving 3");
        if (this.state.avatarFile) {
            const uri = await client.uploadContent(this.state.avatarFile);
            await client.setAvatarUrl(uri);
            newState.avatarUrl = client.mxcUrlToHttp(
                uri,
                96,
                96,
                "crop",
                false
            );
            newState.originalAvatarUrl = newState.avatarUrl;
            newState.avatarFile = null;
        } else if (this.state.originalAvatarUrl !== this.state.avatarUrl) {
            await client.setAvatarUrl(""); // use empty string as Synapse 500s on undefined
        }
        console.log("saving 4");

        this.setState(newState);
        console.log(newState);
    };

    _onDisplayNameChanged = (e) => {
        this.setState({
            displayName: e.target.value,
            enableProfileSave: true,
        });
    };

    _onAvatarChanged = (e) => {
        if (!e.target.files || !e.target.files.length) {
            this.setState({
                avatarUrl: this.state.originalAvatarUrl,
                avatarFile: null,
                enableProfileSave: false,
            });
            return;
        }

        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
            this.setState({
                avatarUrl: ev.target.result,
                avatarFile: file,
                enableProfileSave: true,
            });
            this._saveProfile(e);
        };
        reader.readAsDataURL(file);
    };
    async _getThreepidState() {
        const cli = MatrixClientPeg.get();
        // Check to see if terms need accepting
        // this._checkTerms();

        // Need to get 3PIDs generally for Account section and possibly also for
        // Discovery (assuming we have an IS and terms are agreed).
        let threepids = [];
        try {
            threepids = await getThreepidsWithBindStatus(cli);
        } catch (e) {
            const idServerUrl = MatrixClientPeg.get().getIdentityServerUrl();
            console.warn(
                `Unable to reach identity server at ${idServerUrl} to check ` +
                    `for 3PIDs bindings in Settings`
            );
            console.warn(e);
        }
        this.setState({
            emails: threepids.filter((a) => a.medium === "email"),
            loading3pids: false,
        });
    }

    render() {
        // const AccessibleButton = sdk.getComponent("elements.AccessibleButton");
        // const AvatarSetting = sdk.getComponent("settings.AvatarSetting");
        return (
            <>
                <GeneralUserSettingsTab
                    closeSettingsFn={() => {
                        console.log("closeSettingFn");
                    }}
                />
                <Navigation
                    page_type={this.props.page_type}
                    dis={this.props.dis}
                />

                {/*
<form
                onSubmit={this._saveProfile}
                autoComplete="off"
                noValidate={true}
            >
                <input
                    type="file"
                    ref={this._avatarUpload}
                    className="mx_ProfileSettings_avatarUpload"
                    onChange={this._onAvatarChanged}
                    accept="image/*"
                />
                <div className="mx_ProfileSettings_profile">
                    <div className="mx_ProfileSettings_controls">
                        <p>{this.state.userId}</p>
                        <Field
                            label={_t("Display Name")}
                            type="text"
                            value={this.state.displayName}
                            autoComplete="off"
                            onChange={this._onDisplayNameChanged}
                        />
                    </div>
                    <AvatarSetting
                        avatarUrl={this.state.avatarUrl}
                        avatarName={this.state.displayName || this.state.userId}
                        avatarAltText={_t("Profile picture")}
                        uploadAvatar={this._uploadAvatar}
                        removeAvatar={this._removeAvatar}
                    />
                </div>
                <AccessibleButton
                    onClick={this._saveProfile}
                    kind="primary"
                    disabled={!this.state.enableProfileSave}
                >
                    {_t("Save")}
                </AccessibleButton>
            </form> */}
            </>
        );
    }
}
