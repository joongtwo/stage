// @<COPYRIGHT>@
// ==================================================
// Copyright 2018.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import MfeLoadingMessage from 'viewmodel/MfeLoadingMessageViewModel';

/**
 *Render default viewer
 *@param {Object} props props
 * @returns {Object} return rendered object
 */
export function renderFullTextViewer( props ) {
    return (
        <div id='workinstr-fulltext-viewer' className='aw-workinstr-viewerStyle'>
            <MfeLoadingMessage className='aw-workinstr-viewerStyle'></MfeLoadingMessage>
            <iframe title='workinstr-fulltext-viewer' className='aw-workinstr-hidden aw-workinstr-viewerStyle aw-viewerjs-scroll' srcDoc={props.ctx.workinstr0FullText.bodyText} onLoad={contentLoadComplete}></iframe>
        </div>
    );
}

const contentLoadComplete = function( props ) {
    props.target.previousElementSibling.remove();
    props.target.classList.remove( 'aw-workinstr-hidden' );
};

export default {
    renderFullTextViewer
};

