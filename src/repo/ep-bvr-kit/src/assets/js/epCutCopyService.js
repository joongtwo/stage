// Copyright (c) 2022 Siemens

import ClipboardService from 'js/clipboardService';
import localeService from 'js/localeService';
import messagingSvc from 'js/messagingService';
import epTableService from 'js/epTableService';
import appCtxService from 'js/appCtxService';

/**
 * EP Cut Copy service
 *
 * @module js/epCutCopyService
 */


/**
 *
 * @param {ViewModelObject} objectsToCopy - objectsToCopy
 */
export function copy( objectsToCopy ) {
    removeExistingCutIndication();

    ClipboardService.instance.setContents( objectsToCopy );
    const resource = localeService.getLoadedText( 'epCopyMessages' );
    const addedToClipBoardMessage = getCopiedLocalizedMessage( resource, objectsToCopy );
    messagingSvc.showInfo( addedToClipBoardMessage );
}

/**
 * Get the message for given key from given resource file, replace the parameter and return the localized string
 *
 * @param {String} localTextBundle - The message bundles localized files
 * @param {String} objectsCopied - The copied objects
 * @returns {String} localizedValue - The localized message string
 */
function getCopiedLocalizedMessage( localTextBundle, objectsCopied ) {
    return objectsCopied && objectsCopied.length === 1 ? localTextBundle.epCopySingleSuccessful.format( objectsCopied[ 0 ].props.object_string.uiValues[ 0 ] ) :
        localTextBundle.epCopyMultipleSuccessful.format( objectsCopied.length );
}

/**
 *
 * @param {ViewModelObject} objectsToCut - objectsToCut
 */
export function cut( objectsToCut ) {
    removeExistingCutIndication();
    appCtxService.updatePartialCtx( 'cutIntent', true );
    objectsToCut.forEach( treeNode => {
        epTableService.setIsOpaqueProperty( treeNode, true );
    } );
    ClipboardService.instance.setContents( objectsToCut );
}

/**
 * Remove existing cut indication
 */
export function removeExistingCutIndication() {
    if( appCtxService.getCtx( 'cutIntent' ) && appCtxService.getCtx( 'cutIntent' ) === true ) {
        appCtxService.unRegisterCtx( 'cutIntent' );
    }
    const objects = ClipboardService.instance.getContents();
    objects.forEach( treeNode => {
        treeNode && treeNode.props && epTableService.setIsOpaqueProperty( treeNode, false );
    } );
}

/**
 * set existing cut indication
 */
export function setExistingCutIndication( vmos ) {
    if( appCtxService.getCtx( 'cutIntent' ) && appCtxService.getCtx( 'cutIntent' ) === true ) {
        const objects = ClipboardService.instance.getContents();
        if( Array.isArray( vmos ) ) {
            vmos.forEach( ( vmo ) =>objects.forEach( ( treeNode ) => {
                if( vmo.uid === treeNode.uid ) {
                    vmo && vmo.props && epTableService.setIsOpaqueProperty( vmo, true );
                }
            } ) );
        }
    }
}

let exports = {};
export default exports = {
    copy,
    cut,
    removeExistingCutIndication,
    setExistingCutIndication
};
