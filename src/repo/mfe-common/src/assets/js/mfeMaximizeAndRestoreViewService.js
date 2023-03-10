// Copyright (c) 2022 Siemens

import appCtxService from 'js/appCtxService';

/**
 * Maximize and Restore view service
 *
 * @module js/mfeMaximizeAndRestoreViewService
 */

/**
 * toggle maximize/Restore vertically
 */
export function maximizeRestoreViewVertically() {
    if( appCtxService.getCtx( 'maximizedVertically' ) ) {
        appCtxService.unRegisterCtx( 'maximizedVertically' );
    } else {
        appCtxService.updatePartialCtx( 'maximizedVertically', true );
    }
}


let exports = {};
export default exports = {
    maximizeRestoreViewVertically
};
