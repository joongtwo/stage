// Copyright (c) 2022 Siemens

/**
 * @module js/MrmResourceDataService
 */
import cdmSvc from 'soa/kernel/clientDataModel';
import appCtxSvc from 'js/appCtxService';
import mrmOccmgmtResourceLoadResultBuilder from 'js/MrmOccmgmtResourceLoadResultBuilder';
import mrmOccmgmtGetService from 'js/MrmOccmgmtGetService';
import assert from 'assert';
import eventBus from 'js/eventBus';
import _ from 'lodash';

var exports = {};

/**
 * loadResourceData
 *
 * @param {ResourceLoadInput} resourceLoadInput -
 * @param {IModelObject} openedObject -
 * @param {OccCursorObject} cursorObject -
 *
 * @return {Promise} Promise resolves with the resulting ResourceLoadResult object.
 */
export let loadResourceData = function() {
    var resourceLoadInput = arguments[ 0 ].resourceLoadInput;
    var subPanelContext = arguments[ 0 ].subPanelContext;
    var contextKey;
    if( !subPanelContext ) {
        //It is an expand node case.
        contextKey = resourceLoadInput.contextKey;
        var currentContext = appCtxSvc.getCtx( contextKey );
        if ( currentContext.resourceDataCtxNode ) {
            subPanelContext = currentContext.resourceDataCtxNode.subPanelContext;
        }
    } else {
        contextKey = subPanelContext.contextKey;
    }

    var uwDataProvider = arguments[ 0 ].uwDataProvider;
    var declViewModel = _.cloneDeep( arguments[ 0 ].declViewModel );
    var contextState = {
        context: appCtxSvc.ctx[ contextKey ],
        key: contextKey,
        urlParams: subPanelContext.urlParams,
        occContext: subPanelContext.occContext.getValue()
    };

    resourceLoadInput.dataProviderActionType = arguments[ 0 ].dataProviderActionType;
    var cursorObject = uwDataProvider.cursorObject;

    _populateClearExistingSelectionsParameterForProvidedInput( resourceLoadInput, contextState );

    var isDataReloaded = false;
    if( contextState.context.resourceLoadResult ) {
        //It means data is reloading
        isDataReloaded = true;
    }

    var soaInput = mrmOccmgmtGetService.getDefaultSoaInput();
    resourceLoadInput.parentElement = cdmSvc.NULL_UID;
    resourceLoadInput.displayMode = 'Resource';
    resourceLoadInput.subPanelContext = subPanelContext;

    var isNodeExpanded = false;

    /**
     * Determine UID of 'parent' to load from.
     */
    if ( resourceLoadInput.parentUid ) {
        /**
         * In case of expand the graph node, parent will the node which is going to be expand.
         */
        resourceLoadInput.parentElement = resourceLoadInput.parentUid;
        contextState.context.currentState.o_uid = resourceLoadInput.parentUid;
        contextState.context.currentState.c_uid = resourceLoadInput.parentUid;
        isNodeExpanded = true;
        //If it is expanded node use then we don't need to pass "packSimilarElements" request preference,
        //Otherwise it will not return childs of expanded node.
        if( soaInput.inputData.requestPref.packSimilarElements ) {
            delete soaInput.inputData.requestPref.packSimilarElements;
        }
    }

    assert( resourceLoadInput.parentElement, 'Invalid parent ID' );

    /**
     * Check if the resourceLoadInput does NOT specifiy a cursorIbject but the uwDataProvider does.<BR>
     * If so: Use it.
     */
    if( !resourceLoadInput.cursorObject && cursorObject ) {
        cursorObject.endIndex = 0;
        resourceLoadInput.cursorObject = cursorObject;
    }

    /** Default paze size is 40 but user may try to add multiple instance using "Add" dialog
     *  We have increased page size to number of nodes already in the graph plus max value allow in "Number of Elements" in "Add" dialog
     */
    var numberOfExistingNodes = 0;
    if ( appCtxSvc.ctx.graph && appCtxSvc.ctx.graph.graphModel.nodeMap ) {
        numberOfExistingNodes = Object.keys( appCtxSvc.ctx.graph.graphModel.nodeMap ).length;
    }

    resourceLoadInput.pageSize = numberOfExistingNodes + 10000;

    return mrmOccmgmtGetService
        .getOccurrences( resourceLoadInput, soaInput, contextState.context, contextState.occContext )
        .then(
            function( response ) {
                if( !declViewModel.isDestroyed() ) {
                    let resourceLoadResult = mrmOccmgmtResourceLoadResultBuilder.processGetResourceOccurrencesResponse(
                        resourceLoadInput, response, contextState, declViewModel, uwDataProvider, isNodeExpanded );

                    if( isDataReloaded ) {
                        //If we retrieve resource data after changing revision rules it returns same components but with different UIDs
                        //We need to change old top element to new top element before redraw the resource graph
                        if( contextState.context.topElement.uid !== resourceLoadResult.topModelObject.uid ) {
                            contextState.context.topElement = resourceLoadResult.topModelObject;
                        }
                        //It means data is reloaded and need to draw graph with newly loaded data
                        eventBus.publish( 'MrmResourceGraph.drawResourceGraph' );
                    } else{
                        const graphCtx = appCtxSvc.getCtx( 'graph' );
                        if( graphCtx && graphCtx.reInitializedLegendData ) {
                            // Legend data may be initialized before loading resource data
                            // In this case we have to reinitialized legend data
                            // It make sure resource and legend data are loaded to draw the resource graph
                            eventBus.publish( 'MrmResourceGraph.initLegendData' );
                        }
                    }

                    return {
                        resourceLoadResult: resourceLoadResult
                    };
                }
            } );
};

function _populateClearExistingSelectionsParameterForProvidedInput( resourceLoadInput, contextState ) {
    var clearExistingSelections = appCtxSvc.getCtx( contextState.key ).clearExistingSelections;

    if( clearExistingSelections || !_.isEmpty( contextState.context.configContext ) ) {
        resourceLoadInput.clearExistingSelections = true;
        appCtxSvc.updatePartialCtx( contextState.key + '.clearExistingSelections', false );
    }
}

export default exports = {
    loadResourceData
};
