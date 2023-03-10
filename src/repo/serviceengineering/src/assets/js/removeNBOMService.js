// Copyright (c) 2022 Siemens

/**
 * @module js/removeNBOMService
 */
import appCtxService from 'js/appCtxService';
import localeService from 'js/localeService';
import epRemoveObjectService from 'js/epRemoveObjectService';

/**
 * Remove Source BOM from current CC.
 * @param {Object} selectedObjectFromTile - selected Object from the tile
 */
export function removeNBOM( selectedObjectFromTile ) {
    const epTaskPageContext = appCtxService.getCtx( 'epTaskPageContext' );
    const ccObj = epTaskPageContext.collaborationContext;
    const MbomStructureContext = epTaskPageContext.MbomStructureContext;
    const relatedObjects = [ ccObj, selectedObjectFromTile ];
    const objectToRemove = [ selectedObjectFromTile.uid ];

    let localTextBundle;
    let localizedRemoveConfirmationMessage;
    if( MbomStructureContext && appCtxService.getCtx( 'userSession.props.role_name.dbValues[0]' ) === 'Service Engineer' ) {
        objectToRemove.push( MbomStructureContext.uid );
        relatedObjects.push( MbomStructureContext );
        localTextBundle = localeService.getLoadedText( 'NBOMTileMessages' );
        localizedRemoveConfirmationMessage = localTextBundle.removeNbomSbomConfirmationMessage.format( MbomStructureContext.vmo.props.object_string.dbValue );
    } else {
        localTextBundle = localeService.getLoadedText( 'AdminMessages' );
        localizedRemoveConfirmationMessage = localTextBundle.removeConfirmationMessage.format( selectedObjectFromTile.vmo.props.object_string.dbValue );
    }

    return epRemoveObjectService.removeObjectFromWorkPackage( selectedObjectFromTile, ccObj, relatedObjects, objectToRemove, localizedRemoveConfirmationMessage, localTextBundle );
}

export default {
    removeNBOM
};
