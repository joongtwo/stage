// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import appCtxService from 'js/appCtxService';

/**
 * @module js/mfeReadOnlyService
 */
'use strict';

const CONTEXT_KEY = 'mfgReadOnlyMode';

export const setReadOnlyMode = function( readOnly, message ) {
    const mode = {
        readOnlyMode: readOnly,
        readOnlyMessage: message
    };
    appCtxService.updateCtx( CONTEXT_KEY, mode );

    //this removes the 'home' command for read only mode
    appCtxService.updateCtx( 'goHomeDisabled', readOnly );
};

export const isReadOnlyMode = function() {
    if( appCtxService.getCtx( CONTEXT_KEY ) ) {
        return appCtxService.getCtx( CONTEXT_KEY ).readOnlyMode;
    }
    return false;
};

let exports = {};
export default exports = {
    setReadOnlyMode,
    isReadOnlyMode
};
