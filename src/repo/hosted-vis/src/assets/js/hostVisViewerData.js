// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */

/* eslint-disable no-invalid-this */
/* eslint-disable class-methods-use-this */

/**
 * This module holds hosted viewer 3D data
 *
 * @module js/hostVisViewerData
 */
import _ from 'lodash';
import logger from 'js/logger';
import appCtxSvc from 'js/appCtxService';
import HostVisViewerSelectionHandler from 'js/hostVisViewerSelectionHandler';
import HostVisViewerVisibilityHandler from 'js/hostVisViewerVisibilityHandler';
import StructureViewerService from 'js/structureViewerService';
import objectToCSIDGeneratorService from 'js/objectToCSIDGeneratorService';
import VisOccmgmtCommunicationService from 'js/visOccmgmtCommunicationService';
import hostVisQueryService from 'js/hostVisQueryService';
import viewerPreferenceService from 'js/viewerPreference.service';
import eventBus from 'js/eventBus';
import viewerContextService from 'js/viewerContext.service';

export default class HostVisViewerData {
    /**
     * HostVisViewerData constructor
     */
    constructor() {
        this.hostVisViewerSelectionHandler = null;
        this.ROOT_ID = '';
        this.hostVisViewerSelectionListener = null;
        this.hostVisViewerVisibilityHandler = null;
        this.viewerType = 'hostVisViewerData';
        this.structureConfiguration = null;
        this.viewerContext = null;
        this.activePartitionSchemeUid = '';
        this.locationChanged = false;
    }

    /**
     * Initialize hosted viewer data.
     */
    initializeHostVisViewer() {
        VisOccmgmtCommunicationService.instance.subscribe( this );
        this.setupHostVisViewerSelectionHandler();
        this.setupHostVisViewerSelectionListener();
        this.setupHostVisViewerVisibilityHandler();
        this.setParametersAfterPCILoad();
        this.setPartitionScheme();
    }

    /**
     * setup tcVis viewer selection listener
     */
    setupHostVisViewerSelectionListener() {
        this.hostVisViewerSelectionListener = function( occCSIDChains ) {
            for( let i = 0; i < occCSIDChains.length; i++ ) {
                if( occCSIDChains[ i ].charAt( occCSIDChains[ 0 ].length - 1 ) === '/' ) {
                    occCSIDChains[ i ] = occCSIDChains[ i ].slice( 0, -1 );
                }
            }
            this.hostVisViewerSelectionHandler.viewerSelectionChangedHandler( occCSIDChains );
        }.bind( this );
        hostVisQueryService.addSelectionEventListener( this.hostVisViewerSelectionListener );
    }

    setParametersAfterPCILoad() {
        this.structureConfiguration = this.getStructureConfiguration();
        let aceContext = appCtxSvc.getCtx( this.getOccMgmtContextKey() );
        this.viewerContext = StructureViewerService.instance.getPCIModelObject( aceContext );
        this.setPartitionScheme();
    }

    /**
     * Handle Product Context Changed Event
     * @param {Object} eventData event data
     */
    handleProductContextChangedEvent( eventData ) {
        if( this.locationChanged ) {
            this.locationChanged = false;
            hostVisQueryService.sendReloadToHost();
            setTimeout( () => {
                this.setupHostVisViewerSelectionHandler();
                this.setupHostVisViewerSelectionListener();
                this.setupHostVisViewerVisibilityHandler();
                this.setParametersAfterPCILoad();
            }, 2000 );
            return;
        }
        if( this.viewerContext === null ) {
            this.setParametersAfterPCILoad();
            return;
        }
        if( eventData.dataProviderActionType === 'activateWindow' || this.getOccMgmtContextKey() !== eventData.updatedView ) {
            return;
        }
        let isReload3DView = false;
        let resetPerformedOnPCI = StructureViewerService.instance.checkIfResetWasPerformedOnPci( this.getOccMgmtContextKey() );
        let aceContext = appCtxSvc.getCtx( eventData.updatedView );

        let newProductCtx = StructureViewerService.instance.getPCIModelObject( aceContext );
        if( !( !_.isUndefined( eventData.transientRequestPref ) && !_.isUndefined( eventData.transientRequestPref.reloadDependentTabs ) &&
                eventData.transientRequestPref.reloadDependentTabs === 'false' ) ) {
            if( newProductCtx && this.viewerContext && this.viewerContext.uid !== newProductCtx.uid && !resetPerformedOnPCI ) {
                isReload3DView = true;
            }
        }
        if( !resetPerformedOnPCI && aceContext && aceContext.requestPref && aceContext.requestPref.recipeReset === 'true' ) {
            isReload3DView = true;
        }
        if( resetPerformedOnPCI && aceContext && aceContext.sublocationAttributes && aceContext.sublocationAttributes.awb0ActiveSublocation &&
            ( aceContext.sublocationAttributes.awb0ActiveSublocation[ 0 ] === '3D' || aceContext.sublocationAttributes.awb0ActiveSublocation[ 0 ] === 'Awb0ViewerFeature' ) ) {
            isReload3DView = true;
        }
        let splitViewMode = false;
        if( appCtxSvc.getCtx( 'splitView' ) ) {
            splitViewMode = appCtxSvc.getCtx( 'splitView' ).mode;
        }

        if( StructureViewerService.instance.isViewerOpenedForFnd0Workset( this.getOccMgmtContextKey() ) && eventData.dataProviderActionType === 'productChangedOnSelectionChange' ) {
            isReload3DView = false;
        }
        if( this.shouldUpdateShowSuppressed() ) {
            // In the future, we want to notify3DViewerShowSuppressed, but due to
            // an issue with BOM that breaks reconfigure,
            // we will just ensured the viewer is reloaded when suppressed is toggled.
            isReload3DView = true;
        }
        this.setPartitionScheme();
        if( isReload3DView || splitViewMode && resetPerformedOnPCI ) {
            this.sendReloadToHost();
        }
    }

    /**
     *
     * @returns {Object} structure configuration
     * Gets user configurations properties from the aceActiveContext related to the structure.
     * Currently only accounts for Show Suppressed, but can be easily modified to account for
     * Show Excluded by Variant and Show Excluded by Effectivity.
     */
    getStructureConfiguration() {
        let aceActiveCtx = appCtxSvc.getCtx( this.occmgmtContextNameKey );
        if( aceActiveCtx ) {
            return { showSuppressedOcc: aceActiveCtx.showSuppressedOcc };
        }
        return null;
    }

    /**
     * @returns {Boolean} if the preference is changed or not
     * Checks to see if the user preference showSuppressedOcc has been changed.
     * Also updates the structureConfiguration value.
     */
    shouldUpdateShowSuppressed() {
        let retval = false;
        let newStructureConfiguration = this.getStructureConfiguration();

        if( this.structureConfiguration && newStructureConfiguration ) {
            retval = this.structureConfiguration.showSuppressedOcc !== newStructureConfiguration.showSuppressedOcc;
            this.structureConfiguration = newStructureConfiguration;
        }
        return retval;
    }

    /**
     * This method sends the partition scheme to host if it has changed.
     * If partition scheme is same as it was previously, it is not sent to the host.
     */
    setPartitionScheme() {
        if( appCtxSvc.ctx.aceActiveContext && appCtxSvc.ctx.aceActiveContext.key && this.getOccMgmtContextKey() ) {
            let occContext = appCtxSvc.getCtx( this.getOccMgmtContextKey() );
            let pciObj = StructureViewerService.instance.getViewerPCIToBeLoaded( occContext );
            let rootElementCsidChain = objectToCSIDGeneratorService.getCloneStableIdChain( occContext.rootElement ? occContext.rootElement : occContext.topElement );
            rootElementCsidChain = rootElementCsidChain === '/' ? '' : rootElementCsidChain;
            this.structureConfiguration = this.getStructureConfiguration();
            this.viewerContext = StructureViewerService.instance.getPCIModelObject( occContext );
            if( pciObj && pciObj.props && pciObj.props.fgf0PartitionScheme && Array.isArray( pciObj.props.fgf0PartitionScheme.dbValues ) && pciObj.props.fgf0PartitionScheme.dbValues.length > 0 ) {
                let activePartitionSchemeUid = pciObj.props.fgf0PartitionScheme.dbValues[ 0 ];
                if( !_.isNull( activePartitionSchemeUid ) && !_.isUndefined( activePartitionSchemeUid ) && !_.isEmpty( activePartitionSchemeUid ) ) {
                    if( activePartitionSchemeUid !== this.activePartitionSchemeUid ) {
                        this.activePartitionSchemeUid = activePartitionSchemeUid;
                        this.setActivePartitionSchemeInHost( rootElementCsidChain, activePartitionSchemeUid );
                    }
                } else {
                    if( activePartitionSchemeUid !== this.activePartitionSchemeUid && this.activePartitionSchemeUid !== '' ) {
                        this.activePartitionSchemeUid = '';
                        this.setActivePartitionSchemeInHost( rootElementCsidChain, '' );
                    }
                }
            } else {
                if( pciObj && pciObj.props && pciObj.props.fgf0PartitionScheme && this.activePartitionSchemeUid !== '' ) {
                    this.activePartitionSchemeUid = '';
                    this.setActivePartitionSchemeInHost( rootElementCsidChain, '' );
                }
            }
        }
    }

    /**
     * This prepares the query values to send to host for a partition scheme change
     * @param {String} referenceLineCsid reference csid
     * @param {String} partitionSchemeCsid partition csid
     */
    setActivePartitionSchemeInHost( referenceLineCsid, partitionSchemeCsid ) {
        let refLineOcc = viewerContextService.createViewerOccurance( referenceLineCsid );
        let partitionSchemeOcc = viewerContextService.createViewerPartitionSchemeOccurance( partitionSchemeCsid );
        hostVisQueryService.sendPartitionSchemeToHost( refLineOcc, partitionSchemeOcc );
    }

    /**
     * Handle selection changed event
     * @param {Object} eventData selection data
     */
    handleSelectionChangedEvent( eventData ) {
        if( this.hostVisViewerSelectionHandler ) {
            this.hostVisViewerSelectionHandler.selectionChangeEventHandler( eventData );
        }
    }

    cleanUpViewerHandler() {
        this.ctrlCleanup();
    }

    initializeHostVisViewerDataHandler() {
        this.locationChanged = true;
    }

    /**
     * Handle pack unpack event
     * @param {Object} eventData pack unpack data
     */
    handlePackUnpackEvent( eventData ) {
        this.hostVisViewerSelectionHandler.onPackUnpackOperation( eventData );
    }

    /**
     * Event handler for following events:
     * ace.elementsRemoved
     * replaceElement.elementReplacedSuccessfully
     * cba.alignmentUpdated
     * addElement.elementsAdded
     * @param {object} eventData event data
     */
    handleReloadEvents( eventData ) {
        if( eventData && eventData.viewToReact && eventData.viewToReact === this.getOccMgmtContextKey() ) {
            this.sendReloadToHost();
        }
    }

    /**
     * handle occurence update by effectivity event
     * @param {Object} eventData event data
     */
    handleOccurrenceUpdatedByEffectivityEvent( eventData ) {
        if( eventData && eventData.viewToReact && eventData.viewToReact === appCtxSvc.getCtx( 'ctx.aceActiveContext.key' ) ) {
            this.sendReloadToHost();
        }
    }

    /**
     * handle cdm update event
     * @param {Object} eventData event data
     */
    handleCdmUpdatedEvent( eventData ) {
        if( eventData && !_.isEmpty( eventData.modifiedObjects ) ) {
            for( let i = 0; i < eventData.modifiedObjects.length; i++ ) {
                let modifiedObj = eventData.modifiedObjects[ i ];
                if( modifiedObj.type === 'DirectModel' ) {
                    this.sendReloadToHost();
                    break;
                }
            }
        }
    }

    /**
     * handle cdm related modified event
     * @param {Object} eventData event data
     */
    handleCdmRelatedModifiedEvent( eventData ) {
        if( eventData && !_.isEmpty( eventData.childObjects ) ) {
            for( let i = 0; i < eventData.childObjects.length; i++ ) {
                let childObj = eventData.childObjects[ i ];
                if( childObj.type === 'DirectModel' ) {
                    this.sendReloadToHost();
                    break;
                }
            }
        }
    }

    /**
     * handle change of use indexed model settings event
     */
    handleUseIndexedModelSettingsChangedEvent() {
        this.sendReloadToHost();
    }

    /**
     * Setup host vis viewer selection handler
     */
    setupHostVisViewerSelectionHandler() {
        if( this.hostVisViewerSelectionHandler === null ) {
            this.hostVisViewerSelectionHandler = new HostVisViewerSelectionHandler();
        }
        let aceContext = this.getAceActiveCtx();
        if( aceContext ) {
            let selections = aceContext.selectedModelObjects;
            if( !_.isNull( selections ) && !_.isUndefined( selections ) && !_.isEmpty( selections ) ) {
                let selectionType = this.hostVisViewerSelectionHandler.getSelectionType( selections );
                if( selectionType === 'OCC_SELECTED' ) {
                    StructureViewerService.instance.ensureMandatoryPropertiesForCsidLoaded( selections ).then(
                        function() {
                            let newlySelectedCsids = [];
                            for( let i = 0; i < selections.length; i++ ) {
                                let csid = objectToCSIDGeneratorService.getCloneStableIdChain( selections[ i ] );
                                newlySelectedCsids.push( csid );
                            }
                            this.hostVisViewerSelectionHandler.determineAndSelectPackedOccs( selections, newlySelectedCsids );
                        }.bind( this )
                    ).catch( function( error ) {
                        logger.error( 'HostVisViewerData : Failed to load mandatory properties to compute CSID : ' + error );
                    } );
                }
            } else {
                let openedElement = appCtxSvc.getCtx( this.getOccMgmtContextKey() ).openedElement;
                let topElement = appCtxSvc.getCtx( this.getOccMgmtContextKey() ).topElement;
                if( openedElement && topElement && openedElement.uid !== topElement.uid ) {
                    let openedElementCsid = objectToCSIDGeneratorService.getCloneStableIdChain( openedElement );
                    // Send selection set to hosted vis, which is represented by openedElementCsid.
                    hostVisQueryService.sendSelectionsToVis( openedElementCsid );
                } else {
                    // Send empty selection set to hosted vis, which is represented by empty array.
                    // This will be interpreted as an unselect all operation by TcVis.
                    let newlySelectedCsids = [];
                    hostVisQueryService.sendSelectionsToVis( newlySelectedCsids );
                }
            }
        }
    }

    /**
     * Handle Primary work area contents reloaded event
     */
    handlePrimaryWorkAreaContentsReloadedEvent() {
        hostVisQueryService.reconfigureViewerToHost();
    }

    /**
     * Setup 3D viewer visibility handler
     */
    setupHostVisViewerVisibilityHandler() {
        if( this.hostVisViewerVisibilityHandler === null ) {
            this.hostVisViewerVisibilityHandler = new HostVisViewerVisibilityHandler();
            this.hostVisViewerVisibilityHandler.initialize();
        }else{
            this.hostVisViewerVisibilityHandler.reRegisterVisibilityEventsToAce();
        }
        let visibilityStateToBeApplied = VisOccmgmtCommunicationService.instance.getVisibilityStateFromExistingObserver();
        if( visibilityStateToBeApplied ) {
            //need to create function like restoreVisibility
            this.hostVisViewerVisibilityHandler.restoreViewerVisibility( visibilityStateToBeApplied );
        }
    }

    /**
     * handle get occurence visibilty event
     * @param {Object} vmo view model object
     * @returns {Boolean} occurence visible or not
     */
    handleGetOccVisibilty( vmo ) {
        return this.hostVisViewerVisibilityHandler.internalGetOccVisibility( vmo );
    }

    /**
     * Send Reload to host
     */
    sendReloadToHost() {
        hostVisQueryService.sendReloadToHost();
        setTimeout( () => {
            this.setParametersAfterPCILoad();
            this.setupHostVisViewerSelectionHandler();
            this.setupHostVisViewerSelectionListener();
            this.setupHostVisViewerVisibilityHandler();
        }, 5000 );
    }

    /**
     * handle toggle occurence visibilty event
     * @param {Object} eventData event Data from toggle occurence visibility
     */
    handleToggleOccVisibility( eventData ) {
        this.hostVisViewerVisibilityHandler.internalToggleOccVisibility( eventData );
    }

    /**
     * sets visibility data from other active viewer
     * @param {Object} visibilityData visibility data from other active viewer
     */
    handleVisibilityChanges( visibilityData ) {
        this.hostVisViewerVisibilityHandler.internalHandleVisibilityChanges( visibilityData );
    }

    /**
     * Clean up the current
     * @param {Boolean} isReloadViewer - boolean indicating if viewer is reloading while clean up.
     */
    ctrlCleanup() {
        if( this.hostVisViewerSelectionHandler ) {
            this.hostVisViewerSelectionHandler = null;
        }
        if( this.hostVisViewerSelectionListener ) {
            hostVisQueryService.removeSelectionEventListner( this.hostVisViewerSelectionListener );
            this.hostVisViewerSelectionListener = null;
        }
        if( this.hostVisViewerVisibilityHandler ) {
            this.hostVisViewerVisibilityHandler.cleanUp();
            this.hostVisViewerVisibilityHandler = null;
        }
        this.activePartitionSchemeUid = null;
    }

    /**
     * Get viewer ACE active context
     * @returns {Object} Returns ace active context
     */
    getAceActiveCtx() {
        return appCtxSvc.getCtx( this.getOccMgmtContextKey() );
    }

    /**
     *
     * @returns {String} occ mgmt context key
     */
    getOccMgmtContextKey() {
        return appCtxSvc.ctx.aceActiveContext ? appCtxSvc.ctx.aceActiveContext.key : 'occmgmtContext';
    }

    /**
     * Returns type of viewer
     * @returns {string} type of viewer
     */
    getViewerType() {
        return this.viewerType;
    }

    /**
     * Returns visibility state
     * @returns {Object} visibility state of viewer
     */
    getVisibilityState() {
        return this.hostVisViewerVisibilityHandler.getVisibilityState();
    }
}
