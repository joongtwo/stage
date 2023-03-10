// Copyright (c) 2022 Siemens

/**
 * @module js/importPreviewService
 */
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import dataManagementSvc from 'soa/dataManagementService';
import navigationSvc from 'js/navigationService';
import cdm from 'soa/kernel/clientDataModel';
import commandPanelService from 'js/commandPanel.service';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import _ from 'lodash';
import importPreviewSetActionOnLine from 'js/importPreviewSetActionOnLine';

var exports = {};

let resource = 'OccmgmtImportExportConstants';
let localeTextBundle = localeService.getLoadedText( resource );

/**
 * Updates ctx with import excel header title
 */
let updateCtxWithHeaderTitle = function() {
    var fileNameNoExt = appCtxSvc.getCtx( 'ImportBOMContext.fileNameNoExt' );
    if( fileNameNoExt ) {
        var headerTitle = localeTextBundle.importPreviewHeaderTitle;
        headerTitle = headerTitle.replace( '{0}', fileNameNoExt );
        appCtxSvc.updateCtx( 'ImportBOMContext.importPreviewHeaderTitle', headerTitle );
    }
};

/**
 * Load Import Preview data before page launch
 */
export let importPreviewData = function() {
    var defer = AwPromiseService.instance.defer();
    var moduleTitle;
    var modelObject;

    var toParams = exports.getStateParams();
    var uidForLoadObject = [ toParams.uid, toParams.d_uid ];
    appCtxSvc.updateCtx( 'hideRightWall', true );
    dataManagementSvc.loadObjects( uidForLoadObject ).then( function() {
        var result = {};
        result.data = [];
        let requestPref = appCtxSvc.getCtx( 'requestPref' ) ? appCtxSvc.getCtx( 'requestPref' ) : {
            savedSessionMode: 'ignore'
        };
        for( var i = 0; i < uidForLoadObject.length; i++ ) {
            var obj = cdm.getObject( uidForLoadObject[ i ] );
            result.data.push( obj );
        }
        appCtxSvc.registerCtx( 'IFEContext', {
            currentState: {
                uid: uidForLoadObject[ 0 ]
            },
            requestPref: requestPref,
            readOnlyFeatures: {},
            expansionCriteria: {},
            skipAutoBookmark: true,
            modelObject: modelObject,
            moduleTitle: moduleTitle
        } );
        appCtxSvc.registerCtx( 'aceActiveContext', {
            key: 'IFEContext',
            context: appCtxSvc.getCtx( 'IFEContext' )
        } );

        defer.resolve( result );
    } );
    return defer.promise;
};

/**
 * Get state params
 */
export let getStateParams = function() {
    var toParams = {};
    var _selected = appCtxSvc.getCtx( 'selected' );
    var sourceObject;

    if( _selected ) {
        if( _selected.props.awb0UnderlyingObject !== undefined ) { // We got an Awb0Element as input
            sourceObject = cdm.getObject( _selected.props.awb0UnderlyingObject.dbValues[ 0 ] );
            toParams.uid = sourceObject.uid;
        } else {
            sourceObject = cdm.getObject( _selected.uid );
            if( sourceObject ) {
                toParams.uid = sourceObject.uid;
            }
        }
    }
    return toParams;
};

/**
 * Takes user to import preview sublocation.
 */
export let launchImportBOMPreviewPage = function() {
    if( _.isEqual( appCtxSvc.getCtx( 'sublocation.clientScopeURI' ), 'Awb0ImportPreview' ) ) {
        eventBus.publish( 'reloadPreview' );
    } else {
        let result = exports.getStateParams();
        importPreviewSetActionOnLine.clearUpdateVMOList();
        updateCtxWithHeaderTitle();
        let action = { actionType: 'Navigate' };
        action.navigationParams = result;
        action.navigateTo = 'importPreview';
        navigationSvc.navigate( action, result );
    }
};

/**
 * Clean up CBA specific variable from context
 */
export let cleanupPreviewVariablesFromCtx = function() {
    appCtxSvc.unRegisterCtx( 'IFEContext' );
    if( appCtxSvc.getCtx( 'ImportBOMContext' ) ) {
        appCtxSvc.unRegisterCtx( 'ImportBOMContext' );
    }
    appCtxSvc.updateCtx( 'hideRightWall', false );
};

/**
 * Launches preview panel in preview screen after all the nodes in tree are loaded.
 */
export let launchImportPanelInPreview = function( commandId, location ) {
    if( appCtxSvc.getCtx( 'ImportBOMContext' ) &&
        _.isUndefined( appCtxSvc.getCtx( 'ImportBOMContext.isImportPreviewScreenOpened' ) ) ) {
        appCtxSvc.updatePartialCtx( 'ImportBOMContext.isImportPreviewScreenOpened', true );
        commandPanelService.activateCommandPanel(
            commandId, location, undefined, true, false, undefined );
    }
};

/**
 * Import Panel Preview Service utility
 * @returns {object} - object
 */

export default exports = {
    getStateParams,
    importPreviewData,
    launchImportBOMPreviewPage,
    cleanupPreviewVariablesFromCtx,
    launchImportPanelInPreview
};
