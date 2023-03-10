// Copyright 2018 Siemens Product Lifecycle Management Software Inc.

/* global define */

/**
 * This service is create viewer context data
 *
 * @module js/structureViewerSelectionHandlerProvider
 */
import AwPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import csidsToObjSvc from 'js/csidsToObjectsConverterService';
import objectToCSIDGeneratorService from 'js/objectToCSIDGeneratorService';
import appCtxService from 'js/appCtxService';
import StructureViewerService from 'js/structureViewerService';
import objectsToPackedOccurrenceCSIDsService from 'js/objectsToPackedOccurrenceCSIDsService';
import viewerCtxSvc from 'js/viewerContext.service';
import _ from 'lodash';
import assert from 'assert';
import logger from 'js/logger';
import VisOccmgmtCommunicationService from 'js/visOccmgmtCommunicationService';
import viewerPerformanceService from 'js/viewerPerformance.service';

const SelectionTypes = {
    ROOT_PRODUCT_SELECTED: 'ROOT_PRODUCT_SELECTED',
    OCC_PARENT_SELECTED: 'OCC_PARENT_SELECTED',
    SAVED_BOOKMARK_SELECTED: 'SAVED_BOOKMARK_SELECTED',
    OCC_SELECTED: 'OCC_SELECTED'
};

/**
 * Class to hold the structure viewer selection data
 *
 * @constructor StructureViewerSelectionHandler
 * @param {Object} viewerContextData Viewer Context data
 */
export default class StructureViewerSelectionHandler {
    constructor( viewerContextData ) {
        assert( viewerContextData, 'Viewer context data can not be null' );
        this.isSelectionInProgress = false;
        this.selectionRequestToBeProcessed = null;
        this.viewerCtxData = viewerContextData;
        this.isViewerSelectionListenerAttached = false;
    }

    /**
     * Handle selection changes in ACE
     *
     * @param  {Object} eventData event data
     */
    selectionChangeEventHandler( eventData ) {
        if( !( eventData &&
                eventData.dataCtxNode &&
                eventData.dataCtxNode.context &&
                eventData.dataCtxNode.context.viewKey ===
                this.viewerCtxData.getOccmgmtContextKey() ) ) {
            return;
        }
        let aceSelectionModel = eventData.selectionModel;
        if( aceSelectionModel ) {
            let selections = _.compact( cdm.getObjects( aceSelectionModel.getSelection() ) );
            if( viewerPerformanceService.isPerformanceMonitoringEnabled() ) {
                if( this.viewerCtxData.getSelectionManager().getIs3DInitiatedSelection() ) {
                    this.viewerCtxData.getSelectionManager().setIs3DInitiatedSelection( false );
                    let selectionLength = eventData.selectionModel.getSelection().length;
                    viewerPerformanceService.stopViewerPerformanceDataCapture( 'Viewer to ACE tree selection : Time taken to select ' + selectionLength + ' items', 'viewerOrTreeSelection' );
                } else {
                    viewerPerformanceService.startViewerPerformanceDataCapture();
                }
            }
            if( !this.isSelectionInProgress ) {
                this.processSelectionEvent( selections, false );
            } else {
                this.selectionRequestToBeProcessed = {
                    selections: selections,
                    isPackUnpackPerformed: false
                };
            }
        }
    }

    /**
     * Handle selection changes in ACE
     *
     * @param  {Object} subPanelCtx subPanel context
     */
    handleSelectionChange( subPanelCtx ) {
        let isAceTreeGridSelection = this.viewerCtxData.getValueOnViewerAtomicData( 'aceTreeGridSelection' );
        let currentReqCounter = this.viewerCtxData.getSelectionManager().getIs3DInitiatedSelectionCounter();
        if( !isAceTreeGridSelection && currentReqCounter > 0 ) {
            this.viewerCtxData.getSelectionManager().set3DInitiatedSelectionCounter( false );
            return;
        }
        if( isAceTreeGridSelection ) {
            this.viewerCtxData.updateViewerAtomicData( 'aceTreeGridSelection', false );
        }
        if( subPanelCtx && subPanelCtx.context && subPanelCtx.context.occContext &&
            !Array.isArray( subPanelCtx.context.occContext.pwaSelection ) ||
            subPanelCtx.context.occContext.pwaSelection.length === 1 &&
            subPanelCtx.context.occContext.topElement.uid === subPanelCtx.context.occContext.pwaSelection[ 0 ].uid ) {
            let currentlySelectedCsids = this.viewerCtxData.getSelectionManager().getSelectedCsids();
            if( currentlySelectedCsids.length > 0 ) {
                this.selectInViewer( [], [], [] );
            }
            return;
        }
        if( viewerPerformanceService.isPerformanceMonitoringEnabled() ) {
            if( this.viewerCtxData.getSelectionManager().getIs3DInitiatedSelection() ) {
                this.viewerCtxData.getSelectionManager().setIs3DInitiatedSelection( false );
                let selectionLength = subPanelCtx.context.occContext.pwaSelection.length;
                viewerPerformanceService.stopViewerPerformanceDataCapture( 'Viewer to ACE tree selection : Time taken to select ' + selectionLength + ' items', 'viewerOrTreeSelection' );
            } else {
                viewerPerformanceService.startViewerPerformanceDataCapture();
            }
        }

        if( !this.isSelectionInProgress ) {
            this.processSelectionEvent( subPanelCtx.context.occContext.pwaSelection, false );
        } else {
            this.selectionRequestToBeProcessed = {
                selections: subPanelCtx.context.occContext.pwaSelection,
                isPackUnpackPerformed: false
            };
        }
    }

    /**
     * Handle selection changes due to scroll in ACE
     *
     * @param  {Object} eventData event data
     */
    onPackUnpackOperation( eventData ) {
        if( !( eventData && eventData.occContext && eventData.occContext.viewKey === this.viewerCtxData.getOccmgmtContextKey() ) &&
            !( eventData && eventData.viewToReact === this.viewerCtxData.getOccmgmtContextKey() ) ) {
            return;
        }
        let selections = null;
        if( eventData.occContext ) {
            selections = eventData.occContext.pwaSelection;
        }else{
            let occMgmtContext = appCtxService.getCtx( this.viewerCtxData.getOccmgmtContextKey() );
            selections = occMgmtContext.selectedModelObjects;
        }

        if( !this.isSelectionInProgress ) {
            this.processSelectionEvent( selections, true );
        } else {
            this.selectionRequestToBeProcessed = {
                selections: selections,
                isPackUnpackPerformed: true
            };
        }
    }

    /**
     * Select part in viewer
     *
     * @param {Array} selections selected model objects array
     * @param {Object} isPackedUnpackedActionPerformed is pack unpack performed
     */
    processSelectionEvent( selections, isPackedUnpackedActionPerformed ) {
        this.isSelectionInProgress = true;
        this.processSelectionEventInternal( selections, isPackedUnpackedActionPerformed ).then(
            function() {
                if( !_.isNull( this.selectionRequestToBeProcessed ) ) {
                    this.processSelectionEvent( this.selectionRequestToBeProcessed.selections, this.selectionRequestToBeProcessed.isPackedUnpackedActionPerformed );
                    this.selectionRequestToBeProcessed = null;
                } else {
                    this.isSelectionInProgress = false;
                }
            }.bind( this ),
            function() {
                this.isSelectionInProgress = false;
            }.bind( this ) );
    }

    /**
     * Select part in viewer
     *
     * @param {Array} selections selected model objects array
     * @param {Object} isPackedUnpackedActionPerformed is pack unpack performed
     * @returns {Promise} A promise that is resolved after selection
     */
    /* eslint-disable complexity */
    processSelectionEventInternal( selections, isPackedUnpackedActionPerformed ) {
        let returnPromise = AwPromiseService.instance.defer();
        // if( isMultiSelectionEnabled ) {
        //     this.viewerCtxData.getSelectionManager().setMultiSelectModeInViewer( true );
        // } else {
        //     this.viewerCtxData.getSelectionManager().setMultiSelectModeInViewer( false );
        // }
        let currentlySelectedModelObjs = this.viewerCtxData.getSelectionManager().getSelectedModelObjects();
        let currentlySelectedCsids = this.viewerCtxData.getSelectionManager().getSelectedCsids();
        let selectionType = this.getSelectionType( selections );
        let selectedPartitions = StructureViewerSelectionHandler.getPartitionCSIDs( selections );

        if( selectionType === SelectionTypes.OCC_SELECTED ) {
            if( !_.isNull( currentlySelectedModelObjs ) &&
                !_.isUndefined( currentlySelectedModelObjs ) &&
                !_.isEmpty( currentlySelectedModelObjs ) ) {
                let newSelectionLength = 0;
                if( selections ) {
                    newSelectionLength = selections.length;
                }
                let currentSelectionLength = currentlySelectedModelObjs.length;
                if( newSelectionLength === 0 ) {
                    this.viewerCtxData.getSelectionManager().selectPartsInViewerUsingModelObject(
                        selections );
                    this.viewerCtxData.getSelectionManager().selectPartsInViewerUsingCsid( [] );
                    returnPromise.resolve();
                } else if( newSelectionLength > currentSelectionLength ) { //Something got selected
                    let modelObjListToBeSelected = _.xor( currentlySelectedModelObjs, selections );
                    let newlySelectedCsids = _.cloneDeep( currentlySelectedCsids );
                    for( let i = 0; i < modelObjListToBeSelected.length; i++ ) {
                        if( !_.includes( modelObjListToBeSelected[ i ].modelType.typeHierarchyArray, 'Fgf0PartitionElement' ) ) {
                            newlySelectedCsids.push( objectToCSIDGeneratorService.getCloneStableIdChain( modelObjListToBeSelected[ i ] ) );
                        }
                    }
                    this.determineAndSelectPackedOccs( selections, newlySelectedCsids, selectedPartitions ).then( function() {
                        returnPromise.resolve();
                    }, function( errorMsg ) {
                        returnPromise.reject( errorMsg );
                    } );
                } else if( currentSelectionLength > newSelectionLength ) {
                    let commonModelObjects = _.intersection( currentlySelectedModelObjs, selections );
                    let newlySelectedCsids = null;
                    if( commonModelObjects.length > 0 ) {
                        //Something got deselected
                        let modelObjListToBeDeSelected = _.xor( currentlySelectedModelObjs, selections );
                        newlySelectedCsids = _.cloneDeep( currentlySelectedCsids );
                        for( let i = 0; i < modelObjListToBeDeSelected.length; i++ ) {
                            let csid = null;
                            if( _.includes( modelObjListToBeDeSelected[ i ].modelType.typeHierarchyArray, 'Fgf0PartitionElement' ) ) {
                                //uid of partition
                            } else {
                                csid = objectToCSIDGeneratorService.getCloneStableIdChain( modelObjListToBeDeSelected[ i ] );
                            }
                            let index = newlySelectedCsids.indexOf( csid );
                            if( index > -1 ) {
                                newlySelectedCsids.splice( index, 1 );
                            }
                        }
                        let occmgmtContext = StructureViewerService.instance.getOccmgmtContextFromViewerContext( this.viewerCtxData.getViewerCtxNamespace() );
                        let productCtx = occmgmtContext.productContextInfo;
                        let packedOccPromise = objectsToPackedOccurrenceCSIDsService.getCloneStableIDsWithPackedOccurrences(
                            productCtx, modelObjListToBeDeSelected );
                        if( packedOccPromise ) {
                            packedOccPromise.then( response => {
                                if( response.csids && response.csids.length > 1 ) {
                                    response.csids.forEach( csid => {
                                        let index = newlySelectedCsids.indexOf( csid );
                                        if( index > -1 ) {
                                            newlySelectedCsids.splice( index, 1 );
                                        }
                                    } );
                                }
                                this.selectInViewer( selections, newlySelectedCsids, selectedPartitions );
                                returnPromise.resolve();
                            } ).catch( errorMsg => {
                                returnPromise.reject( errorMsg );
                            } );
                        } else {
                            this.selectInViewer( selections, newlySelectedCsids, selectedPartitions );
                            returnPromise.resolve();
                        }
                    } else {
                        //We got entirely new set of selection from ACE tree. This scenarion occurs when we multiselect parts in ACE tree
                        //using control key and ACE does not enter multiselect mode. So, now if user clicks any other part,
                        //ACE tree will deselect all previously selected parts and only select new part. So, in viewer also
                        //we have update the selection entirely.
                        newlySelectedCsids = [];
                        for( let i = 0; i < selections.length; i++ ) {
                            if( !_.includes( selections[ i ].modelType.typeHierarchyArray, 'Fgf0PartitionElement' ) ) {
                                newlySelectedCsids.push( objectToCSIDGeneratorService.getCloneStableIdChain( selections[ i ] ) );
                            }
                        }

                        this.selectInViewer( selections, newlySelectedCsids, selectedPartitions );
                        returnPromise.resolve();
                    }
                } else { // When new and current selection length is same
                    if( newSelectionLength === 1 && currentSelectionLength - newSelectionLength === 0 ) {
                        //In case of current and new selection length is same and equals to 1, then determine and select packed occs only if
                        // 1) Packed operation is performed, hence perform packed occus selection in viewer.
                        //    OR
                        // 2) Current and new selections are not equal. This means there is some change in new selection and hence we need to determine packed ocuurences.
                        let newlySelectedModelObj = selections[ 0 ];
                        if( _.includes( newlySelectedModelObj.modelType.typeHierarchyArray, 'Fgf0PartitionElement' ) ) {
                            this.selectInViewer( selections, [], selectedPartitions );
                            returnPromise.resolve();
                        } else {
                            let newlySelectedCsids = [ objectToCSIDGeneratorService.getCloneStableIdChain( newlySelectedModelObj ) ];
                            if( isPackedUnpackedActionPerformed || !_.isEqual( newlySelectedCsids, currentlySelectedCsids ) ) {
                                this.determineAndSelectPackedOccs( selections, newlySelectedCsids, selectedPartitions ).then( function() {
                                    returnPromise.resolve();
                                }, function( errorMsg ) {
                                    returnPromise.reject( errorMsg );
                                } );
                            } else {
                                returnPromise.resolve();
                            }
                        }
                    } else if( isPackedUnpackedActionPerformed ) {
                        // if current and new selections are same and if their length is grater than 1, determine packed occus if packed operation is performed.
                        let newlySelectedCsids = [];
                        for( let i = 0; i < selections.length; i++ ) {
                            if( !_.includes( selections[ i ].modelType.typeHierarchyArray, 'Fgf0PartitionElement' ) ) {
                                newlySelectedCsids.push( objectToCSIDGeneratorService.getCloneStableIdChain( selections[ i ] ) );
                            }
                        }
                        this.determineAndSelectPackedOccs( selections, newlySelectedCsids, selectedPartitions ).then( function() {
                            returnPromise.resolve();
                        }, function( errorMsg ) {
                            returnPromise.reject( errorMsg );
                        } );
                    } else {
                        returnPromise.resolve();
                    }
                }
            } else {
                // Add code to handle first time selections via ACE tree
                let newlySelectedCsids = [];
                for( let i = 0; i < selections.length; i++ ) {
                    if( !_.includes( selections[ i ].modelType.typeHierarchyArray, 'Fgf0PartitionElement' ) ) {
                        newlySelectedCsids.push( objectToCSIDGeneratorService.getCloneStableIdChain( selections[ i ] ) );
                    }
                }
                this.determineAndSelectPackedOccs( selections, newlySelectedCsids, selectedPartitions ).then( function() {
                    returnPromise.resolve();
                }, function( errorMsg ) {
                    returnPromise.reject( errorMsg );
                } );
            }
        } else if( selectionType === SelectionTypes.OCC_PARENT_SELECTED ) {
            let occmgmtContext = StructureViewerService.instance.getOccmgmtContextFromViewerContext( this.viewerCtxData.getViewerCtxNamespace() );
            let openedElement = occmgmtContext.openedElement;
            this.viewerCtxData.updateCurrentViewerProductContext( openedElement );
            let openedElementCsid = objectToCSIDGeneratorService.getCloneStableIdChain( openedElement );
            //Note: We are making opened element selected.
            //Selecting in Viewer is not needed as it will show all children also selected.
            this.viewerCtxData.getSelectionManager().selectPartsInViewerUsingModelObject( [ openedElement ] );
            this.viewerCtxData.getSelectionManager().setContext( [ openedElementCsid ] );
            returnPromise.resolve();
        } else if( selectionType === SelectionTypes.ROOT_PRODUCT_SELECTED ||
            selectionType === SelectionTypes.SAVED_BOOKMARK_SELECTED ) {
            if( Array.isArray( selections ) && selections.length > 0 ) {
                this.selectInViewer( selections, [ '' ], selectedPartitions );
            } else {
                this.selectInViewer( [], [], selectedPartitions );
            }
            returnPromise.resolve();
        }
        StructureViewerService.instance.updateViewerSelectionCommandsVisibility( this.viewerCtxData );
        return returnPromise.promise;
    }

    /**
     * Viewer selection changed handler
     *
     * @param  {Array} selectedMOs List of selected model objects
     * @returns {Boolean} boolean indicating if partition node is selected or not
     */
    static getPartitionCSIDs( selectedMOs ) {
        let partitionCsids = [];
        if( Array.isArray( selectedMOs ) && selectedMOs.length > 0 ) {
            for( let i = 0; i < selectedMOs.length; i++ ) {
                if( _.includes( selectedMOs[ i ].modelType.typeHierarchyArray, 'Fgf0PartitionElement' ) ) {
                    //let ptnObj = cdm.getObject( selectedMOs[ i ].props.awb0UnderlyingObject.dbValues[ 0 ] );
                    partitionCsids.push( StructureViewerService.instance.computePartitionChain( selectedMOs[ i ] ) );
                }
            }
        }
        return partitionCsids;
    }

    /**
     * Viewer selection changed handler.
     * Input is an array of Occurance chain objects and bomLine SRUids if server sharing is enabled.
     * There should be three cases possible: 1) SRUids are available, which indicates selection via the 3D model displayed by TcVis,
     * 2) No SRUids are in the array, in which case selection is by the ACE tree and the Occurance chain objects are used.
     * 3) Both arrays are empty or undefined, which indicates selection of nothing, where the action should be to clear any current selections.
     *
     * For case 2), a flag, 'm_selectIsFromVis' is set that can be checked to determin further processing flow.  @see selectionChangeEventHandler above.
     * If the selection was via "Area Select" of the TcVis 3D model, TBD
     *
     * @param { Array } occCSIDChains occurrences containing occurrence SID chains and possibly SRUids
     * @param { Array } bomLineSRUIDs SRUids containings SR UIDs of the selected objects (may be empty)
     */
    viewerSelectionChangedHandler( occCSIDChains, bomLineSRUIDs ) {
        let _isValidArray = function( arry ) { return Array.isArray( arry ) && arry.length > 0; };
        let hasCSIDChains = _isValidArray( occCSIDChains );
        let hasSRUids = _isValidArray( bomLineSRUIDs );

        if( viewerPerformanceService.isPerformanceMonitoringEnabled() ) {
            this.getSelectionManager().setIs3DInitiatedSelection( true );
            viewerPerformanceService.startViewerPerformanceDataCapture();
        }

        if( hasCSIDChains || hasSRUids ) {
            if( hasSRUids ) {
                viewerSRUidSelectionHandler.call( this, bomLineSRUIDs, occCSIDChains );
            } else { // Else, use all valid occurrance chains and call that handler
                viewerOccChainSelectionHandler.call( this, occCSIDChains );
            }
        } else {
            this.getSelectionManager().selectPartsInViewerUsingModelObject( [] );
            this.getSelectionManager().selectPartsInViewerUsingCsid( [] );
            VisOccmgmtCommunicationService.instance.notifySelectionChangesToAce( [], [],
                StructureViewerService.instance.getOccmgmtContextNameKeyFromViewerContext( this.getViewerCtxNamespace() ) );
        }
        let viewerCtxNamespace = this.getViewerCtxNamespace();
        let viewerCtx = viewerCtxSvc.getRegisteredViewerContext( viewerCtxNamespace );

        if( viewerCtx.getValueOnViewerAtomicData( viewerCtxSvc.VIEWER_IS_NAV_MODE_AREA_SELECT ) === true ) {
            viewerCtxSvc.setNavigationMode( viewerCtx, viewerCtx.getValueOnViewerAtomicData( 'viewerPreference.AWC_visNavigationMode' ) );
        }
        StructureViewerService.instance.updateViewerSelectionCommandsVisibility( this );
    }

    /**
     * Register the viewer listener
     */
    registerForSelectionEvents() {
        if( !this.isViewerSelectionListenerAttached ) {
            this.isViewerSelectionListenerAttached = true;
            this.viewerCtxData.getSelectionManager().addViewerSelectionChangedListener( this.viewerSelectionChangedHandler );
        }
    }

    /**
     * Get the selection change handler
     *
     * @returns {Object} the handler
     */
    getSelectionChangeEventHandler() {
        return this.selectionChangeEventHandler;
    }

    /**
     * Get the selection change handler for newly loaded models in ACE
     *
     * @returns {Object} the handler
     */
    getPackUnpackSuccessEventHandler() {
        return this.onPackUnpackOperation;
    }

    /**
     * selects in viewer
     *
     * @param  {Object[]} modelObjects for which packed occs are to be determined
     * @param  {String[]} cSIds already selected CSIds
     * @param  {String[]} partitionCSIds partition csids
     */
    selectInViewer( modelObjects, cSIds, partitionCSIds ) {
        this.viewerCtxData.getSelectionManager().selectPartsInViewerUsingModelObject(
            modelObjects );
        this.viewerCtxData.getSelectionManager().selectPartsInViewerUsingCsidWithPartitions( cSIds, partitionCSIds ).then(
            () => {
                if( viewerPerformanceService.isPerformanceMonitoringEnabled() ) {
                    viewerPerformanceService.stopViewerPerformanceDataCapture( 'ACE tree to Viewer selection : Time taken to select ' + cSIds.length + ' items', 'viewerOrTreeSelection' );
                }
            }
        );
    }

    /**
     * Determine packed occs and updates Viewer selections
     *
     * @param  {Object[]} modelObjects for which packed occs are to be determined
     * @param  {String[]} determinedCSIds already selected CSIds
     * @param  {String[]} partitionCSIds partition csids
     *
     * @returns {Promise} When packed occurrences are determined
     */
    determineAndSelectPackedOccs( modelObjects, determinedCSIds, partitionCSIds ) {
        var returnPromise = AwPromiseService.instance.defer();
        let occmgmtContext = StructureViewerService.instance.getOccmgmtContextFromViewerContext( this.viewerCtxData.getViewerCtxNamespace() );
        var productCtx = occmgmtContext.productContextInfo;
        var packedOccPromise = objectsToPackedOccurrenceCSIDsService.getCloneStableIDsWithPackedOccurrences(
            productCtx, modelObjects );

        if( !_.isUndefined( packedOccPromise ) ) {
            packedOccPromise.then( function( response ) {
                if( response.csids && response.csids.length > 1 ) {
                    csidsToObjSvc.doPerformSearchForProvidedCSIDChains( response.csids ).then( function() {
                        var actualSelectedCsids = response.csids;
                        this.selectInViewer( modelObjects, actualSelectedCsids, partitionCSIds );
                        StructureViewerService.instance.updateViewerSelectionCommandsVisibility( this.viewerCtxData );
                    }.bind( this ) );
                } else {
                    this.selectInViewer( modelObjects, determinedCSIds, partitionCSIds );
                }
                StructureViewerService.instance.updateViewerSelectionCommandsVisibility( this.viewerCtxData );
                returnPromise.resolve();
            }.bind( this ), function( errorMsg ) {
                returnPromise.reject( errorMsg );
            } );
            return returnPromise.promise;
        }

        this.selectInViewer( modelObjects, determinedCSIds, partitionCSIds );
        returnPromise.resolve();
        return returnPromise.promise;
    }

    /**
     * Get the selection type.
     *
     * @param  {Object[]} selected selected model objects
     * @returns {String} selection type string
     */
    getSelectionType( selected ) {
        let occmgmtContext = StructureViewerService.instance.getOccmgmtContextFromViewerContext( this.viewerCtxData.getViewerCtxNamespace() );
        var currentRoot = occmgmtContext.openedElement;
        var actualRoot = occmgmtContext.topElement;
        if( _.isUndefined( selected ) || _.isNull( selected ) || _.isEmpty( selected ) ) {
            return currentRoot === actualRoot ? SelectionTypes.ROOT_PRODUCT_SELECTED :
                SelectionTypes.OCC_PARENT_SELECTED;
        }

        if( selected.length === 1 && currentRoot && selected[ 0 ].uid === actualRoot.uid ) {
            return SelectionTypes.ROOT_PRODUCT_SELECTED;
        }

        var viewModeCtx = appCtxService.getCtx( 'ViewModeContext.ViewModeContext' );
        //Parent selection if it is the parent object and the only object selected
        var isParentSelection = selected.length === 1 && currentRoot && selected[ 0 ].uid === currentRoot.uid && viewModeCtx === 'SummaryView';

        //If not parent selection must be PWA selection
        if( !isParentSelection ) {
            if( currentRoot && actualRoot && StructureViewerSelectionHandler.isSavedWorkingContext( currentRoot ) && currentRoot.uid === actualRoot.uid ) {
                if( selected.length === 1 ) {
                    var parentUidOfSelected = StructureViewerSelectionHandler.getParentUid( selected[ 0 ] );
                    if( parentUidOfSelected && parentUidOfSelected === currentRoot.uid ) {
                        return SelectionTypes.ROOT_PRODUCT_SELECTED;
                    }
                }
                return SelectionTypes.OCC_SELECTED;
            }
            //If parent is SWC selection is root, otherwise simple occ
            return StructureViewerSelectionHandler.isSavedWorkingContext( currentRoot ) ? SelectionTypes.ROOT_PRODUCT_SELECTED :
                SelectionTypes.OCC_SELECTED;
        }

        //otherwise return selection type for parent
        return StructureViewerSelectionHandler.isSavedWorkingContext( currentRoot ) ? SelectionTypes.SAVED_BOOKMARK_SELECTED :
            SelectionTypes.OCC_PARENT_SELECTED;
    }

    /**
     * Find parent model object uid
     *
     * @param {Object} modelObject Model object whoes parent is to be found
     * @returns {String} Uid of parent model object
     */
    static getParentUid( modelObject ) {
        if( modelObject && modelObject.props ) {
            var props = modelObject.props;
            var uid;
            if( props.awb0BreadcrumbAncestor && !_.isEmpty( props.awb0BreadcrumbAncestor.dbValues ) ) {
                uid = props.awb0BreadcrumbAncestor.dbValues[ 0 ];
            } else if( props.awb0Parent && !_.isEmpty( props.awb0Parent.dbValues ) ) {
                uid = props.awb0Parent.dbValues[ 0 ];
            }
            if( cdm.isValidObjectUid( uid ) ) {
                return uid;
            }
        }
        return null;
    }

    /**
     * Utility to check if a model object is a saved working context.
     *
     * @param {Object} modelObject model object to be tested
     * @returns {Boolean} true if it is saved working context
     */
    static isSavedWorkingContext( modelObject ) {
        //If "Awb0SavedBookmark" is in the  types of the model object, it is a SWC
        if( modelObject && modelObject.modelType.typeHierarchyArray.indexOf( 'Awb0SavedBookmark' ) !== -1 ) {
            return true;
        }
        return false;
    }

    /**
     * Clean viewer selection listeners
     */
    cleanUp() {
        if( this.isViewerSelectionListenerAttached ) {
            this.isViewerSelectionListenerAttached = false;
            this.viewerCtxData.getSelectionManager().removeViewerSelectionChangedListener(
                this.viewerSelectionChangedHandler );
        }
    }
}

/**
 * Handle get elements by id SOA response
 * @param { Array } occCSIDChains Array of occurrence SID chains from a selection
 * @param { Object } csidModelData Response from getElementsById SOA
 */
var handleGetElementsByIdSoaResponse = function( occCSIDChains, csidModelData ) {
    let objectsToSelect = [];
    let objectsToHighlight = [];
    _.forEach( csidModelData.elementsInfo, function( elementInfo ) {
        objectsToSelect.push( elementInfo.element );
        objectsToHighlight.push( elementInfo.visibleElement );
    } );
    //Visualization selection manager returns blank string ('') for root selection
    //ACE does not understand this and does nothing in tree
    //We need to add opened element model object to list
    if( Array.isArray( occCSIDChains ) && _.includes( occCSIDChains, '' ) && occCSIDChains.length === 1 ) {
        let occmgmtContext = StructureViewerService.instance.getOccmgmtContextFromViewerContext( this.getViewerCtxNamespace() );
        objectsToSelect.length = 0;
        objectsToSelect = [ occmgmtContext.topElement ];
    }
    this.getSelectionManager().selectPartsInViewerUsingModelObject( objectsToSelect );
    VisOccmgmtCommunicationService.instance.notifySelectionChangesToAce( objectsToSelect, objectsToHighlight,
        StructureViewerService.instance.getOccmgmtContextNameKeyFromViewerContext( this.getViewerCtxNamespace() ) );
};

/**
 *
 * @param { Array } occCSIDChains Array of occurrence SID chains from a selection
 */
var viewerOccChainSelectionHandler = function( occCSIDChains ) {
    csidsToObjSvc.doPerformSearchForProvidedCSIDChains( occCSIDChains, 'true' )
        .then( handleGetElementsByIdSoaResponse.bind( this, occCSIDChains ) )
        .catch( errorMsg => {
            logger.error( 'Failed to get model object data using csid : ' + errorMsg );
        } );
};

/**
 *
 * @param {Array} sruidOccurrences Array of SRUids from a Vis selection
 * @param {Array} occCSIDChains Array of CSID chains from a Vis selection
 */
var viewerSRUidSelectionHandler = function( sruidOccurrences, occCSIDChains ) {
    csidsToObjSvc.doPerformSearchForProvidedSRUIDs( sruidOccurrences, 'true' )
        .then( handleGetElementsByIdSoaResponse.bind( this, occCSIDChains ) )
        .catch( errorMsg => {
            logger.error( 'Failed to get model object data using csid : ' + errorMsg );
        } );
};
