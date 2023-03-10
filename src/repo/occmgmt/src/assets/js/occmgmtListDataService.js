// Copyright (c) 2022 Siemens

/**
 * @module js/occmgmtListDataService
 */
import cdmSvc from 'soa/kernel/clientDataModel';
import appCtxSvc from 'js/appCtxService';
import awTableSvc from 'js/awTableService';
import occmgmtGetSvc from 'js/occmgmtGetService';
import occmgmtGetOccsResponseService from 'js/occmgmtGetOccsResponseService';
import contextStateMgmtService from 'js/contextStateMgmtService';
import aceStaleRowMarkerService from 'js/aceStaleRowMarkerService';
import occmgmtStateHandler from 'js/occurrenceManagementStateHandler';
import assert from 'assert';
import _ from 'lodash';

var exports = {};

/**
 * loadNextData
 *
 * @param {ListLoadInput} listLoadInput - Parameters for the operation.
 * @param {OccCursorObject} cursorObject - cursor object
 * @param {*} declViewModel - Decl ViewModel
 * @param {*} loadIDs - IDs to be loaded
 * @param {Object} subPanelContext - subPanelContext
 *
 * @return {Promise} Promise resolves with the resulting ListLoadResult object.
 */
export let loadNextData = function( listLoadInput, cursorObject, declViewModel, loadIDs, subPanelContext ) {
    listLoadInput.skipFocusOccurrenceCheck = true;
    return exports.loadData( listLoadInput, cursorObject, declViewModel, loadIDs, subPanelContext );
};

/**
 * loadPrevData
 *
 * @param {ListLoadInput} listLoadInput - Parameters for the operation.
 * @param {OccCursorObject} cursorObject - cursor object
 * @param {*} declViewModel - Decl ViewModel
 * @param {*} loadIDs - IDs to be loaded
 * @param {Object} subPanelContext - subPanelContext
 *
 * @return {Promise} Promise resolves with the resulting ListLoadResult object.
 */
export let loadPrevData = function( listLoadInput, cursorObject, declViewModel, loadIDs, subPanelContext ) {
    listLoadInput.skipFocusOccurrenceCheck = true;
    listLoadInput.addAfter = false;
    return exports.loadData( listLoadInput, cursorObject, declViewModel, loadIDs, subPanelContext );
};

export let getContextKeyFromParentScope = function( parentScope ) {
    return contextStateMgmtService.getContextKeyFromParentScope( parentScope );
};

/**
 * loadData
 *
 * @param {ListLoadInput} listLoadInput - Parameters for the operation.
 * @param {OccCursorObject} cursorObject - cursor object
 * @param {*} declViewModel - Decl ViewModel
 * @param {*} loadIDs - IDs to be loaded
 * @param {Object} subPanelContext - subPanelContext
 *
 * @return {Promise} Promise resolves with the resulting ListLoadResult object.
 */
export let loadData = function( listLoadInput, cursorObject, declViewModel, loadIDs, subPanelContext ) {
    let contextKey = subPanelContext.contextKey;
    if( !contextKey || !appCtxSvc.ctx[ contextKey ] ) {
        return;
    }
    let contextState = {
        context: appCtxSvc.ctx[ contextKey ],
        key: contextKey,
        urlParams: subPanelContext.urlParams,
        occContext: subPanelContext.occContext.getValue()
    };
    appCtxSvc.updatePartialCtx( contextKey + '.vmc' );
    var soaInput = occmgmtGetSvc.getDefaultSoaInput();
    var clearExistingSelections = appCtxSvc.getCtx( contextKey ).clearExistingSelections;

    if( clearExistingSelections ) {
        listLoadInput.clearExistingSelections = true;
        appCtxSvc.updatePartialCtx( contextKey + '.clearExistingSelections', false );
    }

    listLoadInput.parentElement = cdmSvc.NULL_UID;

    /**
     * Determine UID of 'parent' to load from.
     */
    if( listLoadInput.parentUid ) {
        /**
         * listLoadInput specifies what the 'parent' should be. Use it.
         */
        listLoadInput.parentElement = listLoadInput.parentUid;
    } else if( cdmSvc.isValidObjectUid( contextState.context.currentState.o_uid ) ) {
        listLoadInput.parentElement = contextState.context.currentState.o_uid;
    }

    assert( listLoadInput.parentElement, 'Invalid parent ID' );

    /**
     * Check if the listLoadInput does NOT specifiy a cursorIbject but the dataProvider does.<BR>
     * If so: Use it.
     */
    if( !listLoadInput.cursorObject && cursorObject ) {
        listLoadInput.cursorObject = cursorObject;
    }

    listLoadInput.displayMode = 'List';

    if( !loadIDs ) {
        loadIDs = {
            t_uid: subPanelContext.occContext.currentState.t_uid,
            o_uid: subPanelContext.occContext.currentState.o_uid,
            c_uid: subPanelContext.occContext.currentState.c_uid,
            uid: subPanelContext.occContext.currentState.uid
        };
    }
    listLoadInput.loadIDs = loadIDs;

    return occmgmtGetSvc
        .getOccurrences( listLoadInput, soaInput, contextState )
        .then(
            function( response ) {
                if( !declViewModel.isDestroyed() ) {
                    var newState = occmgmtGetOccsResponseService.getNewStateFromGetOccResponse( response,
                        contextState );

                    var oModelObject = cdmSvc.getObject( newState.o_uid );
                    var tModelObject = cdmSvc.getObject( newState.t_uid );
                    var pModelObject = cdmSvc.getObject( newState.pci_uid );

                    if( listLoadInput.clearExistingSelections ) {
                        contextState.context.pwaSelectionModel.selectNone();
                    }

                    if( listLoadInput.clearExistingSelections ) {
                        contextState.context.pwaSelectionModel.selectNone();
                    }

                    if( listLoadInput.skipFocusOccurrenceCheck &&
                        appCtxSvc.ctx[ contextKey ].previousState.c_uid ) {
                        delete newState.c_uid;
                        delete newState.o_uid;
                    }

                    if( !cdmSvc.isValidObjectUid( listLoadInput.parentUid ) ) {
                        contextStateMgmtService.syncContextState( contextKey, newState );
                    }

                    var childOccurrences = [];

                    var occurrences = _.clone( _.last( response.parentChildrenInfos ).childrenInfo );
                    var parentOccurrence = _.clone( _.last( response.parentChildrenInfos ).parentInfo );

                    _.forEach( occurrences, function( childOccInfo ) {
                        childOccurrences.push( childOccInfo.occurrence );
                    } );

                    var totalChildCount = childOccurrences.length;

                    if( !response.cursor.endReached ) {
                        totalChildCount++;
                    }

                    //showTopNode is parameter that decides whether topNode should be shown for Tree. Deleting this parameter
                    //when in List mode to get avoid unncessary validations of this when in list view.
                    delete appCtxSvc.ctx[ contextKey ].showTopNode;

                    var listLoadResult = awTableSvc.createListLoadResult( parentOccurrence,
                        childOccurrences, totalChildCount, 0, parentOccurrence );

                    /** Common load result properties */
                    listLoadResult.baseModelObject = oModelObject;
                    listLoadResult.pciModelObject = pModelObject;
                    listLoadResult.openedObject = oModelObject;
                    listLoadResult.openedModelObject = oModelObject;
                    listLoadResult.topModelObject = tModelObject;
                    listLoadResult.changeContext = '';

                    listLoadResult.sublocationAttributes = response.userWorkingContextInfo ? response.userWorkingContextInfo.sublocationAttributes : {};

                    listLoadResult.autoSavedSessiontime = response.userWorkingContextInfo.autoSavedSessiontime;

                    listLoadResult.filter = response.filter;

                    occmgmtGetOccsResponseService.populateSourceContextToInfoMapOnOccmgmtContext( listLoadResult,
                        response );

                    listLoadResult.requestPref = {
                        savedSessionMode: 'restore',
                        startFreshNavigation: false,
                        useGlobalRevRule: false,
                        criteriaType: contextState.context.requestPref.criteriaType,
                        showUntracedParts: contextState.context.requestPref.showUntracedParts,
                        configContext: {}
                    };

                    listLoadResult.configContext = {};

                    if( response.requestPref && response.requestPref.ignoreIndexForPCIs ) {
                        listLoadResult.requestPref.ignoreIndexForPCIs = response.requestPref.ignoreIndexForPCIs;
                    }

                    /**
                     * Populate the decision for objectQuota loading from the requestPref
                     */
                    listLoadResult.useObjectQuotatoUnload = false;
                    if( response.requestPref && response.requestPref.UseObjectQuotatoUnload ) {
                        if( response.requestPref.UseObjectQuotatoUnload[ 0 ] === 'true' ) {
                            listLoadResult.useObjectQuotatoUnload = true;
                        }
                    }

                    listLoadResult.elementToPCIMap = occmgmtGetOccsResponseService
                        .updateElementToPCIMap( response, contextState );

                    /** List Specific load result properties */
                    listLoadResult.cursorObject = response.cursor;

                    listLoadResult.columnConfig = response.columnConfig;

                    listLoadResult.supportedFeatures = occmgmtStateHandler.getSupportedFeaturesFromPCI( pModelObject );
                    listLoadResult.readOnlyFeatures = occmgmtStateHandler.getReadOnlyFeaturesFromPCI( pModelObject );

                    aceStaleRowMarkerService.updateCtxWithStaleUids( response.requestPref, occurrences );
                    listLoadResult.displayToggleOptions = {};

                    occmgmtGetOccsResponseService.populateRequestPrefInfoOnOccmgmtContext( listLoadResult, response );

                    occmgmtGetOccsResponseService.populateFeaturesInfoOnOccmgmtContext( listLoadResult, response, contextKey );

                    return {
                        listLoadResult: listLoadResult
                    };
                }
            } );
};

export default exports = {
    loadNextData,
    loadPrevData,
    getContextKeyFromParentScope,
    loadData
};
