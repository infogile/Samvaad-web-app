import * as React from "react";
import { createRef } from "react";
import Profile from "./Profile.js";
import PlatformPeg from "../../PlatformPeg";
import * as KeyboardShortcuts from "../../accessibility/KeyboardShortcuts";
import * as sdk from "../../index";
import { DragDropContext } from "react-beautiful-dnd";
import Navigation from "./BottomNavigation";
import RoomListActions from "../../actions/RoomListActions";
import TagOrderActions from "../../actions/TagOrderActions";
import RoomSearch from "./RoomSearch";
import RoomList from "../views/rooms/RoomList";
import * as PropTypes from "prop-types";
import { MatrixClient } from "matrix-js-sdk/src/client";
import MatrixClientContext from "../../contexts/MatrixClientContext";
import { MatrixClientPeg, IMatrixClientCreds } from "../../MatrixClientPeg";
import ResizeNotifier from "../../utils/ResizeNotifier";
import SettingsStore from "../../settings/SettingsStore";
import CallMediaHandler from "../../CallMediaHandler";
import ResizeHandle from "../views/elements/ResizeHandle";
import sessionStore from "../../stores/SessionStore";
import { Resizer, CollapseDistributor } from "../../resizer";
import CallContainer from "../views/voip/CallContainer";
import NonUrgentToastContainer from "./NonUrgentToastContainer";
import {
    showToast as showSetPasswordToast,
    hideToast as hideSetPasswordToast,
} from "../../toasts/SetPasswordToast";
import dis from "../../dispatcher/dispatcher";
import RoomListStore from "../../stores/room-list/RoomListStore";
import {
    showToast as showServerLimitToast,
    hideToast as hideServerLimitToast,
} from "../../toasts/ServerLimitToast";
import { DefaultTagID } from "../../stores/room-list/models";
import { Action } from "../../dispatcher/actions";
import {
    Key,
    isOnlyCtrlOrCmdKeyEvent,
    isOnlyCtrlOrCmdIgnoreShiftKeyEvent,
} from "../../Keyboard";
import ChatView from "./ChatView";
import { ViewRoomDeltaPayload } from "../../dispatcher/payloads/ViewRoomDeltaPayload";

import { ToggleRightPanelPayload } from "../../dispatcher/payloads/ToggleRightPanelPayload";
const MAX_PINNED_NOTICES_PER_ROOM = 2;

function canElementReceiveInput(el) {
    return (
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT" ||
        !!el.getAttribute("contenteditable")
    );
}

interface IProps {
    matrixClient: MatrixClient;
    onRegistered: (credentials: IMatrixClientCreds) => Promise<MatrixClient>;
    viaServers?: string[];
    hideToSRUsers: boolean;
    resizeNotifier: ResizeNotifier;
    middleDisabled: boolean;
    initialEventPixelOffset: number;
    leftDisabled: boolean;
    rightDisabled: boolean;
    page_type: string;
    autoJoin: boolean;
    thirdPartyInvite?: object;
    roomOobData?: object;
    currentRoomId: string;
    ConferenceHandler?: object;
    collapseLhs: boolean;
    config: {
        piwik: {
            policyUrl: string;
        };
        [key: string]: any;
    };
    currentUserId?: string;
    currentGroupId?: string;
    currentGroupIsNew?: boolean;
}

interface IUsageLimit {
    limit_type: "monthly_active_user" | string;
    admin_contact?: string;
}

interface IState {
    mouseDown?: {
        x: number;
        y: number;
    };
    syncErrorData?: {
        error: {
            data: IUsageLimit;
            errcode: string;
        };
    };
    usageLimitEventContent?: IUsageLimit;
    useCompactLayout: boolean;
}

export default class LoggedInView extends React.Component<IProps, IState> {
    static displayName = "BaseInView";

    static propTypes = {
        matrixClient: PropTypes.instanceOf(MatrixClient).isRequired,
        page_type: PropTypes.string.isRequired,
        onRoomCreated: PropTypes.func,

        // Called with the credentials of a registered user (if they were a ROU that
        // transitioned to PWLU)
        onRegistered: PropTypes.func,

        // Used by the RoomView to handle joining rooms
        viaServers: PropTypes.arrayOf(PropTypes.string),

        // and lots and lots of other stuff.
    };
    protected readonly _matrixClient: MatrixClient;
    protected readonly _roomView: React.RefObject<any>;
    protected readonly _resizeContainer: React.RefObject<ResizeHandle>;
    protected readonly _sessionStore: sessionStore;
    protected readonly _sessionStoreToken: { remove: () => void };
    protected readonly _compactLayoutWatcherRef: string;
    protected resizer: Resizer;
    private focusedElement = null;
    private listContainerRef: React.RefObject<HTMLDivElement> = createRef();

    componentDidMount() {
        // this.resizer = this._createResizer();
        // this.resizer.attach();
        // this._loadResizerPreferences();
        console.log(this.props);
    }

    componentWillUnmount() {
        document.removeEventListener("keydown", this._onNativeKeyDown, false);
        this._matrixClient.removeListener("accountData", this.onAccountData);
        this._matrixClient.removeListener("sync", this.onSync);
        this._matrixClient.removeListener(
            "RoomState.events",
            this.onRoomStateEvents
        );
        SettingsStore.unwatchSetting(this._compactLayoutWatcherRef);
        if (this._sessionStoreToken) {
            this._sessionStoreToken.remove();
        }
        this.resizer.detach();
    }

    shouldComponentUpdate() {
        return Boolean(MatrixClientPeg.get());
    }

    canResetTimelineInRoom = (roomId) => {
        if (!this._roomView.current) {
            return true;
        }
        return this._roomView.current.canResetTimeline();
    };

    _setStateFromSessionStore = () => {
        if (this._sessionStore.getCachedPassword()) {
            showSetPasswordToast();
        } else {
            hideSetPasswordToast();
        }
    };

    _createResizer() {
        const classNames = {
            handle: "mx_ResizeHandle",
            vertical: "mx_ResizeHandle_vertical",
            reverse: "mx_ResizeHandle_reverse",
        };
        const collapseConfig = {
            toggleSize: 260 - 50,
            onCollapsed: (collapsed) => {
                if (collapsed) {
                    dis.dispatch({ action: "hide_left_panel" }, true);
                    window.localStorage.setItem("mx_lhs_size", "0");
                } else {
                    dis.dispatch({ action: "show_left_panel" }, true);
                }
            },
            onResized: (size) => {
                window.localStorage.setItem("mx_lhs_size", "" + size);
                this.props.resizeNotifier.notifyLeftHandleResized();
            },
        };
        const resizer = new Resizer(
            this._resizeContainer.current,
            CollapseDistributor,
            collapseConfig
        );
        resizer.setClassNames(classNames);
        return resizer;
    }

    _loadResizerPreferences() {
        let lhsSize = parseInt(window.localStorage.getItem("mx_lhs_size"), 10);
        if (isNaN(lhsSize)) {
            lhsSize = 350;
        }
        this.resizer.forHandleAt(0).resize(lhsSize);
    }

    onAccountData = (event) => {
        if (event.getType() === "m.ignored_user_list") {
            dis.dispatch({ action: "ignore_state_changed" });
        }
    };

    onCompactLayoutChanged = (
        setting,
        roomId,
        level,
        valueAtLevel,
        newValue
    ) => {
        this.setState({
            useCompactLayout: valueAtLevel,
        });
    };

    onSync = (syncState, oldSyncState, data) => {
        const oldErrCode =
            this.state.syncErrorData &&
            this.state.syncErrorData.error &&
            this.state.syncErrorData.error.errcode;
        const newErrCode = data && data.error && data.error.errcode;
        if (syncState === oldSyncState && oldErrCode === newErrCode) return;

        if (syncState === "ERROR") {
            this.setState({
                syncErrorData: data,
            });
        } else {
            this.setState({
                syncErrorData: null,
            });
        }

        if (oldSyncState === "PREPARED" && syncState === "SYNCING") {
            this._updateServerNoticeEvents();
        } else {
            this._calculateServerLimitToast(
                this.state.syncErrorData,
                this.state.usageLimitEventContent
            );
        }
    };

    onRoomStateEvents = (ev, state) => {
        const serverNoticeList =
            RoomListStore.instance.orderedLists[DefaultTagID.ServerNotice];
        if (
            serverNoticeList &&
            serverNoticeList.some((r) => r.roomId === ev.getRoomId())
        ) {
            this._updateServerNoticeEvents();
        }
    };

    _calculateServerLimitToast(
        syncErrorData: IState["syncErrorData"],
        usageLimitEventContent?: IUsageLimit
    ) {
        const error =
            syncErrorData &&
            syncErrorData.error &&
            syncErrorData.error.errcode === "M_RESOURCE_LIMIT_EXCEEDED";
        if (error) {
            usageLimitEventContent = syncErrorData.error.data;
        }

        if (usageLimitEventContent) {
            showServerLimitToast(
                usageLimitEventContent.limit_type,
                usageLimitEventContent.admin_contact,
                error
            );
        } else {
            hideServerLimitToast();
        }
    }

    _updateServerNoticeEvents = async () => {
        const serverNoticeList =
            RoomListStore.instance.orderedLists[DefaultTagID.ServerNotice];
        if (!serverNoticeList) return [];

        const events = [];
        for (const room of serverNoticeList) {
            const pinStateEvent = room.currentState.getStateEvents(
                "m.room.pinned_events",
                ""
            );

            if (!pinStateEvent || !pinStateEvent.getContent().pinned) continue;

            const pinnedEventIds = pinStateEvent
                .getContent()
                .pinned.slice(0, MAX_PINNED_NOTICES_PER_ROOM);
            for (const eventId of pinnedEventIds) {
                const timeline = await this._matrixClient.getEventTimeline(
                    room.getUnfilteredTimelineSet(),
                    eventId,
                    0
                );
                const event = timeline
                    .getEvents()
                    .find((ev) => ev.getId() === eventId);
                if (event) events.push(event);
            }
        }

        const usageLimitEvent = events.find((e) => {
            return (
                e &&
                e.getType() === "m.room.message" &&
                e.getContent()["server_notice_type"] ===
                    "m.server_notice.usage_limit_reached"
            );
        });
        const usageLimitEventContent =
            usageLimitEvent && usageLimitEvent.getContent();
        this._calculateServerLimitToast(
            this.state.syncErrorData,
            usageLimitEventContent
        );
        this.setState({ usageLimitEventContent });
    };

    _onPaste = (ev) => {
        let canReceiveInput = false;
        let element = ev.target;
        // test for all parents because the target can be a child of a contenteditable element
        while (!canReceiveInput && element) {
            canReceiveInput = canElementReceiveInput(element);
            element = element.parentElement;
        }
        if (!canReceiveInput) {
            // refocusing during a paste event will make the
            // paste end up in the newly focused element,
            // so dispatch synchronously before paste happens
            dis.fire(Action.FocusComposer, true);
        }
    };
    _onReactKeyDown = (ev) => {
        // events caught while bubbling up on the root element
        // of this component, so something must be focused.
        this._onKeyDown(ev);
    };

    _onNativeKeyDown = (ev) => {
        // only pass this if there is no focused element.
        // if there is, _onKeyDown will be called by the
        // react keydown handler that respects the react bubbling order.
        if (ev.target === document.body) {
            this._onKeyDown(ev);
        }
    };

    _onKeyDown = (ev) => {
        let handled = false;
        const ctrlCmdOnly = isOnlyCtrlOrCmdKeyEvent(ev);
        const hasModifier =
            ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey;
        const isModifier =
            ev.key === Key.ALT ||
            ev.key === Key.CONTROL ||
            ev.key === Key.META ||
            ev.key === Key.SHIFT;

        switch (ev.key) {
            case Key.PAGE_UP:
            case Key.PAGE_DOWN:
                if (!hasModifier && !isModifier) {
                    this._onScrollKeyPressed(ev);
                    handled = true;
                }
                break;

            case Key.HOME:
            case Key.END:
                if (ev.ctrlKey && !ev.shiftKey && !ev.altKey && !ev.metaKey) {
                    this._onScrollKeyPressed(ev);
                    handled = true;
                }
                break;
            case Key.K:
                if (ctrlCmdOnly) {
                    dis.dispatch({
                        action: "focus_room_filter",
                    });
                    handled = true;
                }
                break;
            case Key.BACKTICK:
                // Ideally this would be CTRL+P for "Profile", but that's
                // taken by the print dialog. CTRL+I for "Information"
                // was previously chosen but conflicted with italics in
                // composer, so CTRL+` it is

                if (ctrlCmdOnly) {
                    dis.fire(Action.ToggleUserMenu);
                    handled = true;
                }
                break;

            case Key.SLASH:
                if (isOnlyCtrlOrCmdIgnoreShiftKeyEvent(ev)) {
                    KeyboardShortcuts.toggleDialog();
                    handled = true;
                }
                break;

            case Key.ARROW_UP:
            case Key.ARROW_DOWN:
                if (ev.altKey && !ev.ctrlKey && !ev.metaKey) {
                    dis.dispatch<ViewRoomDeltaPayload>({
                        action: Action.ViewRoomDelta,
                        delta: ev.key === Key.ARROW_UP ? -1 : 1,
                        unread: ev.shiftKey,
                    });
                    handled = true;
                }
                break;

            case Key.PERIOD:
                if (
                    ctrlCmdOnly &&
                    (this.props.page_type === "room_view" ||
                        this.props.page_type === "group_view")
                ) {
                    dis.dispatch<ToggleRightPanelPayload>({
                        action: Action.ToggleRightPanel,
                        type:
                            this.props.page_type === "room_view"
                                ? "room"
                                : "group",
                    });
                    handled = true;
                }
                break;

            default:
                // if we do not have a handler for it, pass it to the platform which might
                handled = PlatformPeg.get().onKeyDown(ev);
        }

        if (handled) {
            ev.stopPropagation();
            ev.preventDefault();
        } else if (!isModifier && !ev.altKey && !ev.ctrlKey && !ev.metaKey) {
            // The above condition is crafted to _allow_ characters with Shift
            // already pressed (but not the Shift key down itself).

            const isClickShortcut =
                ev.target !== document.body &&
                (ev.key === Key.SPACE || ev.key === Key.ENTER);

            // Do not capture the context menu key to improve keyboard accessibility
            if (ev.key === Key.CONTEXT_MENU) {
                return;
            }

            if (
                !isClickShortcut &&
                ev.key !== Key.TAB &&
                !canElementReceiveInput(ev.target)
            ) {
                // synchronous dispatch so we focus before key generates input
                dis.fire(Action.FocusComposer, true);
                ev.stopPropagation();
                // we should *not* preventDefault() here as
                // that would prevent typing in the now-focussed composer
            }
        }
    };

    /**
     * dispatch a page-up/page-down/etc to the appropriate component
     * @param {Object} ev The key event
     */
    _onScrollKeyPressed = (ev) => {
        if (this._roomView.current) {
            this._roomView.current.handleScrollKey(ev);
        }
    };

    _onDragEnd = (result) => {
        // Dragged to an invalid destination, not onto a droppable
        if (!result.destination) {
            return;
        }

        const dest = result.destination.droppableId;

        if (dest === "tag-panel-droppable") {
            // Could be "GroupTile +groupId:domain"
            const draggableId = result.draggableId.split(" ").pop();

            // Dispatch synchronously so that the TagPanel receives an
            // optimistic update from TagOrderStore before the previous
            // state is shown.
            dis.dispatch(
                TagOrderActions.moveTag(
                    this._matrixClient,
                    draggableId,
                    result.destination.index
                ),
                true
            );
        } else if (dest.startsWith("room-sub-list-droppable_")) {
            this._onRoomTileEndDrag(result);
        }
    };

    _onRoomTileEndDrag = (result) => {
        let newTag = result.destination.droppableId.split("_")[1];
        let prevTag = result.source.droppableId.split("_")[1];
        if (newTag === "undefined") newTag = undefined;
        if (prevTag === "undefined") prevTag = undefined;

        const roomId = result.draggableId.split("_")[1];

        const oldIndex = result.source.index;
        const newIndex = result.destination.index;

        dis.dispatch(
            RoomListActions.tagRoom(
                this._matrixClient,
                this._matrixClient.getRoom(roomId),
                prevTag,
                newTag,
                oldIndex,
                newIndex
            ),
            true
        );
    };

    _onMouseDown = (ev) => {
        // When the panels are disabled, clicking on them results in a mouse event
        // which bubbles to certain elements in the tree. When this happens, close
        // any settings page that is currently open (user/room/group).
        if (this.props.leftDisabled && this.props.rightDisabled) {
            const targetClasses = new Set(ev.target.className.split(" "));
            if (
                targetClasses.has("mx_MatrixChat") ||
                targetClasses.has("mx_MatrixChat_middlePanel") ||
                targetClasses.has("mx_RoomView")
            ) {
                this.setState({
                    mouseDown: {
                        x: ev.pageX,
                        y: ev.pageY,
                    },
                });
            }
        }
    };

    _onMouseUp = (ev) => {
        if (!this.state.mouseDown) return;

        const deltaX = ev.pageX - this.state.mouseDown.x;
        const deltaY = ev.pageY - this.state.mouseDown.y;
        const distance = Math.sqrt(deltaX * deltaX + (deltaY + deltaY));
        const maxRadius = 5; // People shouldn't be straying too far, hopefully

        // Note: we track how far the user moved their mouse to help
        // combat against https://github.com/vector-im/element-web/issues/7158

        if (distance < maxRadius) {
            // This is probably a real click, and not a drag
            dis.dispatch({ action: "close_settings" });
        }

        // Always clear the mouseDown state to ensure we don't accidentally
        // use stale values due to the mouseDown checks.
        this.setState({ mouseDown: null });
    };

    private onFocus = (ev: React.FocusEvent) => {
        this.focusedElement = ev.target;
    };

    private onBlur = () => {
        this.focusedElement = null;
    };
    private onResize = () => {
        if (!this.listContainerRef.current) return; // ignore: no headers to sticky
    };

    private onKeyDown = (ev: React.KeyboardEvent) => {
        if (!this.focusedElement) return;

        switch (ev.key) {
            case Key.ARROW_UP:
            case Key.ARROW_DOWN:
                ev.stopPropagation();
                ev.preventDefault();
                this.onMoveFocus(ev.key === Key.ARROW_UP);
                break;
        }
    };
    private onMoveFocus = (up: boolean) => {
        let element = this.focusedElement;
        element.focus();
        this.focusedElement = element;
    };

    private onEnter = () => {
        const firstRoom = this.listContainerRef.current.querySelector<
            HTMLDivElement
        >(".mx_RoomTile");
        if (firstRoom) {
            firstRoom.click();
            return true; // to get the field to clear
        }
        // console.log("Enter")
        // return;
    };
    private renderSearchExplore(): React.ReactNode {
        return (
            <div
                className="mx_LeftPanel_filterContainer"
                onFocus={this.onFocus}
                onBlur={this.onBlur}
                onKeyDown={this.onKeyDown}
                style={{ width: "80%" }}
            >
                <RoomSearch
                    isMinimized={false}
                    onVerticalArrow={this.onKeyDown}
                    onEnter={this.onEnter}
                />
            </div>
        );
    }

    render(): React.ReactNode {
        const roomList = (
            <RoomList
                onKeyDown={this.onKeyDown}
                resizeNotifier={null}
                collapsed={false}
                onFocus={this.onFocus}
                onBlur={this.onBlur}
                isMinimized={false}
                onResize={this.onResize}
            />
        );
        let pageElement;
        switch (this.props.page_type) {
            case "home_page":
                pageElement = (
                    <>
                        <div
                            style={{
                                width: "100%",
                                height: "100px",
                                background: "#f1f1f1",
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                            }}
                        >
                            {this.renderSearchExplore()}
                        </div>
                        {roomList}
                        <Navigation
                            page_type={this.props.page_type}
                            dis={dis}
                        />
                    </>
                );
                break;
            case "profile_page":
                pageElement = (
                    <Profile page_type={this.props.page_type} dis={dis} />
                );
                break;
            default:
                pageElement = <ChatView {...this.props} />;
                break;
        }
        return (
            <>
                {this.props.page_type === "home_page" || "profile_page" ? (
                    <>{pageElement}</>
                ) : null}
            </>
        );
    }
}
