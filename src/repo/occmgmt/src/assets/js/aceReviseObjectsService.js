// Copyright (c) 2022 Siemens

/**
 * @module js/aceReviseObjectsService
 */
import appCtxService from 'js/appCtxService';
import cdmService from 'soa/kernel/clientDataModel';
import dataManagementService from 'soa/dataManagementService';
import adapterSvc from 'js/adapterService';
import occmgmtSplitViewUpdateService from 'js/occmgmtSplitViewUpdateService';
import occmgmtNavigationService from 'js/occmgmtNavigationService';
import AwStateService from 'js/awStateService';
import eventBus from 'js/eventBus';

var exports = {};

var openRevisedObject = function( revisedElement, page, pageId ) {
    if( appCtxService.ctx.splitView ) {
        var params = {
            rootQueryParamKey: revisedElement.uid,
            pageIdQueryParamKey: pageId
        };
        occmgmtNavigationService.navigateWithGivenParams( appCtxService.ctx.aceActiveContext.context.urlParams, params );
    } else {
        var toParams = {
            uid: revisedElement.uid,
            page: page,
            pageId: pageId
        };

        AwStateService.instance.go( '.', toParams, {
            inherit: false
        } );
    }
};

var refreshGivenView = function( viewKey ) {
    appCtxService.updatePartialCtx( viewKey + '.startFreshNavigation', true );
    appCtxService.updatePartialCtx( viewKey + '.requestPref.addUpdatedFocusOccurrence', true );
    eventBus.publish( 'acePwa.reset', { viewToReset: viewKey, silentReload: true } );
};
/*
 * This method performs post action for Revise Operation
 */

export let performPostReviseAction = function( revisedObject, page, pageId ) {
    adapterSvc.getAdaptedObjects( [ appCtxService.ctx.selected ] ).then( function( adaptedObjs ) {
        var selectedAdoptedObject = cdmService.getObject( adaptedObjs[ 0 ].uid );
        var openedProduct = cdmService.getObject( appCtxService.ctx.aceActiveContext.context.productContextInfo.props.awb0Product.dbValues[ 0 ] );
        var revisedElement = cdmService.getObject( revisedObject.uid );
        var propsToLoad = [ 'item_id' ];
        var uids = [ openedProduct.uid, revisedElement.uid, selectedAdoptedObject.uid ];

        dataManagementService.getProperties( uids, propsToLoad ).then( function() {
            if( openedProduct.props.item_id.dbValues[ '0' ] === revisedElement.props.item_id.dbValues[ '0' ] ) {
                if( !appCtxService.ctx.aceActiveContext.context.isOpenedUnderAContext ) {
                    openRevisedObject( revisedElement, page, pageId );
                }
            } else {
                if( selectedAdoptedObject.props.item_id.dbValues[ '0' ] !== revisedElement.props.item_id.dbValues[ '0' ] ) {
                    openRevisedObject( revisedElement, page, pageId );
                } else if( appCtxService.ctx.selected.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
                    refreshGivenView( appCtxService.ctx.aceActiveContext.key );

                    var inactiveView = occmgmtSplitViewUpdateService.getInactiveViewKey();

                    if( inactiveView && occmgmtSplitViewUpdateService.getAffectedElementsPresentInGivenView( inactiveView, appCtxService.ctx.selected ).length > 0 &&
                        !occmgmtSplitViewUpdateService.isConfigSameInBothViews() ) {
                        refreshGivenView( inactiveView );
                    }
                } else {
                    openRevisedObject( revisedElement, page, pageId );
                }
            }
        } );
    } );
};

export default exports = {
    performPostReviseAction
};
