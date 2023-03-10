
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
export function renderStringViewer( props ) {
    return (
        <div className='aw-workinstr-viewerStyle aw-viewerjs-scroll' id='stringViewer'></div>
    );
}

/**
 *
 * @param {Object} subPanelContext  subPanelContext
 */
export function initStringViewer( subPanelContext ) {
    let element = subPanelContext.viewerRef.current.querySelector( 'div#stringViewer' );
    let stringContent  = subPanelContext && subPanelContext.datasetData ? subPanelContext.datasetData.value : null;
    stringContent = '<div id="stringContent">' + stringContent + '</div>';
    stringContent = stringToHTML( stringContent ).getElementById( 'stringContent' );
    element.appendChild( stringContent );
}
/**
 * @param {String} stringContent  stringContent
 * @returns {Object} domelement
 */
function stringToHTML( stringContent ) {
    let parser = new DOMParser();
    return parser.parseFromString( stringContent, 'text/html' );
}

export default {
    renderStringViewer,
    initStringViewer
};

