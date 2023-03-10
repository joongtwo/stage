// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/cbaPageViewService
 */

import appCtxSvc from 'js/appCtxService';
import cbaConstants from 'js/cbaConstants';
import CadBomOccurrenceAlignmentUtil from 'js/CadBomOccurrenceAlignmentUtil';
import CadBomOccAlignmentCheckService from 'js/CadBomOccAlignmentCheckService';

/**
 * Clean up CBA specific variable from context
 */
let _unRegisterCbaVariable = function() {
    let doNotClearCBACtxVars = appCtxSvc.getCtx( cbaConstants.CTX_PATH_DO_NOT_CLEAR_CBA_VARS );
    if ( doNotClearCBACtxVars ) {
        appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_DO_NOT_CLEAR_CBA_VARS, false );
        return;
    }

    appCtxSvc.unRegisterCtx( 'modelObjectsToOpen' );
    CadBomOccurrenceAlignmentUtil.unRegisterSplitViewMode();
    appCtxSvc.unRegisterCtx( 'taskUI' );
    appCtxSvc.unRegisterCtx( 'cbaContext' );
    appCtxSvc.unRegisterCtx( 'cadbomalignment' );

    appCtxSvc.unRegisterCtx( 'aceActiveContext' );
    appCtxSvc.updateCtx( 'hideRightWall', undefined );
    CadBomOccAlignmentCheckService.unRegisterService();

    appCtxSvc.updatePartialCtx( 'taskbarfullscreen', false );
    appCtxSvc.unRegisterCtx( 'hiddenCommands' );
};

export const destroyCbaPageView = ( ) => {
    _unRegisterCbaVariable();
};

const exports = {
    destroyCbaPageView
};
export default exports;
