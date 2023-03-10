// Copyright (c) 2022 Siemens

/**
 * @module js/discoverySnapshotService
 */
import appCtxSvc from 'js/appCtxService';
import viewModeSvc from 'js/viewMode.service';
import navigationSvc from 'js/navigationService';
import cdm from 'soa/kernel/clientDataModel';
import dmSvc from 'soa/dataManagementService';

var exports = {};

export let openProductSnapshot = function( snapshotobj, navigateIn ) {
    //Change the viewMode 
    if( viewModeSvc.getViewMode !== 'TreeSummaryView' ) {
        appCtxSvc.updatePartialCtx( 'preferences.AW_SubLocation_OccurrenceManagementSubLocation_ViewMode', [ 'TreeSummaryView' ] );
    }
    if( snapshotobj.props.fnd0Roots ) {
        var productToOpen = snapshotobj.props.fnd0Roots.dbValues[ 0 ];
    }

    //Navigate
    let navigationParams = {
        uid: productToOpen,
        pageId: 'tc_xrt_Content',
        snap_uid: snapshotobj.uid
    };
    let action = {
        actionType: 'Navigate',
        navigateTo: 'com_siemens_splm_clientfx_tcui_xrt_showObject'
    };

    if( navigateIn ) {
        action.navigateIn = navigateIn;
    }
    return navigationSvc.navigate( action, navigationParams );
};

export let openProductSnapshotViaTile = function( snapshotobj ) {
    let objsToLoad = [ snapshotobj.cmdArgs[0] ];
    return dmSvc.loadObjects(objsToLoad)
    .then( function() {
        let snapshotObject = cdm.getObject( snapshotobj.cmdArgs[0] );
        exports.openProductSnapshot( snapshotObject );
    } );
};

export default exports = {
    openProductSnapshot,
    openProductSnapshotViaTile
};
