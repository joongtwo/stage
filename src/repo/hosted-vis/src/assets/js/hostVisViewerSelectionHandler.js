// Copyright 2021 Siemens Product Lifecycle Management Software Inc.

/* global define */

/* eslint-disable no-invalid-this */
/* eslint-disable class-methods-use-this */

/**
 * This service is create selection handler for hosted vis
 *
 * @module js/hostVisViewerSelectionHandler
 */

import AwPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import csidsToObjSvc from 'js/csidsToObjectsConverterService';
import objectToCSIDGeneratorService from 'js/objectToCSIDGeneratorService';
import appCtxService from 'js/appCtxService';
import objectsToPackedOccurrenceCSIDsService from 'js/objectsToPackedOccurrenceCSIDsService';
import _ from 'lodash';
import logger from 'js/logger';
import VisOccmgmtCommunicationService from 'js/visOccmgmtCommunicationService';
import hostVisQueryService from 'js/hostVisQueryService';
import StructureViewerService from 'js/structureViewerService';

/**
 * Class to hold the hosted viewer selection data
 */
export default class hostVisViewerSelectionHandler {
    /**
     * hostVisViewerSelectionHandler constructor
     */
    constructor() {
        this.selectionRequestToBeProcessed = null;
        this.isSelectionInProgress = false;
        this.SelectionTypes = {
            ROOT_PRODUCT_SELECTED: 'ROOT_PRODUCT_SELECTED',
            OCC_PARENT_SELECTED: 'OCC_PARENT_SELECTED',
            SAVED_BOOKMARK_SELECTED: 'SAVED_BOOKMARK_SELECTED',
            OCC_SELECTED: 'OCC_SELECTED'
        };
        this.selectionsFromVishost = [];
        this.processingVisSelection = false;
    }

    /**
     * Check if selections are equal
     *
     * @param {Array} modelObjectsArray Array of selected model objects
     *
     * @returns {Boolean} result of input comparison to last selections sent from VisHost
     */
    checkIfModelObjectSelectionsAreEqual( modelObjectsArray ) {
        let bTheyAreEqual = false;
        if( this.selectionsFromVishost.length === modelObjectsArray.length ) {
            if( this.selectionsFromVishost.length > 0 ) {
                bTheyAreEqual = _.xor( modelObjectsArray, this.selectionsFromVishost ).length === 0;
            } else {
                bTheyAreEqual = true;
            }
        }
        return bTheyAreEqual;
    }

    /**
     * Handle selection changes in ACE
     * @param  {Object} eventData event data
     */
    selectionChangeEventHandler( eventData ) {
        if( !this.isSelectionInProgress ) {
            // See if this selection is caused by handling a selection event started from  TcVis.
            if( this.processingVisSelection ) {
                this.processingVisSelection = false;
                return;
            }

            this.processSelectionEvent( eventData.selectionModel );
        } else {
            this.selectionRequestToBeProcessed = eventData.selectionModel;
        }
    }

    /**
     * Handle pack unpack changes in ACE
     * @param  {Object} eventData event data
     */
    onPackUnpackOperation( eventData ) {
        //Get the aceActiveContext to access selectionModel
        let occmgmtContext = this.getAceActiveCtx();
        let aceSelectionModel = occmgmtContext.pwaSelectionModel;
        if( aceSelectionModel ) {
            if( !this.isSelectionInProgress ) {
                this.processSelectionEvent( aceSelectionModel, true );
            } else {
                this.selectionRequestToBeProcessed = aceSelectionModel;
            }
        }
    }

    processSelectionEvent( aceSelectionModel, isPackedUnpackedActionPerformed ) {
        this.isSelectionInProgress = true;
        this.processSelectionEventInternal( aceSelectionModel, isPackedUnpackedActionPerformed ).then( function() {
            if( !_.isNull( this.selectionRequestToBeProcessed ) ) {
                this.processSelectionEvent( this.selectionRequestToBeProcessed );
                this.selectionRequestToBeProcessed = null;
            } else {
                this.isSelectionInProgress = false;
            }
        }.bind( this ) ).catch( function( errorMsg ) {
            this.isSelectionInProgress = false;
            logger.error( 'Failed to process selection event : ' + errorMsg );
        }.bind( this ) );
    }

    processSelectionEventInternal( aceSelectionModel, isPackedUnpackedActionPerformed ) {
        let selectionUids = aceSelectionModel.getSelection();
        let selections = _.compact( cdm.getObjects( selectionUids ) );
        let selectedPartitions = this.getPartitionCSIDs( selections );
        let newlySelectedCsids = [];
        for( let i = 0; i < selections.length; i++ ) {
            if( !_.includes( selections[ i ].modelType.typeHierarchyArray, 'Fgf0PartitionElement' ) ) {
                newlySelectedCsids.push( objectToCSIDGeneratorService.getCloneStableIdChain( selections[ i ] ) );
            }
        }
        return this.determineAndSelectPackedOccs( selections, newlySelectedCsids, selectedPartitions );
    }

    /**
     * Determine packed occs and updates Viewer selections
     *
     * @param  {Object[]} modelObjects for which packed occs are to be determined
     * @param  {String[]} determinedCSIds already selected CSIds
     * @param  {String[]} partitionCSIds partition csids
     * @returns {Promise} When packed occurrences are determined
     */
    determineAndSelectPackedOccs( modelObjects, determinedCSIds, partitionCSIds ) {
        let returnPromise = AwPromiseService.instance.defer();
        let occmgmtContext = this.getAceActiveCtx();
        let productCtx = occmgmtContext.productContextInfo;
        let packedOccPromise = objectsToPackedOccurrenceCSIDsService.getCloneStableIDsWithPackedOccurrences( productCtx, modelObjects );

        if( !_.isUndefined( packedOccPromise ) ) {
            packedOccPromise.then( function( response ) {
                if( response.csids && response.csids.length > 1 ) {
                    csidsToObjSvc.doPerformSearchForProvidedCSIDChains( response.csids ).then( function() {
                        let actualSelectedCsids = response.csids;
                        // Send the selection set to hosted vis. This is represented actualSelectedCsids
                        hostVisQueryService.sendSelectionsToVis( actualSelectedCsids, partitionCSIds );
                    } );
                } else {
                    // Send the selection set to hosted vis. This is represented determinedCSIds
                    hostVisQueryService.sendSelectionsToVis( determinedCSIds, partitionCSIds );
                }
                returnPromise.resolve();
            }, function( errorMsg ) {
                returnPromise.reject( errorMsg );
            } );

            return returnPromise.promise;
        }

        // Send the selection set to hosted vis. This is represented determinedCSIds
        hostVisQueryService.sendSelectionsToVis( determinedCSIds, partitionCSIds );
        returnPromise.resolve();
        return returnPromise.promise;
    }

    /**
     * Viewer selection changed handler
     *
     * @param  {Array} occCSIDChains Array of strings representing CS occurrence  chains
     */
    viewerSelectionChangedHandler( occCSIDChains ) {
        if( occCSIDChains && occCSIDChains.length !== 0 ) {
            let objectsToSelect = [];
            let objectsToHighlight = [];
            //Visualization selection manager returns blank string ('') for root selection
            //ACE does not understand this and does nothing in tree
            //We need to add opened element model object to list
            if( occCSIDChains.length === 1 && _.includes( occCSIDChains, '' ) ) {
                let occmgmtContext = this.getAceActiveCtx();
                objectsToSelect = [ occmgmtContext.topElement ];
                this.selectionsFromVishost = objectsToSelect;
                this.processingVisSelection = true;
                VisOccmgmtCommunicationService.instance.notifySelectionChangesToAce( objectsToSelect, objectsToHighlight, appCtxService.getCtx( 'aceActiveContext' ).key );
            } else {
                csidsToObjSvc.doPerformSearchForProvidedCSIDChains( occCSIDChains, 'true' ).then( function( csidModelData ) {
                    _.forEach( csidModelData.elementsInfo, function( elementInfo ) {
                        objectsToSelect.push( elementInfo.element );
                        objectsToHighlight.push( elementInfo.visibleElement );
                    } );
                    this.selectionsFromVishost = objectsToSelect;
                    this.processingVisSelection = true;
                    VisOccmgmtCommunicationService.instance.notifySelectionChangesToAce( objectsToSelect, objectsToHighlight, appCtxService.getCtx( 'aceActiveContext' ).key );
                }.bind( this ) ).catch( function( errorMsg ) {
                    logger.error( 'Failed to get model object data using csid : ' + errorMsg );
                } );
            }
        } else {
            this.processingVisSelection = true;
            VisOccmgmtCommunicationService.instance.notifySelectionChangesToAce( [], [], appCtxService.getCtx( 'aceActiveContext' ).key );
        }
    }

    /**
     * Get the selection type.
     *
     * @param  {Object[]} selected selected model objects
     * @returns {String} selection type string
     */
    getSelectionType( selected ) {
        let occmgmtContext = this.getAceActiveCtx();
        let currentRoot = occmgmtContext.openedElement;
        let actualRoot = occmgmtContext.topElement;
        if( _.isUndefined( selected ) || _.isNull( selected ) || _.isEmpty( selected ) ) {
            return currentRoot === actualRoot ? this.SelectionTypes.ROOT_PRODUCT_SELECTED : this.SelectionTypes.OCC_PARENT_SELECTED;
        }

        if( selected.length === 1 && currentRoot && selected[ 0 ].uid === actualRoot.uid ) {
            return this.SelectionTypes.ROOT_PRODUCT_SELECTED;
        }

        let viewModeCtx = appCtxService.getCtx( 'ViewModeContext.ViewModeContext' );
        //Parent selection if it is the parent object and the only object selected
        let isParentSelection = selected.length === 1 && currentRoot && selected[ 0 ].uid === currentRoot.uid && viewModeCtx === 'SummaryView';

        //If not parent selection must be PWA selection
        if( !isParentSelection ) {
            if( currentRoot && actualRoot && this.isSavedWorkingContext( currentRoot ) && currentRoot.uid === actualRoot.uid ) {
                if( selected.length === 1 ) {
                    let parentUidOfSelected = this.getParentUid( selected[ 0 ] );
                    if( parentUidOfSelected && parentUidOfSelected === currentRoot.uid ) {
                        return this.SelectionTypes.ROOT_PRODUCT_SELECTED;
                    }
                }
                return this.SelectionTypes.OCC_SELECTED;
            }
            //If parent is SWC selection is root, otherwise simple occ
            return this.isSavedWorkingContext( currentRoot ) ? this.SelectionTypes.ROOT_PRODUCT_SELECTED : this.SelectionTypes.OCC_SELECTED;
        }

        //otherwise return selection type for parent
        return this.isSavedWorkingContext( currentRoot ) ? this.SelectionTypes.SAVED_BOOKMARK_SELECTED : this.SelectionTypes.OCC_PARENT_SELECTED;
    }

    /**
     * Utility to check if a model object is a saved working context.
     *
     * @param {Object} modelObject model object to be tested
     * @returns {Boolean} true if it is saved working context
     */
    isSavedWorkingContext( modelObject ) {
        //If "Awb0SavedBookmark" is in the  types of the model object, it is a SWC
        if( modelObject && modelObject.modelType.typeHierarchyArray.indexOf( 'Awb0SavedBookmark' ) !== -1 ) {
            return true;
        }
        return false;
    }

    /**
     * Find parent model object uid
     *
     * @param {Object} modelObject Model object whoes parent is to be found
     * @returns {String} Uid of parent model object
     */
    getParentUid( modelObject ) {
        if( modelObject && modelObject.props ) {
            let props = modelObject.props;
            let uid;
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
     * Get viewer ACE active context
     */
    getAceActiveCtx() {
        return appCtxService.getCtx( this.getOccMgmtContextKey() );
    }

    /**
     *
     * @returns {String} occ mgmt context key
     */
    getOccMgmtContextKey() {
        return appCtxService.ctx.aceActiveContext ? appCtxService.ctx.aceActiveContext.key : 'occmgmtContext';
    }

    /**
     * @param  {Array} selectedMOs List of selected model objects
     * @returns {Boolean} boolean indicating if partition node is selected or not
     */
    getPartitionCSIDs( selectedMOs ) {
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
}
