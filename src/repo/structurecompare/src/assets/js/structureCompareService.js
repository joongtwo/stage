// Copyright (c) 2022 Siemens

/**
 * @module js/structureCompareService
 */
import AwStateService from 'js/awStateService';
import awStructureCompareSvc from 'js/awStructureCompareService';
import compareGetSvc from 'js/awStructureCompareGetService';
import awStructureCompareUtils from 'js/awStructureCompareUtils';
import awStructureCompareColorService from 'js/awStructureCompareColorService';
import LocationNavigationService from 'js/locationNavigation.service';
import cdm from 'soa/kernel/clientDataModel';
import dataManagementSvc from 'soa/dataManagementService';
import commadPanelSvc from 'js/commandPanel.service';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import appCtxSvc from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import occmgmtUtils from 'js/occmgmtUtils';

var exports = {};
let _crossSelectionSyncFlag = false;

function getActiveViewLocation() {
    let srcLocation = 1;
    if( appCtxSvc.getCtx( 'aceActiveContext.key' ) === 'occmgmtContext2' ) {
        srcLocation = 2;
    }
    return srcLocation;
}

export let performAutoCompare = ( compareContext, occContext, occContext2, eventData ) => {
    if( occContext.vmc && occContext2.vmc && eventData && (eventData.sourceGridId === 'occTreeTable' || eventData.sourceGridId === 'occTreeTable2')) {
        let newCompareContext = { ...compareContext.value };
        exports.initializeCompareData( newCompareContext );
        let _sourceVMOs = occContext.vmc.getLoadedViewModelObjects();
        let _targetVMOs = occContext2.vmc.getLoadedViewModelObjects();

        if( appCtxSvc.getCtx( 'compareContext.isMultiStructureFirstLaunch' ) ) {
            newCompareContext.autoOpenComparePanel = true;
            if( newCompareContext.compareList ) {
                newCompareContext.compareList.sourceSelection = occContext.topElement;
                newCompareContext.compareList.targetSelection = occContext2.topElement;
            }
            //Make sure that both the source and target VMOs are loaded before making server call.
            if( _sourceVMOs.length > 0 && _targetVMOs.length > 0 ) {
                appCtxSvc.updatePartialCtx( 'compareContext.isMultiStructureFirstLaunch', false );
                return exports.executeCompare( newCompareContext, _sourceVMOs, _targetVMOs, compareContext );
            }
        } else if( compareContext.isInMultiLevelCompare === true ) {
            let skipCompare = appCtxSvc.getCtx( 'skipCompareOnSystemExpansion' );
            if( !skipCompare ) {
                let compareInput = compareGetSvc.createSOAInputForVisibleUids( compareContext, compareContext.depth, false, false, _sourceVMOs, _targetVMOs );
                let deferred = AwPromiseService.instance.defer();
                awStructureCompareSvc.performCompare( newCompareContext, compareInput, false, false, compareContext, deferred ).then( () => {
                    syncSelection( occContext, occContext2, compareContext, getActiveViewLocation() );
                } );
                return deferred.promise;
            }
            //Reset the flag
            appCtxSvc.updatePartialCtx( 'skipCompareOnSystemExpansion', false );
        }
    }
};

/**
 * This helper function will do pre-requisite initialization and registrations for Compare.
 */
export let initializeCompareData = function( compareContext ) {
    appCtxSvc.updatePartialCtx( 'cellClass', {
        gridCellClass: awStructureCompareColorService.gridCellClass,
        pltablePropRender: awStructureCompareColorService.prophighlightRenderer
    } );
    awStructureCompareSvc.initializeCompareList( compareContext );
};

/**
 * Initializes compare context while launching Compare panel.
 *
 */
export let setUpCompareContext = function( compareContext ) {
    let newCompareContext = { ...compareContext.value };
    exports.initializeCompareData( newCompareContext );
    let leftStructureKey = appCtxSvc.getCtx( 'splitView.viewKeys' )[ 0 ];
    let rightStructureKey = appCtxSvc.getCtx( 'splitView.viewKeys' )[ 1 ];
    let leftStructureContext = appCtxSvc.getCtx( leftStructureKey );
    let rightStructureContext = appCtxSvc.getCtx( rightStructureKey );
    if( newCompareContext.compareList ) {
        newCompareContext.compareList.sourceSelection = leftStructureContext.topElement;
        newCompareContext.compareList.targetSelection = rightStructureContext.topElement;
        let selectedObj = cdm.getObject( leftStructureContext.selectedModelObjects[ 0 ].uid );
        if( !selectedObj ) {
            selectedObj = leftStructureContext.topElement;
        }
        newCompareContext.compareList.cmpSelection1 = selectedObj;
        selectedObj = cdm.getObject( rightStructureContext.selectedModelObjects[ 0 ].uid );
        if( !selectedObj ) {
            selectedObj = rightStructureContext.topElement;
        }
        newCompareContext.compareList.cmpSelection2 = selectedObj;
    }
    if( !compareContext.displayOptions ) {
        exports.setDefaultDisplayOptions( newCompareContext );
    }
    if( !compareContext.depth ) {
        newCompareContext.depth = 1;
    }
    compareContext.update( newCompareContext );
    eventBus.publish( 'refreshCellRenderersForCompare' );
};

export let executeFromComparePanel = function( compareContext, usrSelectedDepth, backgroundOption ) {
    if( backgroundOption ) {
        awStructureCompareSvc.showBackgroundMessage( compareContext.compareList );
    }

    let contextKeys = awStructureCompareUtils.getContextKeys();

    let sourceVMOs = appCtxSvc.getCtx( contextKeys.leftCtxKey ).vmc.getLoadedViewModelObjects();
    let targetVMOs = appCtxSvc.getCtx( contextKeys.rightCtxKey ).vmc.getLoadedViewModelObjects();
    let defaultCursor = awStructureCompareUtils.getDefaultCursor();
    let compareInput = compareGetSvc.createSOAInputForPaginationAndVisibleUids( compareContext, usrSelectedDepth, true,
        backgroundOption, defaultCursor, defaultCursor, sourceVMOs, targetVMOs, null );
    let newCompareContext = { ...compareContext.value };
    awStructureCompareSvc.resetCompareContext( newCompareContext );
    awStructureCompareSvc.resetCompareColorData( newCompareContext, true );
    updateCompareContextInput( compareContext.compareList, compareInput );
    awStructureCompareSvc.performCompare( newCompareContext, compareInput, true, false, compareContext );
};

export let resetCompareContext = ( compareContext ) => {
    if( compareContext.isInCompareMode ) {
        const newCompareContext = { ...compareContext };
        newCompareContext.isInMultiLevelCompare = false;
        awStructureCompareSvc.resetCompareColorData( newCompareContext );
        if( newCompareContext.resetOnProductChange ) {
            newCompareContext.resetOnProductChange = false;
        }
        return newCompareContext;
    }
};

export let resetProductListener = ( savedSessionMode, compareContext ) => {
    if( savedSessionMode === 'reset' ) {
        // Close compare panel
        eventBus.publish( 'complete', { source: 'toolAndInfoPanel' } );
        return resetCompareContext( compareContext );
    }
};

let updateCompareContextInput = ( compareContextList, compareInput ) => {
    if( compareInput ) {
        compareContextList.cmpSelection1 = compareInput.inputData.source.element;
        compareContextList.cmpSelection2 = compareInput.inputData.target.element;
    }
};

export let setDefaultDisplayOptions = function( compareContext ) {
    let matchTypes = {};
    matchTypes.MISSING_SOURCE = true;
    matchTypes.MISSING_TARGET = true;
    matchTypes.PARTIAL_MATCH = true;

    let equivalenceTypes = {};
    equivalenceTypes.AC_DYNAMIC_IDIC = true;

    let displayOptions = {};
    displayOptions.MatchType = matchTypes;
    displayOptions.Equivalence = equivalenceTypes;

    compareContext.displayOptions = displayOptions;
};

export let launchContentCompare = function() {
    appCtxSvc.updatePartialCtx( 'compareContext.autoOpenComparePanel', true );
    appCtxSvc.updatePartialCtx( 'compareContext.isMultiStructureFirstLaunch', true );
    //resetTreeExpansionState is set to True on appCtx, occmgmt will ignore the expansion state of structures while opening in multi-structure.
    appCtxSvc.updatePartialCtx( 'resetTreeExpansionState', true );
    let requestPrefValue = {
        dataFilterMode: 'compare'
    };
    appCtxSvc.updatePartialCtx( 'requestPref', requestPrefValue );
    let toParams = {};
    let _mselected = appCtxSvc.getCtx( 'mselected' );
    let selectedObj = _mselected[ 0 ];
    if( selectedObj.props.awb0UnderlyingObject !== undefined ) { // We got an Awb0Element as input
        selectedObj = cdm.getObject( selectedObj.props.awb0UnderlyingObject.dbValues[ 0 ] );
    }
    appCtxSvc.updatePartialCtx( 'compareList.sourceSelection', selectedObj );

    selectedObj = _mselected[ 1 ];
    if( selectedObj.props.awb0UnderlyingObject !== undefined ) { // We got an Awb0Element as input
        selectedObj = cdm.getObject( selectedObj.props.awb0UnderlyingObject.dbValues[ 0 ] );
    }
    appCtxSvc.updatePartialCtx( 'compareList.targetSelection', selectedObj );

    var compareList = appCtxSvc.getCtx( 'compareList' );
    toParams.uid = compareList.sourceSelection.uid;
    toParams.uid2 = compareList.targetSelection.uid;
    toParams.pci_uid = '';
    toParams.pci_uid2 = '';
    if( appCtxSvc.getCtx( 'aceActiveContext.context' ) ) {
        if( appCtxSvc.getCtx( 'aceActiveContext.context.elementToPCIMap' ) ) {
            /**
             * While launching Compare from within saved working context, we want to use saved
             * configuration.
             */
            toParams.pci_uid = occmgmtUtils.getProductContextForProvidedObject( _mselected[ 0 ] );
            toParams.pci_uid2 = occmgmtUtils.getProductContextForProvidedObject( _mselected[ 1 ] );
        } else {
            /**
             * While launching Compare from within ACE, we would have same configuration for both source and
             * target structure.
             */
            var _contentPCIUid = appCtxSvc.getCtx( 'aceActiveContext.context.productContextInfo.uid' );
            toParams.pci_uid = _contentPCIUid;
            toParams.pci_uid2 = _contentPCIUid;
        }
    }
    var transitionTo = 'com_siemens_splm_clientfx_tcui_xrt_showMultiObject';
    LocationNavigationService.instance.go( transitionTo, toParams, {} );
};

export let executeCompare = function( newCompareContext, _sourceVMOs, _targetVMOs, compareContext ) {
    let contextKeys = awStructureCompareUtils.getContextKeys();
    let topSrcElement = appCtxSvc.getCtx( contextKeys.leftCtxKey + '.topElement' );
    let topTrgElement = appCtxSvc.getCtx( contextKeys.rightCtxKey + '.topElement' );
    if( topSrcElement.uid !== topTrgElement.uid && awStructureCompareUtils.getChildCount( topSrcElement ) > 0 && awStructureCompareUtils.getChildCount( topTrgElement ) > 0 ) {
        // Perform compare only on the first open of both the
        // structures. Subsequently, there should be an explicit call
        // to refresh the results
        let datasetUID = appCtxSvc.getCtx( 'compareContext.datasetUid' );
        let compareInput = compareGetSvc.createSOAInputForPaginationAndVisibleUids( newCompareContext, -2, false, false,
            awStructureCompareUtils.getDefaultCursor(), awStructureCompareUtils.getDefaultCursor(), _sourceVMOs, _targetVMOs, datasetUID );
        let deferred = AwPromiseService.instance.defer();
        awStructureCompareSvc.performCompare( newCompareContext, compareInput, false, false, compareContext, deferred );
        if( datasetUID ) {
            appCtxSvc.updatePartialCtx( 'compareContext.datasetUid', null );
        }
        return deferred.promise;
    }
};

export let openCompareNotification = function( notificationObject ) {
    dataManagementSvc.getProperties( [ notificationObject.object.uid ], [ 'fnd0MessageBody' ] ).then(
        function() {
            let dataSetUid = notificationObject.object.uid;
            let notificationObjWithNewProps = cdm.getObject( dataSetUid );
            let str = notificationObjWithNewProps.props.fnd0MessageBody.dbValues[ '0' ];
            let srcUidToken = '?uid=';
            let srcPcidToken = '&pci_uid=';
            let tgtUidToken = '&uid2=';
            let tgtPcidToken = '&pci_uid2=';
            let srcUid = str.indexOf( srcUidToken ) !== -1 ? str.substring( str.indexOf( srcUidToken ) + srcUidToken.length, str
                .indexOf( srcPcidToken ) ) : notificationObject.object.uid;
            let srcPcuid = str.indexOf( srcPcidToken ) !== -1 ? str.substring( str.indexOf( srcPcidToken ) + srcPcidToken.length, str
                .indexOf( tgtUidToken ) ) : null;
            let trgUid = str.indexOf( tgtUidToken ) !== -1 ? str.substring( str.indexOf( tgtUidToken ) + tgtUidToken.length, str
                .indexOf( tgtPcidToken ) ) : null;
            let trgPcuid = str.indexOf( tgtPcidToken ) !== -1 ? str.substring( str.indexOf( tgtPcidToken ) + tgtPcidToken.length ) : null;

            dataManagementSvc.loadObjects( [ srcUid, srcPcuid, trgUid, trgPcuid ] ).then( function() {
                let _urlParams = AwStateService.instance.params;
                _.forEach( _urlParams, function( value, name ) {
                    AwStateService.instance.params[ name ] = null;
                } );
                let transitionTo = 'com_siemens_splm_clientfx_tcui_xrt_showObject';
                let toParams = AwStateService.instance.params;
                toParams.uid = srcUid;

                if( trgUid ) {
                    transitionTo = 'com_siemens_splm_clientfx_tcui_xrt_showMultiObject';
                    toParams.pci_uid = srcPcuid;
                    toParams.uid2 = trgUid;
                    toParams.pci_uid2 = trgPcuid;

                    if( appCtxSvc.getCtx( 'splitView' ) ) {
                        appCtxSvc.updatePartialCtx( 'refreshViewOnNotificationClick', true );
                        eventBus.publish( 'occTreeTable.plTable.reload' );
                        eventBus.publish( 'occTreeTable2.plTable.reload' );
                    }
                    appCtxSvc.updatePartialCtx( 'compareContext.datasetUid', dataSetUid );
                    appCtxSvc.updatePartialCtx( 'compareContext.autoOpenComparePanel', true );
                    appCtxSvc.updatePartialCtx( 'compareContext.isMultiStructureFirstLaunch', true );
                }
                let options = {};
                options.reload = true;
                LocationNavigationService.instance.go( transitionTo, toParams, options );
            } );
        } );
};

export let toggleSourcePanelCollapseState = ( panelName, isCollapsed ) => {
    if( panelName === 'source' ) {
        return isCollapsed;
    }
    return true;
};

export let toggleTargetPanelCollapseState = ( panelName ) => {
    if( panelName === 'target' ) {
        return false;
    }
    return true;
};

export let collapseSourceAndTargetPanels = () => {
    return { isSourcePanelCollapsed: true, isTargetPanelCollapsed: true };
};

export let syncExpansion = ( vmc, equivalentList, node ) => {
    if( node.isSystemExpanded ) {
        appCtxSvc.updatePartialCtx( 'skipCompareOnSystemExpansion', true );
        node.isSystemExpanded = false;
    } else if( node.isExpanded ) {
        awStructureCompareSvc.toggleEquivalentRow( vmc, equivalentList, node.uid );
    }
};

export let setResetOnProductChangeFlag = ( compareContext ) => {
    const newCompareContext = { ...compareContext };
    newCompareContext.resetOnProductChange = true;
    return newCompareContext;
};

let isSelectionNeeded = function( selectedObj1, selectedObj2 ) {
    if( selectedObj1 && selectedObj2 && selectedObj1.length > 0 && selectedObj2.length > 0 ) {
        return selectedObj1[ 0 ].uid !== selectedObj2[ 0 ].uid;
    }
    //No selection is made so far
    return true;
};

let updatePanelSelection = function( selectedObjects, panelSelected, selectionModel ) {
    if( isSelectionNeeded( selectedObjects, panelSelected ) && selectionModel ) {
        selectionModel.setSelection( selectedObjects );
    }
};

let resetCrossSelectionFlag = _.debounce( function() {
    _crossSelectionSyncFlag = false;
}, 500 );

export let propagateSelectionToPanel = ( occContext, inactiveContext, data, isInCompareMode ) => {
    if( isInCompareMode && _crossSelectionSyncFlag ) {
        let compareSrc;
        let compareTrg;
        if( occContext.viewKey === 'occmgmtContext' ) {
            compareSrc = occContext;
            compareTrg = inactiveContext;
        } else {
            compareSrc = inactiveContext;
            compareTrg = occContext;
        }
        let selectedObjects;
        if( data.dataProviders.getSourceDiffResults ) {
            selectedObjects = compareSrc.pwaSelection[ 0 ].uid !== compareSrc.topElement.uid ? compareSrc.pwaSelection : [];
            updatePanelSelection( selectedObjects, data.selectionData.selected, data.dataProviders.getSourceDiffResults.selectionModel );
        }
        if( data.dataProviders.getTargetDiffResults ) {
            selectedObjects = compareTrg.pwaSelection[ 0 ].uid !== compareTrg.topElement.uid ? compareTrg.pwaSelection : [];
            updatePanelSelection( selectedObjects, data.selectionData2.selected, data.dataProviders.getTargetDiffResults.selectionModel );
        }
    }
};

export let propagateSelectionToGrid = function( occContext, dp ) {
    if( _crossSelectionSyncFlag ) {
        return;
    }
    let selection = dp.selectedObjects;
    selection = selection === undefined ? [] : selection;
    const selectionsToModify = {
        elementsToSelect: selection,
        overwriteSelections: true
    };
    if( isSelectionNeeded( occContext.pwaSelection, selection ) ) {
        occmgmtUtils.updateValueOnCtxOrState( 'selectionsToModify', selectionsToModify, occContext );
    }
};

export let syncSelection = ( occContext, occContext2, compareContext, grid ) => {
    if( _crossSelectionSyncFlag || !compareContext.isInCompareMode ) {
        return;
    }

    let selectedObjects = [];
    if( grid === 1 ) {
        selectedObjects = occContext.selectedModelObjects;
        selectedObjects = selectedObjects[ 0 ].uid !== occContext.topElement.uid ? selectedObjects : [];
    } else if( grid === 2 ) {
        selectedObjects = occContext2.selectedModelObjects;
        selectedObjects = selectedObjects[ 0 ].uid !== occContext2.topElement.uid ? selectedObjects : [];
    }
    _crossSelectionSyncFlag = true;
    resetCrossSelectionFlag();

    // Publish the event that eventually calls propagateSelectionToPanel()
    eventBus.publish( 'propagateSelectionToPanelEvent' );

    awStructureCompareSvc.navigateDifferences( occContext, occContext2, compareContext, grid, selectedObjects, false );
};

export let resetGridSelectionModel = ( occContext, occContext2, isInCompareMode ) => {
    let mode = isInCompareMode ? 'single' : 'multiple';
    updateSelectionMode( occContext, mode );
    updateSelectionMode( occContext2, mode );
};

let updateSelectionMode = function( occContext, mode ) {
    if( occContext.treeDataProvider && occContext.treeDataProvider.selectionModel ) {
        occContext.treeDataProvider.selectionModel.setMode( mode );
        let selectedObjs = occContext.treeDataProvider.selectionModel.getSelection();
        if( selectedObjs.length > 1 ) {
            //Multiselection case where we need to manually set selection to last element.
            occContext.treeDataProvider.selectionModel.setSelection( [ selectedObjs[ selectedObjs.length - 1 ] ] );
        }
    }
};

export let setCompareResultSectionTitles = ( data, subPanelContext ) => {
    let sourceTitle = subPanelContext.compareContext.compareList.sourceSelection.props.object_string.uiValues[ 0 ];
    let targetTitle = subPanelContext.compareContext.compareList.targetSelection.props.object_string.uiValues[ 0 ];

    // The dbValue of compareOption is 1 it means that the current level option is opted for comparison.
    // As as result we want show the selected object as a title in the compare panel.
    if( data.compareOption.dbValue === 1 ) {
        sourceTitle = subPanelContext.compareContext.compareList.cmpSelection1.props.object_string.uiValues[ 0 ];
        targetTitle = subPanelContext.compareContext.compareList.cmpSelection2.props.object_string.uiValues[ 0 ];
    }

    return {
        sourceTitle: sourceTitle,
        targetTitle: targetTitle
    };
};

/**
 * Need to clear the compare result in case of scheme overlay mode.
 *
 */
export let clearCompareContextForPartitionCompare = function( compareContext, data ) {
    if( data.conditions.isPartitionSchemeApplied ) {
        let newCompareContext = {};
        compareContext.update( newCompareContext );
        awStructureCompareSvc.resetCompareColorData( compareContext );
    }
};

export default exports = {
    initializeCompareData,
    setUpCompareContext,
    executeFromComparePanel,
    resetCompareContext,
    setDefaultDisplayOptions,
    launchContentCompare,
    executeCompare,
    openCompareNotification,
    toggleSourcePanelCollapseState,
    toggleTargetPanelCollapseState,
    collapseSourceAndTargetPanels,
    performAutoCompare,
    syncExpansion,
    setResetOnProductChangeFlag,
    propagateSelectionToPanel,
    propagateSelectionToGrid,
    syncSelection,
    resetGridSelectionModel,
    setCompareResultSectionTitles,
    clearCompareContextForPartitionCompare,
    resetProductListener
};
