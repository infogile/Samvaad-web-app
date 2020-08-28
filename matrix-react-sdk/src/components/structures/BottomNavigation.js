import React from "react";
import { Home as HomeIcon, Person as PersonIcon } from "@material-ui/icons";
import { BottomNavigation, BottomNavigationAction } from "@material-ui/core";

class Navigation extends React.PureComponent {
    render() {
        return (
            <BottomNavigation
                value={this.props.page_type}
                showLabels
                style={{
                    width: "100%",
                    height: "auto",
                    position: "absolute",
                    bottom: 0,
                    display:
                        this.props.page_type === "home_page" || "profile_page"
                            ? "flex"
                            : "none",
                }}
            >
                <BottomNavigationAction
                    label="Home"
                    value="home_page"
                    icon={<HomeIcon />}
                    style={{ maxWidth: "none" }}
                    onClick={() => {
                        this.props.dis.dispatch({ action: "view_home_page" });
                    }}
                />
                <BottomNavigationAction
                    label="Profile"
                    value="profile_page"
                    icon={<PersonIcon />}
                    style={{ maxWidth: "none" }}
                    onClick={() => {
                        this.props.dis.dispatch({
                            action: "view_profile_page",
                        });
                    }}
                />
            </BottomNavigation>
        );
    }
}

export default Navigation;
