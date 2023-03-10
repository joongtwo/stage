// Copyright (c) 2022 Siemens

/**
 * @module js/MrmDefaultCutCopyService
 */
import appCtxService from 'js/appCtxService';
import ClipboardService from 'js/clipboardService';

var exports = {};

export let mrmCutContentsToClipboard = function( occContext ) {
    // call set content
    ClipboardService.instance.setContents( occContext.selectedModelObjects );
    //populate cut intent
    appCtxService.updatePartialCtx( 'cutIntent', true );
};

export default exports = {
    mrmCutContentsToClipboard
};
