// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Services for author Plant
 *
 * @module js/epAuthorPlantService
 */

import appCtxService from 'js/appCtxService';

/**
 * To update context values as needed for Add in ACE BOE page
 */
export function updateParentElementOnCtx() {
    let aceActiveContext = appCtxService.getCtx( 'aceActiveContext' );
    let selected = appCtxService.getCtx( 'selected' );
    if( !aceActiveContext.context.addElement ) {
        appCtxService.updatePartialCtx( 'aceActiveContext.context.addElement', {} );
    }
    appCtxService.updatePartialCtx( 'aceActiveContext.context.addElement.parent', selected );
}

let exports = {};

export default exports = {
    updateParentElementOnCtx
};
