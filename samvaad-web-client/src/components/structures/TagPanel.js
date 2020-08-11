import React from "react";
import createReactClass from "create-react-class";

import MatrixClientContext from "matrix-react-sdk/src/contexts/MatrixClientContext";
const TagPanel = createReactClass({
    displayName: "TagPanel",

    statics: {
        contextType: MatrixClientContext,
    },
    render() {
        return (
            <>
                <h1>hti</h1>
            </>
        );
    },
});
export default TagPanel;
