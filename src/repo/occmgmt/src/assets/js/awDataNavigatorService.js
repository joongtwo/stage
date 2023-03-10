// Copyright (c) 2022 Siemens

/**
 * @module js/awDataNavigatorService
 */
import appCtxSvc from 'js/appCtxService';
import aceConfiguratorTabsEvaluationService from 'js/aceConfiguratorTabsEvaluationService';
import _ from 'lodash';
import Debug from 'debug';
import eventBus from 'js/eventBus';
import occmgmtUtils from 'js/occmgmtUtils';
import cdm from 'soa/kernel/clientDataModel';
import logger from 'js/logger';
import selectionService from 'js/selection.service';
import cadBomOccurrenceAlignmentSvc from 'js/CadBomOccurrenceAlignmentService';
import editHandlerSvc from 'js/editHandlerService';
import ctxStateMgmtService from 'js/contextStateMgmtService';
import occmgmtSublocationService from 'js/occmgmtSublocationService';
import occmgmtUpdatePwaDisplayService from 'js/occmgmtUpdatePwaDisplayService';
import { urlParamsMap } from 'js/occmgmtSublocationService';
import occmgmtStateHandler from 'js/occurrenceManagementStateHandler';
import acePartialSelectionService from 'js/acePartialSelectionService';
const trace = new Debug( 'selection' );

var exports = {};
export let initializeDataNavigator = function( data, subPanelContext, propContextKey, provider ) {
    let acePwaContext = provider ? provider : subPanelContext.provider;
    //TOCHECK : When key is present in subPanelContext, why are we re-populating it?
    const contextKey = propContextKey ? propContextKey : subPanelContext.provider.contextKey;
    appCtxSvc.updatePartialCtx( subPanelContext.contextKey + '.sublocation.clientScopeURI', subPanelContext.provider.clientScopeURI );
    appCtxSvc.updatePartialCtx( subPanelContext.contextKey + '.sublocation.defaultClientScopeURI', subPanelContext.provider.clientScopeURI );

    appCtxSvc.registerCtx( 'objectQuotaContext', {
        useObjectQuota: true
    } );
    if( data && data.aceSearchPolicyOverride ) {
        appCtxSvc.registerCtx( 'aceSearchPolicyOverride', data.aceSearchPolicyOverride );
    }

    return {
        contextKey,
        acePwaContext,
        alternateSelection: null
    };
};

export let destroyDataNavigator = function( data ) {
    appCtxSvc.unRegisterCtx( 'objectQuotaContext' );
    appCtxSvc.unRegisterCtx( 'isRedLineMode' );
    delete appCtxSvc.ctx[ 'ActiveWorkspace:xrtContext' ];
};

/**
   * @param {Object} newState - Changed param-value map
   *
   * @return {Boolean} true if there is any change compared to existing values
   */
function _haveTopParamsOrTheirValuesChanged( newState, previousState ) {
    var changed = false;

    _.forEach( newState, function( value, name ) {
        /**
           * Check if we don't care about this parameter.
           */
        if( name !== 't_uid' || name === 'uid' ) {
            return true;
        }

        if(
            !previousState || !previousState.hasOwnProperty( name ) ||
              previousState[ name ] !== value ) {
            changed = true;
            return false;
        }
    } );

    return changed;
} // _haveTopParamsOrTheirValuesChanged

/**
   * @param {Object} newState - changed param-value map
   *
   * @return {Boolean} true if there is any change compared to existing values
   */
function _havePwaParamsOrTheirValuesChanged( newState, subPanelContext, previousState ) {
    var changed = false;

    _.forEach( newState, function( value, name ) {
        /**
           * Check if we don't care about this parameter. Eventually, we want to stop reload via currentState route.
           * Setting atomic data with pwaReset to true should be the way forward.
           *
           * Long term :
           * 1) Stop listening to currentState update in awDataNavigatorViewModel.json
           * 2) Reload call in syncPWASelection call.
           * 3) Looking for URL param updates for reload decision
           * 4) Let applications directly say that they want to reset.
           */
        if( name === 'page' || name === 'pageId' || name === urlParamsMap.selectionQueryParamKey ||
              name === 'pci_uid' || name === 'spageId' || name === 'incontext_uid' || name === 'filter' || name === 'uid' ) {
            return true;
        }

        /**
           * We don't care about o_uid changes when we are in tree viewMode.
           */
        // revisitMe - viewConfig will not be available on subPanelContext (It was done by aw.nav.controller - which is no more applicable)
        if( name === 'o_uid' ) { // && subPanelContext.viewConfig.view === 'tree' ) {
            return true;
        }

        if( !previousState || !previousState.hasOwnProperty( name ) ||
              previousState[ name ] !== value ) {
            changed = true;
            return false;
        }
    } );

    return changed;
} //_havePwaParamsOrTheirValuesChanged

function _isValidToRetrievePCIFromHierarchy( parentObject, selectedObject ) {
    var remoteSubsetSelected = false;
    var isObjectBOMWorkset = false;
    if( parentObject && parentObject.props && parentObject.props.awb0UnderlyingObject ) {
        var underlyingObjUid = parentObject.props.awb0UnderlyingObject.dbValues[ 0 ];
        var modelObjForUnderlyingObj = cdm.getObject( underlyingObjUid );
        if( modelObjForUnderlyingObj.modelType.typeHierarchyArray.indexOf( 'Fnd0WorksetRevision' ) > -1 ) {
            isObjectBOMWorkset = true;
            if( selectedObject && selectedObject.props && selectedObject.props.awb0ArchetypeId && selectedObject.props.awb0ArchetypeId.dbValues[ 0 ] === '' ) {
                remoteSubsetSelected = true;
            }
        }
    }
    return remoteSubsetSelected || !isObjectBOMWorkset;
} // _isValidToRetrievePCIFromHierarchy

var reloadPrimaryWorkArea = function( newState, subPanelContext, previousState, pwaSelectionModel ) {
    if( occmgmtUtils.isTreeView() && _haveTopParamsOrTheirValuesChanged( newState, previousState ) ) {
        resetPwaContents( pwaSelectionModel );
    } else if( _havePwaParamsOrTheirValuesChanged( newState, subPanelContext, previousState ) ) {
        resetPwaContents( pwaSelectionModel );
    }
};

export let getParentUid = function( context ) {
    if( context.view === 'tree' ) {
        return appCtxSvc.ctx[ context.contextKey ].currentState.t_uid;
    }
    return appCtxSvc.ctx[ context.contextKey ].currentState.o_uid;
};

/**
   * Ensure the correct object is selected
   *
   * @param {String} uidToSelect - The uid of the object that should be selected
   */
let updatePWASelection = function( subPanelContext, uidToSelect, pwaSelectionModel ) {
    let contextKey = subPanelContext.contextKey;
    let newSelection = [];
    let currentSelection = pwaSelectionModel.getSelection();
    let currentState = subPanelContext.occContext.currentState;
    /*Control comes to this function when we update current state. From different flows like select on open, select on cross select,
      select on pwa selection. When currentState is updated by some source to update selection ( source like breadcrumb ),
      this API updates pwaSelection for us. But when user select in pwa itself, this call is redundant as selection is already present
      in selection model. But control comes here as we update currentState to keep state in sync. We should do nothing if selection present */
    if( !_.isEmpty( currentSelection ) && currentSelection.indexOf( uidToSelect ) !== -1 ) {
        return;
    }

    if( uidToSelect ) {
        //If multi select is enabled ignore single select changes
        if( pwaSelectionModel.getCurrentSelectedCount() < 2 || currentState.o_uid !== currentState.c_uid ) {
            if( ( occmgmtUtils.isTreeView() || occmgmtUtils.isResourceView() ) && uidToSelect === getParentUid( { view: 'tree', contextKey: contextKey } ) && subPanelContext.occContext.showTopNode ) {
                /*TODO : after standard sub-location adoption, base-selection is broken.
                   Commenting this. It will affect Port selection from Architecture tab (need to check flow in new world)
                   */
                newSelection = []; //[ uidToSelect ];
            } else if( uidToSelect === getParentUid( { view: 'tree', contextKey: contextKey } ) &&
                  ( pwaSelectionModel.getCurrentSelectedCount() < 2 && !pwaSelectionModel.isMultiSelectionEnabled() ) ) {
                //Ensure the base selection is the only selection
                newSelection = [];
            } else {
                //set new selection if markUpEnabled and not in multiselect.
                //Add new uid to selection if more than one selectedobjects
                if( uidToSelect !== getParentUid( { view: 'tree', contextKey: contextKey } ) ) {
                    if( pwaSelectionModel.getCurrentSelectedCount() > 1 || pwaSelectionModel.isMultiSelectionEnabled() ) {
                        pwaSelectionModel.addToSelection( [ uidToSelect ] );
                        return;
                    }
                    newSelection = [ uidToSelect ];
                }
            }
        }
    }

    if( !_.isEqual( currentSelection, newSelection ) ) {
        var newSelections = newSelection.map( function( selectedUid ) {
            return cdm.getObject( selectedUid );
        } );
        pwaSelectionModel.setSelection( newSelection );
        //pwaSelectionModel.selectionData.update( { selected: newSelections } );
    }
};

export let syncContextWithPWASelection = function( eventData, subPanelContext, contextKey, pwaSelectionModel ) {
    var newState;
    var previousState;
    if( eventData ) {
        newState = eventData.value[ contextKey ].currentState;
        previousState = eventData.value[ contextKey ].previousState;
    } else {
        newState = subPanelContext.occContext.currentState;
        previousState = subPanelContext.occContext.previousState;
    }
    //Tree will be loaded by dataProvider on 1st load. No need to force reload PWA. It triggers multiple SOA calls.
    if( _.isEmpty( previousState ) ) {
        return;
    }
    reloadPrimaryWorkArea( newState, subPanelContext, previousState, pwaSelectionModel );
    if( newState.hasOwnProperty( urlParamsMap.selectionQueryParamKey ) ) {
        updatePWASelection( subPanelContext, newState[ urlParamsMap.selectionQueryParamKey ], pwaSelectionModel );
    }
};

export let syncRootElementInfoForProvidedSelection = function( productInfo, subPanelContext ) {
    if( productInfo && productInfo.rootElement ) {
        var currentRootElement = subPanelContext.occContext.rootElement;
        if( !currentRootElement || currentRootElement.uid !== productInfo.rootElement.uid ) {
            appCtxSvc.updatePartialCtx( subPanelContext.contextKey + '.rootElement', productInfo.rootElement );
        }
    }
};

/**
   * @param {Object} selectedObject Object representing selection made by the user
   * @param {Object} occContext Object representing ACE atomic data
   *
   * @return {Object} Uid of the productContext corresponding to the selected object if it is available in
   *         the elementToPCIMap; the productContext from the URL otherwise and rootElement for current selected object.
   */
export let getProductInfoForCurrentSelection = function( selectedObject, occContext ) {
    //Default productInfo is current info
    let productInfo = {
        newPci_uid: _getDefaultProductContextInfo( selectedObject, occContext )
    };
    let elementToPCIMap = occContext.elementToPCIMap;

    if( elementToPCIMap ) {
        var parentObject = selectedObject;
        do {
            if( parentObject && elementToPCIMap[ parentObject.uid ] ) {
                productInfo.rootElement = parentObject;
                productInfo.newPci_uid = elementToPCIMap[ parentObject.uid ];

                return productInfo;
            }

            var parentUid = occmgmtUtils.getParentUid( parentObject );
            parentObject = cdm.getObject( parentUid );
        } while( parentObject && _isValidToRetrievePCIFromHierarchy( parentObject, selectedObject ) );
    } else {
        productInfo.rootElement = occContext.topElement;
    }

    return productInfo;
};

/**
   * @param {Object} selectedObject Object representing selection made by the user
   * @param {Object} occContext Object representing ACE atomic data
   *
   * @return {Object} Uid of the productContext corresponding to the selected object if it is available in
   *         the elementToPCIMap; the productContext from the URL otherwise and rootElement for current selected object.
   */
function _getDefaultProductContextInfo( selectedObject, occContext ) {
    let pci_uid = occContext.currentState.pci_uid;
    if( selectedObject && selectedObject.props && selectedObject.props && selectedObject.modelType.typeHierarchyArray.indexOf( 'Fnd0AppSession' ) > -1 ) {
        for( var k in occContext.elementToPCIMap ) {
            let pci = occContext.elementToPCIMap[ k ];
            let pciObject = cdm.getObject( pci );
            if( pciObject ) {
                let productObject = cdm.getObject( pciObject.props.awb0Product.dbValues[ 0 ] );
                if( productObject && productObject.modelType.typeHierarchyArray.indexOf( 'Fnd0WorksetRevision' ) > -1 ) {
                    pci_uid = pci;
                    break;
                }
            }
        }
    }
    return pci_uid;
}

export let populateVisibleServerCommands = function( data, occContext ) {
    let currentSelection;
    if( occContext.selectedModelObjects && occContext.selectedModelObjects.length > 0 ) {
        currentSelection = occContext.selectedModelObjects[ 0 ].uid;
    }
    let SoaSelection = _.get( data.soaInput.getVisibleCommandsInfo[ 0 ].selectionInfo.filter( function( selection ) {
        return selection.parentSelectionIndex === 1;
    } )[ 0 ], 'selectedObjects.0.uid' );
    if( currentSelection === SoaSelection ) {
        appCtxSvc.updatePartialCtx( occContext.viewKey + '.visibleServerCommands', data.visibleCommandsInfo );
    }
};

export const updatePwaContextInformation = ( data, subPanelContext, pwaSelectionModel ) => {
    const alternateSelection = subPanelContext.occContext.baseModelObject;
    // ToDo - Remove below line once selectedModelObjects is removed from appCtx
    if( subPanelContext.occContext.selectedModelObjects && subPanelContext.occContext.selectedModelObjects.length > 0 ) {
        appCtxSvc.updatePartialCtx( subPanelContext.contextKey + '.selectedModelObjects', subPanelContext.occContext.selectedModelObjects );
    }
    onPWASelectionChange( data, subPanelContext, data.contextKey, {
        source: 'server'
    }, pwaSelectionModel, null, null, subPanelContext.occContext.lastDpAction );
    return alternateSelection;
};

export const addUpdatedSelectionToPWA = ( data, eventData, contextKey, selectionModel, subPanelContext ) => {
    let viewToReact = eventData.viewToReact ? eventData.viewToReact : appCtxSvc.ctx.aceActiveContext.key;
    if( contextKey === viewToReact ) {
        //Select the objects provided by the event
        if( eventData.objectsToHighlight ) {
            acePartialSelectionService.setPartialSelection( eventData.objectsToSelect, eventData.objectsToHighlight );
        }

        let selectionsToModify = {
            elementsToSelect: eventData.objectsToSelect,
            overwriteSelections: true,
            nodeToExpandAfterFocus: eventData.nodeToExpandAfterFocus
        };

        modifyPwaSelections( selectionModel, subPanelContext.occContext, selectionsToModify );
        //Select the objects provided by the event
        if( eventData.objectsToHighlight ) {
            acePartialSelectionService.setPartialSelection( eventData.objectsToSelect, eventData.objectsToHighlight );
            onPWASelectionChange( data, subPanelContext, data.contextKey, {
                source: 'server',
                retainExistingSelsInMSMode:true
            }, selectionModel, undefined, eventData.objectsToSelect );
        }
    }
};

export const removeSelectionFromPWA = ( eventData, contextKey, selectionModel, occContext ) => {
    if( eventData.elementsToDeselect && eventData.elementsToDeselect.length > 0 ) {
        let viewToReact = eventData.viewToReact ? eventData.viewToReact : appCtxSvc.ctx.aceActiveContext.key;

        if( contextKey === viewToReact ) {
            appCtxSvc.ctx[ contextKey ].silentSelection = eventData ? eventData.silentSelection : false;
            //Remove any matching objects from the model object list
            selectionModel.removeFromSelection( eventData.elementsToDeselect );
        }
    }
};

export const addSelectionToPWA = ( eventData, contextKey, selectionModel, occContext ) => {
    let viewToReact = eventData.viewToReact ? eventData.viewToReact : appCtxSvc.ctx.aceActiveContext.key;
    if( contextKey === viewToReact ) {
        let selectionsToModify = {
            elementsToSelect: eventData.elementsToSelect,
            overwriteSelections: eventData.overwriteSelections,
            nodeToExpandAfterFocus: eventData.nodeToExpandAfterFocus
        };

        modifyPwaSelections( selectionModel, occContext, selectionsToModify );
    }
};

export const modifyPwaSelections = ( selectionModel, occContext, selectionsToModify ) => {
    let occContextValue = { ...occContext.value };

    selectionsToModify = selectionsToModify ? selectionsToModify : occContextValue.selectionsToModify;

    if( !_.isEmpty( selectionsToModify.elementsToSelect ) || _.isEqual( selectionsToModify.overwriteSelections, true ) ) {
        let lastSelected = _.last( selectionsToModify.elementsToSelect );

        occContextValue.selectionSyncInProgress = selectionsToModify.elementsToSelect.length > 1;

        if( selectionsToModify.nodeToExpandAfterFocus ) {
            occContextValue.transientRequestPref.nodeToExpandAfterFocus = selectionsToModify.nodeToExpandAfterFocus;
        }
        if( selectionsToModify.overwriteSelections ) {
            selectionModel.setSelection( selectionsToModify.elementsToSelect );
        } else {
            if( selectionModel.getCurrentSelectedCount() > 1 || selectionModel.multiSelectEnabled ) {
                selectionModel.addToSelection( selectionsToModify.elementsToSelect );
            } else {
                selectionModel.setSelection( selectionsToModify.elementsToSelect );
            }
        }

        if( occContextValue.selectionSyncInProgress ) {
            occContextValue.elementsToCrossSelect = selectionsToModify.elementsToSelect;
        }
        occContextValue.selectionsToModify = {};

        if( _.isUndefined( lastSelected ) ) {
            delete occContextValue.currentState.c_uid;
        } else {
            occContextValue.currentState.c_uid = lastSelected.uid;
        }
        occmgmtUtils.updateValueOnCtxOrState( '', occContextValue, occContext );
    }
    if( !_.isEmpty( selectionsToModify.elementsToDeselect ) || _.isEqual( selectionsToModify.clearExistingSelections, true ) ) {
        var selectionsToClear = selectionsToModify.elementsToDeselect ? selectionsToModify.elementsToDeselect : selectionModel.getSelection();
        selectionModel.removeFromSelection( selectionsToClear );

        occContextValue.selectionsToModify = {};
        occmgmtUtils.updateValueOnCtxOrState( '', occContextValue, occContext );
    }
};

/**
   * Set XRTContextForPrimarySelection
   */
function _getXRTContextForPrimarySelection( subPanelContext, selectedModelObject ) {
    if( !( appCtxSvc.ctx.splitView && appCtxSvc.ctx.splitView.mode ) && selectedModelObject ) {
        let xrtContext = subPanelContext.occContext.xrtContext;
        if( !xrtContext ) {
            xrtContext = {};
        }
        if( subPanelContext.occContext.productContextInfo ) {
            xrtContext.productContextUid = subPanelContext.occContext.productContextInfo.uid;
        }
        xrtContext.selectedUid = selectedModelObject.uid;
        return xrtContext;
    }
}

export let onPWASelectionChange = function( data, subPanelContext, contextKey, selectionData, pwaSelectionModel, parentSelectionData, selections, lastDpAction ) {
    if( selectionData ) {
        let selectedObjs = undefined;
        let nodeToExpandAfterFocus = subPanelContext.occContext.transientRequestPref.nodeToExpandAfterFocus;
        let occContextValue = { ...subPanelContext.occContext.getValue() };
        if( selectionData.source === 'primary' ) {
            selectedObjs = _processSelectionChange( selectedObjs, occContextValue, selectionData, subPanelContext, data );
            aceConfiguratorTabsEvaluationService.evaluateConfiguratorTabsVisibility( selectedObjs, occContextValue );
        } else if( selectionData.source === 'base' ) {
            /*1) selection can be 'base' only when nothing is selected in PWA
              2) for Workset-Subset case, framework is updating selection change with source as 'base' even though there is
              selection in PWA
              3) This is incorrect call and should be ignored. Need to take this up with framework as to why this is coming.
              */
            let pwaSelectionEmpty = _.isEmpty( pwaSelectionModel.getSelection() );
            //let pwaSelectionIsSameAsBaseSel = !pwaSelectionEmpty && _.isEqual( pwaSelectionModel.getSelection()[0], selectionData.selected[0].uid );

            if( pwaSelectionEmpty ) {
                selectedObjs = _processSelectionChange( selectedObjs, occContextValue, selectionData, subPanelContext, data );
                aceConfiguratorTabsEvaluationService.evaluateConfiguratorTabsVisibility( selectedObjs, occContextValue );
            }
        } else if( selectionData.source === 'server' ) {
            if( lastDpAction === 'loadAndSelect' || lastDpAction === 'focusAction' ) {
                selectionData.retainExistingSelsInMSMode = true;
            }
            processSelectionFromServer( selections, pwaSelectionModel, subPanelContext, occContextValue, selectionData );
            if( lastDpAction === 'loadAndSelect' ) {
                //XRTContext update and URL currentState update already done in processSelectionFromServer, so passing false for last 2 parameters
                updateOccContextAndNotifyProductChangeIfApplicable( occContextValue, subPanelContext, false, false );
            }
            if( lastDpAction === 'initializeActionWithDeltaResponseTrueWithNoChange' ) {
                var eventData = {};
                eventData.refreshLocationFlag = true;
                eventData.relations = '';
                eventData.forceReloadAceSWA = true;
                eventData.relatedModified = [];
                eventData.relatedModified[0] = occContextValue.selectedModelObjects[0];
                eventBus.publish( 'cdm.relatedModified', eventData );
            }
        } else if( selectionData.source === 'secondary' ) {
            updateSecondarySelection( selectionData.selected, selectionData.relationInfo, subPanelContext.occContext.selectedModelObjects, data.alternateSelection );
        }
        if( nodeToExpandAfterFocus ) {
            eventBus.publish( subPanelContext.occContext.vmc.name + '.expandTreeNode', {
                parentNode: {
                    id: nodeToExpandAfterFocus
                }
            } );
        }
        parentSelectionData && parentSelectionData.update( selectionData );
        trace( 'AwDataNavigator selectionData: ', selectionData );
    } else {
        selectionService.updateSelection( [ data.alternateSelection ] );
    }
};

let updatePrimarySelection = function( occContextValue, parentSelection, subPanelContext ) {
    /**
       * LCS-174734: When we get a selection from the 'primaryWorkArea' we assume the processing
       * is complete and it is OK to start sending selections back to the host.
       */
    if( appCtxSvc.getCtx( 'aw_hosting_enabled' ) ) {
        appCtxSvc.updatePartialCtx( 'aw_hosting_state.ignoreSelection', false );
        let selectionSentFromHost = appCtxSvc.getCtx( 'aw_selection_sent_from_host' );
        //check for aligned lines if hosting is enabled
        if( ( appCtxSvc.ctx.aw_host_type === 'NX' || appCtxSvc.ctx.aw_host_type === 'TcIC' ) && !selectionSentFromHost ) {
            cadBomOccurrenceAlignmentSvc.getAlignedDesigns( occContextValue.selectedModelObjects, appCtxSvc.ctx.aw_host_type ).then( function() {
                updateSelectionIfApplicable( occContextValue.selectedModelObjects, parentSelection, subPanelContext.contextKey );
                if( !_.isEqual( occContextValue.selectedModelObjects, subPanelContext.occContext.selectedModelObjects ) ) {
                    updateOccContextAndNotifyProductChangeIfApplicable( occContextValue, subPanelContext );
                }
            } );
            return;
        }
        appCtxSvc.registerPartialCtx( 'aw_selection_sent_from_host', false );
    }

    //If selection is empty revert to base selection
    updateSelectionIfApplicable( occContextValue.selectedModelObjects, parentSelection, subPanelContext.contextKey );
    if( !_.isEqual( occContextValue.selectedModelObjects, subPanelContext.occContext.selectedModelObjects ) ) {
        updateOccContextAndNotifyProductChangeIfApplicable( occContextValue, subPanelContext );
    }else if( !_.isEqual( occContextValue.pwaSelectionSource, subPanelContext.occContext.pwaSelectionSource ) ) {
        //If user de-select top node and selection goes to base-selection ( or vice versa), there is no selection change but source changes
        occmgmtUtils.updateValueOnCtxOrState( 'pwaSelectionSource', occContextValue.pwaSelectionSource, subPanelContext.occContext );
    }
};

let updateSecondarySelection = function( selection, relationInfo, selectedModelObjects, parentSelection ) {
    //If everything was deselected
    if( !selection || selection.length === 0 ) {
        //Revert to the previous selection (primary workarea)
        selectionService.updateSelection( selectedModelObjects, parentSelection );
    } else {
        //Update the current selection with primary workarea selection as parent
        selectionService.updateSelection( selection, selectedModelObjects[ 0 ], relationInfo );
    }
};

var _cleanDeletedObjectFromChildrenStructure = function( parentObject, deletedObjectUid ) {
    let hasChildrenCountChanged = false;
    if( parentObject && parentObject.children && parentObject.children.length ) {
        _.remove( parentObject.children, function( childVmo ) {
            return childVmo.uid === deletedObjectUid;
        } );
        hasChildrenCountChanged = parentObject.totalChildCount !== parentObject.children.length;
        parentObject.totalChildCount = parentObject.children.length;
    }

    return hasChildrenCountChanged;
};

var updateParentVmoOfDeleted = function( deletedVmo, vmc ) {
    let parentObject = undefined;
    if( vmc ) {
        let parentObjectUid = occmgmtUtils.getParentUid( deletedVmo );
        let parentVmoNdx = vmc.findViewModelObjectById( parentObjectUid );
        parentObject = vmc.getViewModelObject( parentVmoNdx );
        _cleanDeletedObjectFromChildrenStructure( parentObject, deletedVmo.uid );
    }
};

export const removeObjectsFromCollection = ( eventData, subPanelContext ) => {
    if( eventData && eventData.deletedObjectUids && eventData.deletedObjectUids.length > 0 ) {
        let vmc = subPanelContext.occContext.vmc;
        let treeDataProvider = subPanelContext.occContext.treeDataProvider;
        if( treeDataProvider ) {
            let needsUpdatesOnCollection = false;
            let loadedVMOs = vmc.getLoadedViewModelObjects();
            let parentVMONeedsUpdate = false;

            _.forEach( eventData.deletedObjectUids, function( deletedObjectUid ) {
                _.forEach( loadedVMOs, function( vmo ) {
                    if( vmo && deletedObjectUid === vmo.uid ) {
                        if( vmo.isExpanded ) {
                            occmgmtUpdatePwaDisplayService.purgeExpandedNode( vmo, loadedVMOs );
                        }
                        //Update the parent VMO of deleted uids to reflect the correct children properties ( Drag-Drop, cut, remove)
                        updateParentVmoOfDeleted( vmo, vmc );
                        needsUpdatesOnCollection = true;
                    } else {
                        if( !parentVMONeedsUpdate ) {
                            parentVMONeedsUpdate = _cleanDeletedObjectFromChildrenStructure( vmo, deletedObjectUid );
                        }
                    }
                } );
            } );

            if( ( needsUpdatesOnCollection || parentVMONeedsUpdate ) && treeDataProvider ) {
                var collectionToUpdatedOnProvier = vmc.getLoadedViewModelObjects();
                treeDataProvider.update( collectionToUpdatedOnProvier );
            }
        }

        //kulkaamo: Event is already listened to by both views. As we are using contextKey now, this is not needed.
        // var inactiveView = occmgmtSplitViewUpdateService.getInactiveViewKey();
        // if( inactiveView ) {
        //     if( occmgmtSplitViewUpdateService.isConfigSameInBothViews() &&  appCtxSvc.ctx[ inactiveView ].vmc && appCtxSvc.ctx[ inactiveView ].treeDataProvider ) {
        //         updateVMCforDeletedNodes( eventData, appCtxSvc.ctx[ inactiveView ].vmc, appCtxSvc.ctx[ inactiveView ].treeDataProvider );
        //     }
        // }

        let elementToPCIMap = subPanelContext.occContext.elementToPCIMap;
        if( elementToPCIMap ) {
            var elementUidsInElementToPCIMap = Object.keys( elementToPCIMap );
            var keysToRemoveFromElementToPciMap = _.intersection(
                elementUidsInElementToPCIMap, eventData.deletedObjectUids );

            if( keysToRemoveFromElementToPciMap.length ) {
                _.forEach( keysToRemoveFromElementToPciMap, function( keyToRemoveFromElementToPciMap ) {
                    delete elementToPCIMap[ keyToRemoveFromElementToPciMap ];
                } );

                var elementsInElementToPCIMap = Object.keys( elementToPCIMap );
                //TODO - Below code will be removed once we cleanup usages of elementToPCIMap on global context
                appCtxSvc.updatePartialCtx( subPanelContext.contextKey + '.elementToPCIMap', elementToPCIMap );

                let occContextValue = { ...subPanelContext.occContext.value };
                occContextValue.elementToPCIMap = elementToPCIMap;
                occContextValue.elementToPCIMapCount = elementsInElementToPCIMap.length;
                occmgmtUtils.updateValueOnCtxOrState( '', occContextValue, subPanelContext.occContext );
            }
        }
    }
};

export const updateActiveWindow = ( eventData, data, subPanelContext, selectionData ) => {
    if( appCtxSvc.ctx.aceActiveContext.key !== eventData.key && eventData.key === data.contextKey ) {
        ctxStateMgmtService.updateActiveContext( eventData.key );
        onPWASelectionChange( data, subPanelContext, data.contextKey, selectionData );
    }
};

export const resetDataNavigator = ( eventData, contextKey, selectionModel ) => {
    var viewToReset = eventData && eventData.viewToReset ? eventData.viewToReset : appCtxSvc.ctx.aceActiveContext.key;
    if( contextKey === viewToReset ) {
        if( occmgmtUtils.isTreeView() && eventData && eventData.retainTreeExpansionStates === false && appCtxSvc.ctx[ contextKey ].vmc ) {
            eventBus.publish( appCtxSvc.ctx[ contextKey ].vmc.name + '.resetState' );
        }
        appCtxSvc.ctx[ contextKey ].silentReload = eventData ? eventData.silentReload : false;
        //TODO: reset self dp
        const dp = selectionModel.getDpListener();
        if( dp ) {
            //dp.selectNone();
            dp.resetDataProvider();
        }
    }
};

export const resetPwaContents = ( selectionModel ) => {
    const dp = selectionModel.getDpListener();
    if( dp && editHandlerSvc.editInProgress().editInProgress ) {
        editHandlerSvc.leaveConfirmation().then( function() {
            dp.resetDataProvider();
        } );
    } else if( dp ) {
        dp.resetDataProvider();
    }
};

export const expandNodeForExpandBelow = ( subPanelContext ) => {
    let vmc = subPanelContext.occContext.vmc;
    let loadedVMOs = vmc.getLoadedViewModelObjects();
    let vmoId = vmc.findViewModelObjectById( subPanelContext.occContext.transientRequestPref.scopeForExpandBelow );
    let vmoForExpandBelow = loadedVMOs[ vmoId ];
    vmoForExpandBelow.isExpanded = false;

    eventBus.publish( subPanelContext.occContext.vmc.name + '.expandTreeNode', {
        parentNode: {
            id: vmoForExpandBelow.id
        }
    } );
};

export const selectActionForPWA = ( selectionModel, eventData ) => {
    const dp = selectionModel.getDpListener();
    if( dp ) {
        if( eventData.selectAll ) {
            dp.selectAll();
        } else {
            dp.selectNone();
        }
    }
};

export const setShowCheckBoxValue = ( eventData ) => {
    return eventData.multiSelect;
};

export const multiSelectActionForPWA = ( selectionModel, eventData ) => {
    const dp = selectionModel.getDpListener();
    if( dp ) {
        dp.selectionModel.setMultiSelectionEnabled( eventData.multiSelect );
        return eventData.multiSelect;
    }
    return false;
};

export const handleHostingOccSelectionChange = ( eventData, selectionModel, contextKey ) => {
    if( appCtxSvc.ctx.aceActiveContext && appCtxSvc.ctx.aceActiveContext.key === contextKey ) {
        if( eventData.selected ) {
            if( eventData.operation === 'replace' ) {
                if( eventData.selected.length < 2 ) {
                    selectionModel.setMultiSelectionEnabled( false );
                }
                // Check to make sure the selection has changed
                var newSelection = true;
                for( var i = 0; i < eventData.selected.length; i++ ) {
                    if( selectionModel.isSelected( eventData.selected[ i ] ) ) {
                        newSelection = false;
                        break;
                    }
                }

                if( newSelection ) {
                    /**
                       * LCS-174734: When we get a selection request from a host we want to stop sending
                       * that 'host' any selections from this 'client' until this selection is reflected
                       * in the 'primaryWorkArea'.
                       */
                    appCtxSvc.registerPartialCtx( 'aw_hosting_state.ignoreSelection', true );
                    appCtxSvc.registerPartialCtx( 'aw_selection_sent_from_host', true );
                }
                selectionModel.setSelection( eventData.selected );
            } else if( eventData.operation === 'add' ) {
                selectionModel.addToSelection( eventData.selected );
            } else {
                /**
                   * Note: This default case is required to keep some non-hosting use of this hosting
                   * event. This default case will be removed once those uses are moved over to use
                   * another way to handle their selection.
                   */
                selectionModel.setSelection( eventData.selected );
            }
        }
    }
};

const updateSelectionIfApplicable = ( selection, parentSelection, contextKey ) => {
    if( !appCtxSvc.ctx[ contextKey ].silentReload && appCtxSvc.ctx.aceActiveContext.key === contextKey ) {
        selectionService.updateSelection( selection, parentSelection );
    } else {
        delete appCtxSvc.ctx[ contextKey ].silentReload;
    }
};

const updateOccContextAndNotifyProductChangeIfApplicable = function( occContextValue, subPanelContext, shouldUpdateXRTContext = true, shouldUpdateURL = true ) {
    let occContext = subPanelContext.occContext;
    let ctxValuesToUpdate = {
        selectedModelObjects: occContextValue.selectedModelObjects,
        currentState: occContextValue.currentState
    };

    let isProductChanged = !_.isEqual( occContext.value.productContextInfo, occContextValue.productContextInfo );

    if( !_.isEqual( occContextValue.productContextInfo, appCtxSvc.ctx[ subPanelContext.provider.contextKey ].productContextInfo ) ) {
        ctxValuesToUpdate.productContextInfo = occContextValue.productContextInfo;
        ctxValuesToUpdate.rootElement = occContextValue.rootElement;
        isProductChanged =  true;
    }
    if( shouldUpdateXRTContext ) {
        occContextValue.xrtContext = _getXRTContextForPrimarySelection( subPanelContext, occContextValue.selectedModelObjects[ 0 ] );
    }

    if( shouldUpdateURL ) {
        occmgmtSublocationService.updateUrlFromCurrentState( subPanelContext.provider, occContextValue.currentState );
    }

    let _occContextDiff = {};
    let _targetValue = occContext.value;
    for( const item in occContextValue ) {
        if( _targetValue.hasOwnProperty( item ) ) {
            if( !_.isEqual( occContextValue[ item ], _targetValue[ item ] ) ) {
                _occContextDiff[ item ] = occContextValue[ item ];
            }
        }else{
            _occContextDiff[ item ] = occContextValue[ item ];
        }
    }

    if( _targetValue.selectionSyncInProgress ) {
        _occContextDiff.selectionSyncInProgress = false;
        _occContextDiff.elementsToCrossSelect = {};
    }

    if( _.keys( _occContextDiff ).length > 0 ) {
        occmgmtUtils.updateValueOnCtxOrState( '', _occContextDiff, occContext );
    }
    occmgmtUtils.updateValueOnCtxOrState( '', ctxValuesToUpdate, occContext.viewKey );

    if( isProductChanged ) {
        let occDataLoadedEventData = {
            dataProviderActionType: 'productChangedOnSelectionChange'
        };
        eventBus.publish( 'occDataLoadedEvent', occDataLoadedEventData );
        let productChangedEventData = {
            newProductContextUID: occContextValue.productContextInfo.uid
        };
        eventBus.publish( 'ace.productChangedEvent', productChangedEventData );
    }
};

const occUpdateStateForSelection = function( occContextValue, subPanelContext ) {
    let selectedObjs = occContextValue.selectedModelObjects;
    if( selectedObjs.length > 0 ) {
        /**
           * Attempt to locate the single selection object
           */
        var selObj = selectedObjs[ selectedObjs.length - 1 ];

        if( selObj ) {
            /**
               * Set the 'o_uid' to the selected object's immediate parent if one exists
               */
            var parentObj = occmgmtUtils.getParentUid( selObj );
            if( parentObj ) {
                occContextValue.currentState.o_uid = parentObj;
            } else if( subPanelContext.occContext.currentState.c_uid !== occContextValue.currentState.c_uid ) {
                occContextValue.currentState.o_uid = selObj.uid;
            }
        }
    }
    _syncRootElementAndPCIOnSelectionChange( occContextValue, subPanelContext );
};

function _processSelectionChange( selectedObjs, occContextValue, selectionData, subPanelContext, data ) {
    selectedObjs = occContextValue.selectionSyncInProgress ? occContextValue.elementsToCrossSelect : selectionData.selected.map( function( obj ) {
        return cdm.getObject( obj.uid );
    } ).filter( function( mo, idx ) {
        if ( !mo ) {
            logger.error( selectionData.selected[idx].uid + ' was selected but is not in CDM!' );
        }
        return mo;
    } );

    // update the partial selection on removed selections
    acePartialSelectionService.removePartialSelection( selectedObjs /* new selections */, occContextValue.selectedModelObjects /* old selections */ );

    let lastSelected = _.last( selectedObjs );
    occContextValue.selectedModelObjects = selectedObjs;
    occContextValue.pwaSelection = selectedObjs;
    occContextValue.previousState = occContextValue.currentState;
    occContextValue.currentState[urlParamsMap.selectionQueryParamKey] = lastSelected.uid;
    //what should be initial value of pwaSelectionSource when selection comes from server?.
    //should be 'base' if focus is empty / 'primary' if top node/something is selected?. Will evaluate when that case comes.
    occContextValue.pwaSelectionSource = selectionData.source;

    //Add additional info into newState
    occUpdateStateForSelection( occContextValue, subPanelContext );
    updatePrimarySelection( occContextValue, data.alternateSelection, subPanelContext );
    return selectedObjs;
}

function processSelectionFromServer( selections, pwaSelectionModel, subPanelContext, occContextValue, selectionData ) {
    let currentSelection = pwaSelectionModel.selectionData.selected;
    let newSelection = subPanelContext.occContext.selectedModelObjects;
    let hasSelectionChanged = !_.isEqual( currentSelection, newSelection );

    if( hasSelectionChanged ) {
        let selectionsInMSMode = !selections && ( pwaSelectionModel.isMultiSelectionEnabled() || pwaSelectionModel.getCurrentSelectedCount() > 1 || newSelection.length > 1 );
        /*with reusebom window, existing selections, after server interaction may still be valid...
          In that case, existing selections get retained...its kind of RAC parity, but we want to enable it
          after addressing all gaps around it..so, retainExistingSelsInMSMode keeping true only for cross-select.
          For all other server intractions, we will goto single-select.
          */
        if( selectionsInMSMode ) {
            if ( selectionData.retainExistingSelsInMSMode ) {
                pwaSelectionModel.addToSelection( newSelection );
            }else {
                pwaSelectionModel.setSelection( newSelection );
            }
        } else {
            if( selections ) {
                newSelection = selections;
            }
            // pwaSelectionModel.setSelection() call would PWA component selection.
            //selectionService.updateSelection() would update global selection. We are supposed to update both.
            selectionService.updateSelection( newSelection, subPanelContext.occContext.baseModelObject );
            //kulkaamo : If we remove below update() call, TopNode is shown selected in UI...
            pwaSelectionModel.selectionData.update( { selected: newSelection } );
        }
        occContextValue.xrtContext = _getXRTContextForPrimarySelection( subPanelContext, newSelection[ 0 ] );
    }

    occmgmtSublocationService.updateUrlFromCurrentState( subPanelContext.provider, occContextValue.currentState, false );

    if( hasSelectionChanged ) {
        occUpdateStateForSelection( occContextValue, subPanelContext );
        occmgmtUtils.updateValueOnCtxOrState( '', occContextValue, subPanelContext.occContext );
    }
}

function _syncRootElementAndPCIOnSelectionChange( occContextValue, subPanelContext ) {
    var lastSelectedObject = cdm.getObject( occContextValue.currentState.c_uid );
    var productInfo = exports.getProductInfoForCurrentSelection( lastSelectedObject, subPanelContext.occContext );

    _syncPCIOnSelectionChange( productInfo, occContextValue, subPanelContext );
    syncRootElementInfoForProvidedSelection( productInfo, subPanelContext );
}

function _syncPCIOnSelectionChange( productInfo, occContextValue, subPanelContext ) {
    // We are not triggering either tree reload or pwa.reset for change in pci_uid
    // so make sure it has actually changed and then fire updatePartialCtx
    var currentPci_Uid = subPanelContext.occContext.currentState.pci_uid;
    if( productInfo && productInfo.newPci_uid && productInfo.newPci_uid !== currentPci_Uid ) {
        let newPCIObject = cdm.getObject( productInfo.newPci_uid );

        occContextValue.currentState.pci_uid = productInfo.newPci_uid;
        occContextValue.supportedFeatures = occmgmtStateHandler.getSupportedFeaturesFromPCI( newPCIObject );
        occContextValue.readOnlyFeatures = occmgmtStateHandler.getReadOnlyFeaturesFromPCI( newPCIObject );
        occContextValue.productContextInfo = newPCIObject;
        occContextValue.rootElement = productInfo.rootElement;
    }

    if( productInfo && !_.isEqual( occContextValue.rootElement, productInfo.rootElement ) ) {
        occContextValue.rootElement = productInfo.rootElement;
    }
}

export default exports = {
    initializeDataNavigator,
    destroyDataNavigator,
    syncContextWithPWASelection,
    getParentUid,
    syncRootElementInfoForProvidedSelection,
    getProductInfoForCurrentSelection,
    populateVisibleServerCommands,
    updatePwaContextInformation,
    addUpdatedSelectionToPWA,
    removeSelectionFromPWA,
    addSelectionToPWA,
    updateActiveWindow,
    resetDataNavigator,
    selectActionForPWA,
    setShowCheckBoxValue,
    multiSelectActionForPWA,
    onPWASelectionChange,
    resetPwaContents,
    modifyPwaSelections,
    removeObjectsFromCollection,
    expandNodeForExpandBelow,
    handleHostingOccSelectionChange
};

