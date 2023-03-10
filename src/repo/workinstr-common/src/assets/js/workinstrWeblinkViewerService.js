// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import workinstrFmsSvc from 'js/workinstrFileTicketService';
import MfeLoadingMessage from 'viewmodel/MfeLoadingMessageViewModel';


const contentLoadComplete = function( props ) {
    props.target.classList.remove( 'aw-workinstr-hidden' );
    props.target.previousElementSibling.remove();
};

/**
 * Weblink Viewer Render Function
 *
 * @param {object} props - the props object
 *
 * @returns {Html} a react html element
 */
export const workinstrWeblinkViewerRenderFn = function( props ) {
    const webLinkUrl = workinstrFmsSvc.getUrl( props.subPanelContext.fileData.fileUrl );
    return (
        <div id='workinstr-weblink-viewer' className='aw-workinstr-viewerStyle'>
            <MfeLoadingMessage className='aw-workinstr-viewerStyle'></MfeLoadingMessage>
            <iframe title='workinstr-weblink-viewer' className='aw-workinstr-hidden aw-workinstr-viewerStyle' src={webLinkUrl} onLoad={contentLoadComplete}></iframe>
        </div>
    );
};


export default {
    workinstrWeblinkViewerRenderFn
};
