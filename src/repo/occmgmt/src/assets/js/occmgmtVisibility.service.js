// Copyright (c) 2022 Siemens

/**
 * Defines {@link NgServices.subLocationService} which provides access to the SubLocationService from native code
 *
 * @module js/occmgmtVisibility.service
 */
import appCtxService from 'js/appCtxService';
import _ from 'lodash';

let exports = {};

export let toggleOccVisibility = function( modelObject, contextKey ) {
    let viewKey = contextKey ? contextKey : appCtxService.ctx.aceActiveContext.key;
    if( appCtxService.ctx[ viewKey ].cellVisibility &&
        appCtxService.ctx[ viewKey ].cellVisibility.toggleOccVisibility ) {
        appCtxService.ctx[ viewKey ].cellVisibility.toggleOccVisibility( modelObject );
    }
};

export let getOccVisibility = function( modelObject, contextKey ) {
    let viewKey = contextKey ? contextKey : appCtxService.ctx.aceActiveContext.key;

    if( !modelObject || _.isEmpty( modelObject.props ) || modelObject.modelType && modelObject.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 && !( modelObject.props.awb0Parent && modelObject.props.awb0CopyStableId ) ) {
        return true;
    }
    if( appCtxService.ctx[ viewKey ].cellVisibility &&
        appCtxService.ctx[ viewKey ].cellVisibility.getOccVisibility ) {
        if( !appCtxService.ctx[ viewKey ].visibilityControls ) {
            appCtxService.updatePartialCtx( viewKey + '.visibilityControls', true );
        }
        return appCtxService.ctx[ viewKey ].cellVisibility.getOccVisibility( modelObject );
    }

    if( appCtxService.ctx[ viewKey ].visibilityControls ) {
        appCtxService.updatePartialCtx( viewKey + '.visibilityControls', false );
    }
    return true; // default value if there is no visibility handler
};

export default exports = {
    toggleOccVisibility,
    getOccVisibility
};
