// @<COPYRIGHT>@
// ==================================================
// Copyright 2018.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import MfeLoadingMessage from 'viewmodel/MfeLoadingMessageViewModel';
/**
 *
 * @param {viewModel} viewModel
 * @returns {Object}
 */
export function videoViewerRenderFn( props ) {
    // let loadingDiv = <div className='aw-jswidgets-text'>{viewModel.data.loadingMsg}</div>;
    return (
        <div id='workinstr-video-viewer' className='aw-workinstr-viewerStyle'>
            <MfeLoadingMessage className='aw-workinstr-viewerStyle'></MfeLoadingMessage>
            <video autoPlay controls className='h-12 w-12 aw-workinstr-hidden' onLoadedData={contentLoadComplete}>
                <source src={props.subPanelContext.fileData.fileUrl} type='video/mp4'></source>
                <source src={props.subPanelContext.fileData.fileUrl} type='video/ogg'></source>
                <source src={props.subPanelContext.fileData.fileUrl} type='video/webm'></source>
                <track kind='captions'></track>
            </video>

        </div>
    );
}

const contentLoadComplete = function( props ) {
    props.target.classList.remove( 'aw-workinstr-hidden' );
    props.target.previousElementSibling.remove();
};


export default {
    videoViewerRenderFn
};
