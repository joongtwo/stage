// Copyright (c) 2022 Siemens

/**
 * @module js/MrmOccmgmtResourceLoadResultBuilder
 */
import appCtxSvc from 'js/appCtxService';
import cdmSvc from 'soa/kernel/clientDataModel';
import awTableSvc from 'js/awTableService';
import contextStateMgmtService from 'js/contextStateMgmtService';
import occmgmtUtils from 'js/occmgmtUtils';
import occmgmtStateHandler from 'js/occurrenceManagementStateHandler';
import aceStaleRowMarkerService from 'js/aceStaleRowMarkerService';
import mrmResourceGraphUtils from 'js/MrmResourceGraphUtils';
import mrmOccmgmtGetOccsResponseService from 'js/MrmOccmgmtGetOccsResponseService';
import _ from 'lodash';

var exports = {};

/**
 * @param {*} resourceLoadInput resourceLoadInput structure
 * @param {*} resourceLoadOutput resourceLoadOutput structure used to resourceLoadResult
 * @param {*} response getResourceOccurrences response
 */
const _updateTopNodeRelatedInformationInOutputStructure = ( resourceLoadInput, resourceLoadOutput, response ) => {
    var uwci = response.userWorkingContextInfo;
    resourceLoadOutput.sublocationAttributes = uwci ? uwci.sublocationAttributes : {};
    resourceLoadOutput.changeContext = null;

    if ( resourceLoadOutput.sublocationAttributes && resourceLoadOutput.sublocationAttributes.awb0ActiveSublocation ) {
        resourceLoadOutput.tabNameToActivate = resourceLoadOutput.sublocationAttributes.awb0ActiveSublocation[0];
    }

    if ( response.requestPref ) {
        resourceLoadOutput.requestPref.isStaleStructure = response.requestPref.isStaleStructure;
    }

    resourceLoadOutput.showTopNode = true;

    if ( resourceLoadOutput.showTopNode === true ) {
        if ( _.isEmpty( response.occurrences ) && _.isEmpty( response.parentChildrenInfos ) ) {
            resourceLoadOutput.topNodeOccurrence = [];
            resourceLoadOutput.topNodeOccurrence.push( response.parentOccurrence );
        }
    }
};

function _buildResourceLoadOutputInfo( resourceLoadInput, resourceLoadOutput, response, newState, contextState, occContext, isNodeExpanded ) {
    //Values from different sources get copied to resourceLoadResult. resourceLoadInput, response, ctx etc. That needs unification.
    //We will create resourceLoadOutput and copy that into basic resourceLoadResult rather than updating basic resourceLoadResult at different points.

    //Opened object is assembly/sub-assembly that user has navigated into.
    resourceLoadOutput.openedModelObject = cdmSvc.getObject( newState.o_uid );

    if ( isNodeExpanded && contextState.context.topElement ) {
        //After expanding a node it should set top element as open element, otherwise newly added element will not be visible
        resourceLoadOutput.openedModelObject = cdmSvc.getObject( contextState.context.topElement.uid );
    }

    resourceLoadOutput.baseModelObject = resourceLoadOutput.openedModelObject;
    resourceLoadOutput.openedObject = resourceLoadOutput.openedModelObject;
    resourceLoadOutput.pciModelObject = cdmSvc.getObject( newState.pci_uid );
    resourceLoadOutput.topModelObject = cdmSvc.getObject( newState.t_uid );

    resourceLoadOutput.configContext = {};
    resourceLoadOutput.startFreshNavigation = false;
    resourceLoadOutput.elementToPCIMap = mrmOccmgmtGetOccsResponseService.updateElementToPCIMap( response, contextState );

    resourceLoadOutput.requestPref = {
        savedSessionMode: appCtxSvc.ctx.requestPref ? appCtxSvc.ctx.requestPref.savedSessionMode : 'restore',
        criteriaType: contextState.context.requestPref.criteriaType,
        showUntracedParts: contextState.context.requestPref.showUntracedParts,
        recipeReset: !_.isUndefined( response.requestPref ) && response.requestPref.recipeReset ? response.requestPref.recipeReset[0] : 'false'
    };

    //Populate the decision for objectQuota loading from the requestPref
    resourceLoadOutput.useObjectQuotatoUnload = false;
    if ( response.requestPref && response.requestPref.UseObjectQuotatoUnload ) {
        if ( response.requestPref.UseObjectQuotatoUnload[0] === 'true' ) {
            resourceLoadOutput.useObjectQuotatoUnload = true;
        }
    }

    if ( !_.isUndefined( occContext.showTopNode ) ) {
        resourceLoadOutput.showTopNode = occContext.showTopNode;
    }

    var pci_uid = newState.pci_uid;

    if ( resourceLoadInput.skipFocusOccurrenceCheck && contextState.occContext.previousState ) {
        pci_uid = contextState.occContext.previousState.pci_uid;
        delete newState.c_uid;
        delete newState.o_uid;
    }

    resourceLoadOutput.productContextInfo = cdmSvc.getObject( pci_uid );
    aceStaleRowMarkerService.updateCtxWithStaleUids( response.requestPref, response.occurrences );
}

const updateOccContextValueWithProvidedInput = ( resourceLoadOutput, occContextValue, valuesToCopyOrUpdateOccContext, valuesToResetAfterAction ) => {
    if ( valuesToCopyOrUpdateOccContext ) {
        _.forEach( valuesToCopyOrUpdateOccContext, function( value, name ) {
            //Structures might not come with every initializeAction response. like displayToggleOptions.
            //We need to retain existing ones in that case.
            if ( !_.isNull( resourceLoadOutput[name] ) && !_.isEmpty( resourceLoadOutput[name] ) || _.isBoolean( resourceLoadOutput[name] ) ) {
                occContextValue[name] = resourceLoadOutput[name];
            }
        } );
    }

    if ( valuesToResetAfterAction ) {
        _.forEach( valuesToResetAfterAction, function( value, name ) {
            occContextValue[name] = value;
        } );
    }
};

const _buildResourceLoadOutputForInitializeAction = ( resourceLoadInput, resourceLoadOutput, declViewModel, response, contextState, uwDataProvider, subPanelContext ) => {
    resourceLoadOutput.supportedFeatures = occmgmtStateHandler.getSupportedFeaturesFromPCI( resourceLoadOutput.productContextInfo );
    resourceLoadOutput.readOnlyFeatures = occmgmtStateHandler.getReadOnlyFeaturesFromPCI( resourceLoadOutput.productContextInfo );
    resourceLoadOutput.workingContextObj = occmgmtUtils.getSavedWorkingContext( resourceLoadOutput.productContextInfo );

    resourceLoadOutput.isOpenedUnderAContext = resourceLoadOutput.workingContextObj !== null;

    //vmc population is one time thing
    if ( declViewModel && declViewModel.dataProviders ) {
        resourceLoadOutput.resourceGraphDataProvider = mrmResourceGraphUtils.getCurrentResourceDataProvider( declViewModel.dataProviders );
        resourceLoadOutput.vmc = resourceLoadOutput.resourceGraphDataProvider.viewModelCollection;
    }

    _updateTopNodeRelatedInformationInOutputStructure( resourceLoadInput, resourceLoadOutput, response );
    resourceLoadOutput.autoSavedSessiontime = response.userWorkingContextInfo.autoSavedSessiontime;

    mrmOccmgmtGetOccsResponseService.populateRequestPrefInfoOnOccmgmtContext( resourceLoadOutput, response, contextState.key );
    mrmOccmgmtGetOccsResponseService.populateFeaturesInfoOnOccmgmtContext( resourceLoadOutput, response, contextState.key );
    mrmOccmgmtGetOccsResponseService.populateSourceContextToInfoMapOnOccmgmtContext( resourceLoadOutput, response, contextState.key );
};

const _buildOccContextValueFromResourceLoadOutputOnInitializeAction = ( resourceLoadOutput, occContextValue ) => {
    let valuesToCopyOrUpdateOccContext = {
        supportedFeatures: {},
        readOnlyFeatures: {},
        productContextInfo: {},
        elementToPCIMap: {},
        selectedModelObjects: {},
        pwaSelection:{},
        tabNameToActivate: {},
        isOpenedUnderAContext: {},
        workingContextObj: {},
        topElement: {},
        openedElement: {},
        currentState: {},
        previousState: {},
        showTopNode: true,
        vmc: {},
        resourceGraphDataProvider: {},
        isRestoreOptionApplicableForProduct: false,
        defaultOpenStateMessageTime: {},
        defaultOpenStateMessage: {},
        baseModelObject: {}
    };
    let onPwaLoadComplete = occContextValue.onPwaLoadComplete ? occContextValue.onPwaLoadComplete : 0;
    let valuesToResetAfterInitializeAction = {
        transientRequestPref: {},
        configContext: {},
        onPwaLoadComplete: onPwaLoadComplete + 1,
        pwaReset: undefined
    };

    updateOccContextValueWithProvidedInput( resourceLoadOutput, occContextValue, valuesToCopyOrUpdateOccContext, valuesToResetAfterInitializeAction );
};

/**
 * @param {ResourceLoadInput} resourceLoadInput - Parameters for the operation.
 * @param {ISOAResponse} response - SOA Response
 *
 * @return {ResourceLoadResult} A new ResourceLoadResult object containing result/status information.
 */
export let processGetResourceOccurrencesResponse = function( resourceLoadInput, response, contextState, declViewModel, uwDataProvider, isNodeExpanded ) {
    let occContext = resourceLoadInput.subPanelContext.occContext;
    let occContextValue = contextState.occContext;
    let resourceLoadOutput = {
        configContext: {},
        supportedFeatures: {},
        readOnlyFeatures: {},
        selectedModelObjects: []
    };

    resourceLoadOutput.cursorObject = response.cursor;
    resourceLoadOutput.occurrences = response.occurrences;

    let resourceLoadResult;
    let vmNodes = {};
    var newState = mrmOccmgmtGetOccsResponseService.getNewStateFromGetOccResponse( response, contextState.key );
    let syncState = contextStateMgmtService.createSyncState( contextState.occContext, newState );
    let valueToUpdate = {};
    let vmNodeStates = {};

    resourceLoadOutput.currentState = syncState.currentState;
    resourceLoadOutput.previousState = syncState.previousState;
    _buildResourceLoadOutputInfo( resourceLoadInput, resourceLoadOutput, response, newState, contextState, occContextValue, isNodeExpanded );
    let selectedObject = cdmSvc.getObject(newState.c_uid);
    if ( occContext.selectedModelObjects && occContext.selectedModelObjects.length > 0 ) {
        selectedObject = cdmSvc.getObject( occContext.selectedModelObjects[0].uid );
        //It may possible current selection no longer valid for example in case of remove
        if( selectedObject ) {
            resourceLoadOutput.selectedModelObjects = [selectedObject];
            resourceLoadOutput.pwaSelection = [selectedObject];
        } else {
            selectedObject = cdmSvc.getObject(newState.c_uid);
            resourceLoadOutput.selectedModelObjects = [selectedObject];
            resourceLoadOutput.pwaSelection = [selectedObject];
        }
    } else {
        //This code is handling the case when a resource open and in beginning selectedModelObjects may not be set on occContext.
        if (selectedObject) {
            resourceLoadOutput.selectedModelObjects = [selectedObject];
            resourceLoadOutput.pwaSelection = [selectedObject];
        } else {
            resourceLoadOutput.selectedModelObjects = [];
            resourceLoadOutput.pwaSelection = [selectedObject];
        }        
    }

    if ( _.isEqual( resourceLoadInput.dataProviderActionType, 'initializeAction' ) ) {
        _buildResourceLoadOutputForInitializeAction( resourceLoadInput, resourceLoadOutput, declViewModel, response, contextState, uwDataProvider, resourceLoadInput.subPanelContext );
        _buildOccContextValueFromResourceLoadOutputOnInitializeAction( resourceLoadOutput, occContextValue );

        valueToUpdate = occContextValue;

        //Code to update secondaryActiveTabId using atomic data...
        var sublocationState = resourceLoadInput.subPanelContext.pageContext.sublocationState;
        var swaContext = { ...sublocationState.value };
        swaContext.secondaryActiveTabId = resourceLoadOutput.tabNameToActivate;
        occmgmtUtils.updateValueOnCtxOrState( '', swaContext, sublocationState );
    }

    var childOccurrences = [];
    var hasProductSubAssembly = false;
    _.forEach( response.graph.nodes, function( childOccInfo ) {
        if ( childOccInfo.resourceOccurrence.props && childOccInfo.resourceOccurrence.props.MRMPSP ) {
            delete childOccInfo.resourceOccurrence.props.MRMPSP;
        }

        if ( childOccInfo.resourceOccurrence.props && childOccInfo.resourceOccurrence.props.NUMOFGCSSOCKETS ) {
            delete childOccInfo.resourceOccurrence.props.NUMOFGCSSOCKETS;
        }

        if ( childOccInfo.resourceProps ) {
            if ( childOccInfo.resourceProps['MRM PSP'] ) {
                childOccInfo.resourceOccurrence.props.MRMPSP = childOccInfo.resourceProps['MRM PSP'];
            }

            if ( childOccInfo.resourceProps.NUMOFGCSSOCKETS ) {
                childOccInfo.resourceOccurrence.props.NUMOFGCSSOCKETS = childOccInfo.resourceProps.NUMOFGCSSOCKETS;
            }
        }
        //awb0NumberOfChildren includes GCS CP and CSYS lines we need to exclude those lines from count
        //childOccInfo.numberOfChildren excludes those lines
        if ( childOccInfo.resourceOccurrence.props && childOccInfo.resourceOccurrenceId !== response.parentResourceOccurrence.resourceOccurrenceId ) {
            childOccInfo.resourceOccurrence.props.awb0NumberOfChildren.dbValues[0] = childOccInfo.numberOfChildren;
            //It means open product has at least one sub assembly
            if ( !hasProductSubAssembly && childOccInfo.numberOfChildren > 0 ) {
                hasProductSubAssembly = true;
            }
        }

        //While expanding a node no need to process parent occurrence as it is already drawn in graph
        //This time parent occurrence is expanded node which is already in graph
        if ( !( resourceLoadInput.expandNode && childOccInfo.resourceOccurrenceId === response.parentResourceOccurrence.resourceOccurrenceId ) ) {
            childOccurrences.push( childOccInfo.resourceOccurrence );
        }
    } );

    if ( hasProductSubAssembly ) {
        if ( !contextState.context.resourceDataCtxNode ) {
            let newOccMgmtContext = { ...contextState.context };
            let resourceDataCtxNode = {
                data: declViewModel,
                subPanelContext: resourceLoadInput.subPanelContext
            };

            newOccMgmtContext.resourceDataCtxNode = resourceDataCtxNode;
            appCtxSvc.updateCtx( contextState.key, newOccMgmtContext );
        }
    }

    var totalChildCount = childOccurrences.length;

    if ( !response.cursor.endReached ) {
        totalChildCount++;
    }

    resourceLoadOutput.edges = response.graph.edges;
    //Create a basic resourceLoadResult
    resourceLoadResult = awTableSvc.createListLoadResult( response.parentResourceOccurrence, childOccurrences, totalChildCount, 0, response.parentResourceOccurrence );

    occmgmtUtils.updateValueOnCtxOrState( '', valueToUpdate, occContext );

    if ( resourceLoadInput.skipFocusOccurrenceCheck && contextState.occContext.previousState.c_uid ) {
        delete newState.c_uid;
        delete newState.o_uid;
    }

    contextStateMgmtService.syncContextState( contextState.occContext.viewKey, newState );

    _.forEach( resourceLoadOutput, function( value, name ) {
        if ( !_.isUndefined( value ) ) {
            resourceLoadResult[name] = value;
        }
    } );

    return resourceLoadResult;
};

export default exports = {
    processGetResourceOccurrencesResponse
};
