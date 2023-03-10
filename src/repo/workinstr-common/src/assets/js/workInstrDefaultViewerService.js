// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 *Render default viewer
 *@param {Object} props props
 * @returns {Object} return rendered object
 */
export function renderDefaultViewer( props ) {
    let  clickHereToOpen = props.i18n.clickHereToOpen;
    let fileOpenedInExtViewer = props.i18n.fileOpenedInExtViewer;
    let fileUrl = props.subPanelContext && props.subPanelContext.fileData ? props.subPanelContext.fileData.fileUrl : null;
    let fileName = props.subPanelContext && props.subPanelContext.datasetData && props.subPanelContext.datasetData.props.ref_list ? props.subPanelContext.datasetData.props.ref_list.displayValues[0] : null;

    let linkElem = null;
    let messageTextElem = null;
    if ( clickHereToOpen && fileUrl && fileOpenedInExtViewer && fileName ) {
        let messageText = fileOpenedInExtViewer.replace( '{0}', fileName );
        messageTextElem = <div className='sw-row aw-workinstr-instructionStyle justify-center'>{ messageText }</div>;
        linkElem = <a href={ fileUrl } className='sw-row aw-workinstr-instructionStyle justify-center'>{ clickHereToOpen }</a>;
    }
    return (
        <div className='sw-column h-12 w-12 justify-center'>
            {messageTextElem ? messageTextElem : ''}
            {linkElem ? linkElem : ''}
        </div>
    );
}

export default {
    renderDefaultViewer
};
