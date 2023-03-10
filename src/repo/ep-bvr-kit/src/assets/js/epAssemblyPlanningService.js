// Copyright (c) 2022 Siemens

/**
 * @module js/epAssemblyPlanningService
 */
import localeService from 'js/localeService';
import appCtxService from 'js/appCtxService';
import { constants as _epBvrConstants } from 'js/epBvrConstants';
import mfeTypeUtils from 'js/utils/mfeTypeUtils';

const EP_SCOPE_OBJECT = 'ep.scopeObject';

/**
 * Updates Assembly tab name depending on loaded scope type
 * @param {Object} assemlyTabContext the assemly Tab Context 
 */
export function initializeAssemblyTabName( assemlyTabContext ) {
    const scopeObject = appCtxService.getCtx( EP_SCOPE_OBJECT );
    if( !mfeTypeUtils.isOfType( scopeObject, _epBvrConstants.MFG_BVR_PROCESS ) ) {
        const localTextBundle = localeService.getLoadedText( 'AssemblyMessages' );
        const targetAssembliesTitle = localTextBundle.targetAssembliesTitle;
        assemlyTabContext.name = targetAssembliesTitle;
    }
}

let exports;
export default exports = {
    initializeAssemblyTabName
};
