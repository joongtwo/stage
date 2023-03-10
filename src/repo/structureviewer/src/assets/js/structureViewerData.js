/* eslint-disable complexity */
// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */

/**
 * This module holds structure viewer 3D data
 *
 * @module js/structureViewerData
 */
import _ from 'lodash';
import eventBus from 'js/eventBus';
import imgViewerExport from 'js/ImgViewer';
import logger from 'js/logger';
import awPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import StructureViewerSelectionHandler from 'js/structureViewerSelectionHandlerProvider';
import strViewerVisibilityHandlerPvd from 'js/structureViewerVisibilityHandlerProvider';
import StructureViewerService from 'js/structureViewerService';
import objectToCSIDGeneratorService from 'js/objectToCSIDGeneratorService';
import AwWindowService from 'js/awWindowService';
import AwTimeoutService from 'js/awTimeoutService';
import visLaunchInfoProvider from 'js/openInVisualizationProductContextInfoProvider';
import productLaunchInfoProviderService from 'js/productLaunchInfoProviderService';
import viewerPreferenceService from 'js/viewerPreference.service';
import { TracelinkSelectionHandler, TracelinkSelection } from 'js/tracelinkSelectionHandler';
import viewerCtxSvc from 'js/viewerContext.service';
import VisOccmgmtCommunicationService from 'js/visOccmgmtCommunicationService';
import viewerPerformanceService from 'js/viewerPerformance.service';
import cdm from 'soa/kernel/clientDataModel';
import occmgmtUtils from 'js/occmgmtUtils';
import localeService from 'js/localeService';
import msgSvc from 'js/messagingService';

export default class StructureViewerData {
    /**
     * StructureViewerData constructor
     * @param {Object} viewerContainerElement - The DOM element to contain the viewer canvas
     * @param {Object} occmgmtContextNameKey occmgmt context name key
     */
    constructor( viewerContainerElement, occmgmtContextNameKey ) {
        if( _.isNull( viewerContainerElement ) || _.isUndefined( viewerContainerElement ) ) {
            logger.error( 'Viewer container element can not be null' );
            throw 'Viewer container element can not be null';
        }
        if( _.isNull( occmgmtContextNameKey ) || _.isUndefined( occmgmtContextNameKey ) || _.isEmpty( occmgmtContextNameKey ) ) {
            logger.error( 'Occmgmt context key name can not be null' );
            throw 'Occmgmt context key name can not be null';
        }
        this.viewerContainerElement = viewerContainerElement;
        this.occmgmtContextNameKey = occmgmtContextNameKey;
        this.viewerImageCaptureContainer = null;
        this.viewerCtxData = null;
        this.viewerContext = null;
        this.structureViewerSelectionHandler = null;
        this.structureViewerVisibilityHandler = null;
        this.colorGroupingProperty = null;
        this.colorCriteria = [];
        this.ROOT_ID = '';
        this.structureConfiguration = null;
        this.viewerType = '';
        this.activePartitionSchemeUid = null;

        //Events subscriptions
        this.resizeTimeoutPromise = null;
        this.awGroupObjCategoryChangeEventListener = null;
        this.colorTogglingEventListener = null;
        this.mvProxySelectionChangedEventListener = null;
        this.aceTreeGridSelectionEvent = null;
        this.restoreActionListener = null;
        this.multiSelectIn3DListener = null;
        this.viewerPanelsToClose = [ 'Awv0CaptureGallery', 'Awv0ViewerSettings', 'Awv0PmiTool', 'Awv0GeometricAnalysisProximity',
            'Awv0GeometricAnalysisVolume', 'Awv0GeometricAnalysisSection'
        ];
    }

    /**
     * Initialize 3D viewer.
     * @param {Object} subPanelContext Sub panel context
     * @param {Object} viewerAtomicData viewer Atomic data
     * @param {boolean} force3DViewerReload boolean indicating if 3D should be reloaded forcefully
     * @param {boolean} reloadSession boolean indicating if 3D session should be reloaded forcefully
     *
     * @returns {Object} instance of this
     */
    initialize3DViewer( subPanelContext, viewerAtomicData, force3DViewerReload, reloadSession ) {
        this.viewerAtomicData = viewerAtomicData;
        this.setViewerLoadingStatus( true );
        if( !force3DViewerReload ) {
            this.setIndexedPreference( subPanelContext.occContext );
        }
        this.viewerContext = StructureViewerService.instance.getPCIModelObject( subPanelContext.occContext );
        return TracelinkSelectionHandler.instance.arePrefsFilled().then( () => {
            let isShowAll = true;
            let isRootLogical = TracelinkSelectionHandler.instance.isRootSelectionTracelinkType();
            if( isRootLogical ) {
                isShowAll = false;
            } else if( subPanelContext.hasOwnProperty( 'showGraphics' ) ) {
                isShowAll = subPanelContext.showGraphics;
            }
            if( force3DViewerReload ||
                !StructureViewerService.instance.isAppSessionBeingOpened( this.viewerContext ) &&
                !StructureViewerService.instance.isSameProductOpenedAsPrevious( this.viewerContext, this.occmgmtContextNameKey ) ) {
                return StructureViewerService.instance.cleanUpPreviousView( this.occmgmtContextNameKey ).then( () => {
                    return viewerPreferenceService.getSelectionLimit( this.viewerCtxData ).then( ( selectionLimit ) => {
                        StructureViewerService.instance.removePciFromAceResetState( this.occmgmtContextNameKey );
                        return StructureViewerService.instance.getViewerLoadInputParameter( this.viewerContext,
                            this.compute3DViewerWidth(), this.compute3DViewerHeight(), isShowAll, null, subPanelContext.occContext, reloadSession, selectionLimit );
                    } );
                } ).then( ( viewerLoadInputParams ) => {
                    if( subPanelContext.viewerSecurityMarkerHandlerFnKey ) {
                        viewerLoadInputParams.setSecurityMarkingHandlerKey( subPanelContext.viewerSecurityMarkerHandlerFnKey );
                    }
                    viewerLoadInputParams.setViewerAtomicData( viewerAtomicData );
                    viewerLoadInputParams.initializeViewerContext();
                    this.viewerCtxData = viewerLoadInputParams.getViewerContext();
                    this.registerForConnectionProblems();
                    return StructureViewerService.instance.getViewerView( viewerLoadInputParams, this.occmgmtContextNameKey );
                } ).then( ( viewerData ) => {
                    if( StructureViewerService.instance.hasAlternatePCI( StructureViewerService.instance.getViewerPCIToBeLoaded( subPanelContext.occContext ) ) ) {
                        viewerData[ 0 ].setHasAlternatePCI( true );
                    } else {
                        viewerData[ 0 ].setHasAlternatePCI( false );
                    }
                    return viewerData;
                } );
            }

            return StructureViewerService.instance.restorePreviousView( this.occmgmtContextNameKey, viewerAtomicData ).then( ( viewerData ) => {
                this.viewerCtxData = viewerData[ 0 ];
                this.registerForConnectionProblems();
                let splitViewCtx = appCtxSvc.getCtx( 'splitView' );
                if( splitViewCtx && splitViewCtx.mode ) {
                    //disable bookmark for split view via EMM
                    viewerData[ 0 ].getSessionMgr().disableBookmark( true );
                    viewerData[ 0 ].setMemoryThreshold( viewerData[ 0 ].MEMORY_THRESHOLD_FOR_ACE_VIEWER / 2 );
                }
                AwTimeoutService.instance( function() {
                    this.updateViewerAtomicData( 'showViewerEmmProgress', false );
                }.bind( this ), 500 );
                return viewerData;
            } );
        } ).then( ( viewerData ) => {
            this.viewerContainerElement.append( viewerData[ 1 ] );
            this.viewerCtxData = viewerData[ 0 ];
            this.viewerCtxData.getSelectionManager().setSelectionEnabled( true );
            this.viewerType = this.viewerCtxData.getViewerCtxNamespace();
            StructureViewerService.instance.setOccmgmtContextNameKeyOnViewerContext( this.viewerCtxData.getViewerCtxNamespace(), this.occmgmtContextNameKey );
            this.viewerCtxData.updateCurrentViewerProductContext( subPanelContext.occContext.topElement );
            this.structureConfiguration = this.getStructureConfiguration();
            this.setPartitionScheme( subPanelContext.occContext );
            let cachedPWAContentsReloadedEventData = VisOccmgmtCommunicationService.instance.getCachedPWAContentsReloadedEventData();
            if(cachedPWAContentsReloadedEventData !== null){
                this.handlePrimaryWorkAreaContentsReloadedEvent(cachedPWAContentsReloadedEventData);
            }
            VisOccmgmtCommunicationService.instance.subscribe( this );
            this.setup3DViewerVisibilityHandler();
            this.setup3DViewerSelectionHandler( subPanelContext.occContext.selectedModelObjects );
            this.registerForResizeEvents();
            this.registerViewerForParentResize();
            this.registerForOther3ViewerEvents( subPanelContext );
            this.registerAsViewerLaunchInfoProvider();
            this.setHostElement();
            if( !this.viewerCtxData.isMMVRendering() ) {
                this.viewerCtxData.getThreeDViewManager().setBasicDisplayMode( viewerPreferenceService.getShadedWithEdgesPreference( this.viewerCtxData ) ? 1 : 0 );
            }
            this.updateViewerAtomicData( viewerCtxSvc.VIEWER_IS_MMV_ENABLED_TOKEN, this.viewerCtxData.isMMVRendering() );
            StructureViewerService.instance.deregisterFilterReloadEvent();
            StructureViewerService.instance.setHasDisclosureData( this.viewerCtxData.getViewerCtxNamespace(), subPanelContext.occContext.currentState.uid );
            AwTimeoutService.instance( function() {
                this.set3DViewerSize();
            }.bind( this ) );
            if( this.launchSnapshotGalleyPanel ) {
                viewerCtxSvc.activateViewerCommandPanel( 'Awv0CaptureGallery', 'aw_toolsAndInfo', {
                    viewerContextData: this.viewerCtxData,
                    viewerAtomicData: this.viewerAtomicData,
                    occmgmtContext: subPanelContext.occContext
                }, false );
                this.launchSnapshotGalleyPanel = false;
            }
            this.setViewerLoadingStatus( false );
            if( viewerPerformanceService.isPerformanceMonitoringEnabled() ) {
                viewerPerformanceService.setViewerPerformanceMode( false );
            }
            this.setupAtomicDataTopics();
            return this;
        } ).catch( ( error ) => {
            logger.error( 'Failed to load viewer : ' + error );
            this.setViewerLoadingStatus( false );
            return error;
        } );
    }

    /**
     * Register for viewer atomic data topics
     */
    setupAtomicDataTopics() {
        this.viewerCtxData.getViewerAtomicDataSubject().subscribe( viewerCtxSvc.VIEWER_UPDATE_VIEW_WITH_CAPTURED_IMAGE, this );
        this.viewerCtxData.getViewerAtomicDataSubject().subscribe( viewerCtxSvc.VIEWER_DEACTIVATE_IMAGE_CAPTURE_DISPLAY, this );
        this.viewerCtxData.getViewerAtomicDataSubject().subscribe( viewerCtxSvc.VIEWER_SUB_PRODUCT_LAUNCH_EVENT, this );
        this.viewerCtxData.getViewerAtomicDataSubject().subscribe( viewerCtxSvc.VIEWER_SUB_SAVE_VIS_AUTO_BOOKMARK, this );
    }

    /**
     * deregister for atomic data topics
     */
    unregisterAtomicDataTopics() {
        this.viewerCtxData.getViewerAtomicDataSubject().unsubscribe( viewerCtxSvc.VIEWER_UPDATE_VIEW_WITH_CAPTURED_IMAGE, this );
        this.viewerCtxData.getViewerAtomicDataSubject().unsubscribe( viewerCtxSvc.VIEWER_DEACTIVATE_IMAGE_CAPTURE_DISPLAY, this );
        this.viewerCtxData.getViewerAtomicDataSubject().unsubscribe( viewerCtxSvc.VIEWER_SUB_PRODUCT_LAUNCH_EVENT, this );
        this.viewerCtxData.getViewerAtomicDataSubject().unsubscribe( viewerCtxSvc.VIEWER_SUB_SAVE_VIS_AUTO_BOOKMARK, this );
    }

    /**
     * Handle viewer atomic data update
     * @param {String} topic topic
     * @param {Object} data updated data
     */
    update( topic, data ) {
        if( topic === viewerCtxSvc.VIEWER_UPDATE_VIEW_WITH_CAPTURED_IMAGE ) {
            this.displayImageCapture( data.fileUrl );
        } else if( topic === viewerCtxSvc.VIEWER_DEACTIVATE_IMAGE_CAPTURE_DISPLAY ) {
            this.deactivateImageCaptureDisplayInView();
            this.viewerImageCaptureContainer = null;
        } else if( topic === viewerCtxSvc.VIEWER_SUB_PRODUCT_LAUNCH_EVENT ) {
            StructureViewerService.instance.handleProductLaunchEvent( this.viewerCtxData, data );
        } else if( topic === viewerCtxSvc.VIEWER_SUB_SAVE_VIS_AUTO_BOOKMARK ) {
            this.saveVisAutoBookmark();
        }
    }

    /**
     * Initializes Indexed/Non-Indexed Mode
     */
    setIndexedPreference( occmgmtContext ) {
        let uIds = StructureViewerService.instance.getPCIModelObject( occmgmtContext );
        if( !StructureViewerService.instance.isSameProductOpenedAsPrevious( uIds, this.occmgmtContextNameKey ) ) {
            let pciModelObj = StructureViewerService.instance.getViewerPCIToBeLoaded( occmgmtContext );
            if( StructureViewerService.instance.hasAlternatePCI( pciModelObj ) ) {
                viewerPreferenceService.setUseAlternatePCIPreference( 'INDEXED', this.viewerCtxData );
            } else {
                viewerPreferenceService.setUseAlternatePCIPreference( 'NO_INDEXED', this.viewerCtxData );
            }
        }
    }

    /**
     * Set 3d viewer loading status
     * @param {Boolean} isLoading is viewer loading
     */
    setViewerLoadingStatus( isLoading ) {
        this.isLoading = isLoading;
        this.updateViewerAtomicData( 'loadingViewer', isLoading );
    }

    /**
     * Register for viewer visibility events
     */
    registerForConnectionProblems() {
        this.viewerCtxData.addViewerConnectionProblemListener( this.handle3DViewerConnectionProblem, this );
    }

    /**
     * Handler for 3D viewer connection issues
     * @param {Object} viewerCtxDataRef - reference to viewer context data
     */
    handle3DViewerConnectionProblem() {
        this.notify3DViewerReload();
    }

    /**
     * Notify reset parameters  for 3D viewer reload
     */
    notifyResetParametersFor3DReload() {
        eventBus.publish( 'sv.resetParametersFor3DReload', { viewerContext: this.viewerCtxData.getViewerCtxNamespace() } );
    }

    /**
     * Notify 3D viewer reload event
     */
    notify3DViewerReload() {
        eventBus.publish( 'sv.reload3DViewer', { viewerContext: this.viewerCtxData.getViewerCtxNamespace(), occmgmtContextNameKey: this.occmgmtContextNameKey } );
    }

    /**
     * Notify 3D viewer that the Show Suppressed option has been toggled
     */
    notify3DViewerShowSuppressed() {
        eventBus.publish( 'sv.toggleShowSuppressed3DViewer', { viewerContext: this.viewerCtxData.getViewerCtxNamespace() } );
    }

    /**
     * Notify 3D viewer reload for PCI change event
     */
    notify3DViewerReloadForPCIChange() {
        let occmgmtCtx = appCtxSvc.getCtx( this.occmgmtContextNameKey );
        let reloadSession = occmgmtCtx.openedElement.modelType.typeHierarchyArray.indexOf( 'Fnd0AppSession' ) !== -1;
        eventBus.publish( 'sv.reload3DViewerForPCI', { viewerContext: this.viewerCtxData.getViewerCtxNamespace(), reloadSession: reloadSession, occmgmtContextNameKey: this.occmgmtContextNameKey } );
    }

    /**
     * Notify display image capture
     * @param {Boolean} isShow - boolean indicating if image capture should be shown
     */
    notifyDisplayImageCapture( isShow ) {
        this.updateViewerAtomicData( 'displayImageCapture', isShow );
    }

    /**
     * Reload 3D viewer.
     * @param {Object} subPanelContext Sub panel context
     */
    reload3DViewer( subPanelContext, viewerAtomicData ) {
        if( this.isLoading ) {
            return awPromiseService.instance.resolve( 'Already loading!' );
        }
        let self = this;
        this.notifyResetParametersFor3DReload();
        let currentlyInvisibleCsids = this.viewerCtxData.getVisibilityManager().getInvisibleCsids()
            .slice();
        let currentlyInvisibleExpCsids = this.viewerCtxData.getVisibilityManager()
            .getInvisibleExceptionCsids().slice();
        this.ctrlCleanup( true );
        viewerPreferenceService.setEnableDrawingPref( false, this.viewerCtxData );
        return this.initialize3DViewer( subPanelContext, viewerAtomicData, true ).then( () => {
            self.viewerCtxData.getVisibilityManager().restoreViewerVisibility( currentlyInvisibleCsids, currentlyInvisibleExpCsids ).then( function() {
                viewerPreferenceService.setEnableDrawingPref( true, self.viewerCtxData );
                self.viewerCtxData.getDrawManager().enableDrawing( true );
                self.structureViewerVisibilityHandler.viewerVisibilityChangedListener();
            } );
        } ).catch( ( error ) => {
            logger.error( 'Failed to load viewer : ' + error );
            return awPromiseService.instance.reject( error );
        } );
    }

    /**
     * Reload 3D viewer for PCI change.
     * @param {Object} subPanelContext Sub panel context
     * @param {Object} viewerAtomicData viewer atomic data
     * @param {Boolean} reloadSession is reloading session
     */
    reload3DViewerForPCIChange( subPanelContext, viewerAtomicData, reloadSession ) {
        if( this.isLoading ) {
            return;
        }
        this.notifyResetParametersFor3DReload();
        this.ctrlCleanup( true );
        this.initialize3DViewer( subPanelContext, viewerAtomicData, true, reloadSession );
    }

    /**
     * Set 3d Viewer size
     */
    set3DViewerSize() {
        let self = this;
        if( this.resizeTimeoutPromise ) {
            AwTimeoutService.instance.cancel( this.resizeTimeoutPromise );
        }
        this.resizeTimeoutPromise = AwTimeoutService.instance( function() {
            self.resizeTimeoutPromise = null;
            self.viewerCtxData.setSize( self.compute3DViewerWidth(), self.compute3DViewerHeight() );
        }, 250 );
    }

    /**
     * Register for viewer resize events
     */
    registerViewerForParentResize() {
        let self = this;
        let currElement = this.viewerContainerElement;
        while( currElement && !_.includes( currElement.className, 'aw-threeDViewer-viewer3DParentContainer' ) ) {
            currElement = currElement.parentElement;
        }
        const ContentResizeObserver = window.ResizeObserver;
        if( ContentResizeObserver && currElement ) {
            self.divResizeobserver = new ContentResizeObserver( () => {
                self.set3DViewerSize();
            } );
            self.divResizeobserver.observe( currElement );
        }
    }

    /**
     * Compute 3D viewer height
     */
    compute3DViewerHeight() {
        let currElement = this.viewerContainerElement;
        while( currElement && !_.includes( currElement.className, 'aw-threeDViewer-viewer3DParentContainer' ) ) {
            currElement = currElement.parentElement;
        }
        if( currElement ) {
            return currElement.clientHeight;
        }
    }

    /**
     * Compute 3D viewer width
     */
    compute3DViewerWidth() {
        let currElement = this.viewerContainerElement;
        while( currElement && !_.includes( currElement.className, 'aw-threeDViewer-viewer3DParentContainer' ) ) {
            currElement = currElement.parentElement;
        }
        if( currElement ) {
            return currElement.clientWidth;
        }
    }

    /**
     * Setup 3D viewer visibility handler
     */
    setup3DViewerVisibilityHandler() {
        if( this.structureViewerVisibilityHandler === null ) {
            this.structureViewerVisibilityHandler = strViewerVisibilityHandlerPvd.getStructureViewerVisibilityHandler( this.viewerCtxData );
            this.structureViewerVisibilityHandler.registerForVisibilityEvents( this.occmgmtContextNameKey );
        }
        if( !appCtxSvc.getCtx( 'splitView.mode' ) ) {
            let visibilityStateToBeApplied = VisOccmgmtCommunicationService.instance.getVisibilityStateFromExistingObserver();
            if( visibilityStateToBeApplied ) {
                let visibilityMgr = this.viewerCtxData.getVisibilityManager();
                visibilityMgr.restoreViewerVisibility( visibilityStateToBeApplied.invisibleCsids, visibilityStateToBeApplied.invisibleExceptionCsids );
            }
        }
    }

    /**
     * Handle selection data change
     * @param {Object} subPanelCtx selection list
     */
    handleSelectionChange( subPanelCtx ) {
        this.structureViewerSelectionHandler.handleSelectionChange( subPanelCtx );
    }

    /**
     * Handle pack unpack event
     * @param {Object} eventData event data from pack unpack event
     */
    handlePackUnpackEvent( eventData ) {
        if( eventData && eventData.occContext ) {
            this.structureViewerSelectionHandler.onPackUnpackOperation( eventData );
        } else {
            AwTimeoutService.instance( () => {
                this.structureViewerSelectionHandler.onPackUnpackOperation( eventData );
            }, 2000 );
        }
    }

    handlePrimaryWorkAreaContentsReloadedEvent( eventData ) {
        let startReconfigureProcess = this.getValueOnViewerAtomicData( 'startReconfigureProcess' );
        startReconfigureProcess = _.isUndefined( startReconfigureProcess ) ? true : !startReconfigureProcess;
        this.updateViewerAtomicData( 'startReconfigureProcess', startReconfigureProcess );
    }

    /**
     * handle occurence update by effectivity event
     * @param {Object} eventData event data
     */
    handleOccurrenceUpdatedByEffectivityEvent( eventData ) {
        if( eventData && eventData.viewToReact && eventData.viewToReact === this.occmgmtContextNameKey ) {
            this.notify3DViewerReload();
        }
    }

    /**
     * handle CDM update event
     * @param {Object} eventData event data
     */
    handleCdmUpdatedEvent( eventData ) {
        if( eventData && !_.isEmpty( eventData.modifiedObjects ) ) {
            for( let i = 0; i < eventData.modifiedObjects.length; i++ ) {
                let modifiedObj = eventData.modifiedObjects[ i ];
                if( modifiedObj.type === 'DirectModel' ) {
                    this.notify3DViewerReload();
                    break;
                }
            }
        }
    }

    /**
     * handle CDM related modified event
     * @param {Object} eventData event data
     */
    handleCdmRelatedModifiedEvent( eventData ) {
        if( eventData && !_.isEmpty( eventData.childObjects ) ) {
            for( let i = 0; i < eventData.childObjects.length; i++ ) {
                let childObj = eventData.childObjects[ i ];
                if( childObj.type === 'DirectModel' ) {
                    this.notify3DViewerReload();
                    break;
                }
            }
        }
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
        if( eventData && eventData.viewToReact && eventData.viewToReact === this.occmgmtContextNameKey && !eventData.willPCIChangePostRemoveAction ) {
            this.notify3DViewerReload();
        } else if( eventData && eventData.willPCIChangePostRemoveAction ) {
            this.removeElementActionCalled = true;
        }
    }

    /**
     * handle change of use indexed model settings event
     */
    handleUseIndexedModelSettingsChangedEvent() {
        this.notify3DViewerReloadForPCIChange();
    }

    /**
     * handle get occurence visibilty event
     * @param {Object} vmo view model object
     * @returns {Boolean} returns occurence visibility
     */
    handleGetOccVisibilty( vmo ) {
        return this.structureViewerVisibilityHandler.internalGetOccVisibility( vmo );
    }

    /**
     * Toggle occurence visibility from ACE tree
     * @param {Object} eventData event data passed from tree
     */
    handleToggleOccVisibility( eventData ) {
        if( !( eventData && eventData.contextKey === this.occmgmtContextNameKey ) ) {
            return;
        }
        this.structureViewerVisibilityHandler.internalToggleOccVisibility( eventData );
    }

    /**
     * Handle visibility changes from other viewer
     * @param {Object} visibilityData visibility data
     */
    handleVisibilityChanges( visibilityData ) {
        this.structureViewerVisibilityHandler.internalHandleVisibilityChanges( visibilityData );
    }

    /**
     * Setup 3D viewer selection handler
     * @param {Object} selectionData - Array of selected model objects
     */
    setup3DViewerSelectionHandler( selections ) {
        if( this.structureViewerSelectionHandler === null ) {
            if( TracelinkSelectionHandler.instance.isRootSelectionTracelinkType() ) {
                this.structureViewerSelectionHandler = new TracelinkSelection( this.viewerCtxData );
            } else {
                this.structureViewerSelectionHandler = new StructureViewerSelectionHandler( this.viewerCtxData );
            }
            this.structureViewerSelectionHandler.registerForSelectionEvents();
        }
        if( !_.isNull( selections ) && !_.isUndefined( selections ) && !_.isEmpty( selections ) ) {
            let selectionType = this.structureViewerSelectionHandler.getSelectionType( selections );
            let partitionCsids = StructureViewerSelectionHandler.getPartitionCSIDs( selections );
            if( selectionType === 'OCC_SELECTED' ) {
                StructureViewerService.instance.ensureMandatoryPropertiesForCsidLoaded( selections ).then(
                    function() {
                        let newlySelectedCsids = [];
                        for( let i = 0; i < selections.length; i++ ) {
                            if( !_.includes( selections[ i ].modelType.typeHierarchyArray, 'Fgf0PartitionElement' ) ) {
                                newlySelectedCsids.push( objectToCSIDGeneratorService.getCloneStableIdChain( selections[ i ] ) );
                            }
                        }
                        this.structureViewerSelectionHandler.determineAndSelectPackedOccs( selections, newlySelectedCsids, partitionCsids );
                        StructureViewerService.instance.updateViewerSelectionCommandsVisibility( this.viewerCtxData );
                    }.bind( this )
                ).catch( function( error ) {
                    logger.error( 'SsructureViewerData : Failed to load mandatory properties to compute CSID : ' + error );
                } );
            } else if( selectionType === 'ROOT_PRODUCT_SELECTED' && this.viewerCtxData ) {
                this.viewerCtxData.getSelectionManager().selectPartsInViewerUsingModelObject( [] );
                this.viewerCtxData.getSelectionManager().selectPartsInViewerUsingCsid( [] );
            }
        } else {
            let openedElement = appCtxSvc.getCtx( this.occmgmtContextNameKey ).openedElement;
            let topElement = appCtxSvc.getCtx( this.occmgmtContextNameKey ).topElement;
            if( openedElement.uid !== topElement.uid ) {
                let openedElementCsid = objectToCSIDGeneratorService.getCloneStableIdChain( openedElement );
                this.viewerCtxData.getSelectionManager().selectPartsInViewerUsingModelObject( [ openedElement ] );
                this.viewerCtxData.getSelectionManager().setContext( [ openedElementCsid ] );
            } else {
                this.viewerCtxData.getSelectionManager().setContext( [ this.ROOT_ID ] );
                this.viewerCtxData.getSelectionManager().selectPartsInViewerUsingModelObject( [] );
                this.viewerCtxData.getSelectionManager().selectPartsInViewerUsingCsid( [] );
            }
            StructureViewerService.instance.updateViewerSelectionCommandsVisibility( this.viewerCtxData );
        }
    }

    /**
     * Setup viewer image capture container
     */
    setupViewerImageCaptureContainer() {
        let currElement = this.viewerContainerElement;
        while( currElement && !_.includes( currElement.className, 'aw-threeDViewer-viewer3DParentContainer' ) ) {
            currElement = currElement.parentElement;
        }
        _.forEach( currElement.children, ( child ) => {
            if( child.id === 'imageCaptureContainer' ) {
                this.viewerImageCaptureContainer = child;
                return false;
            }
        } );
    }

    /**
     * Register for 3D viewer long press
     */
    registerForLongPressIn3D() {
        this.viewerCtxData.addViewerLongPressListener( this.handle3DViewerLongPress, this );
    }

    /**
     * Handler for 3D viewer connection issues
     */
    handle3DViewerLongPress() {
        this.enableMultiSelectionInACEAnd3D();
    }

    /**
     * Enable multi-selection mode in 3D and ACE
     */
    enableMultiSelectionInACEAnd3D() {
        eventBus.publish( 'primaryWorkarea.multiSelectAction', { multiSelect: true } );
        this.viewerCtxData.getSelectionManager().setMultiSelectModeInViewer( true );
        this.viewerCtxData.setUseTransparency( false );
        let currentlySelectedModelObjs = this.viewerCtxData.getSelectionManager().getSelectedModelObjects();
        let aceMultiSelectionEventData = {};
        if( _.isNull( currentlySelectedModelObjs ) || _.isUndefined( currentlySelectedModelObjs ) || _.isEmpty( currentlySelectedModelObjs ) ) {
            currentlySelectedModelObjs = [];
        }
        aceMultiSelectionEventData.elementsToSelect = currentlySelectedModelObjs;
        aceMultiSelectionEventData.multiSelect = true;
        eventBus.publish( 'aceElementsSelectedEvent', aceMultiSelectionEventData );
    }

    /**
     * Display image capture upon trigger of image capture event.
     *
     * @param {String} fileUrl - Image capture url.
     */
    displayImageCapture( fileUrl ) {
        if( fileUrl ) {
            this.notifyDisplayImageCapture( true );
            if( !this.viewerImageCaptureContainer ) {
                this.setupViewerImageCaptureContainer();
            }
            this.viewerImageCaptureContainer.innerHTML = '';
            let displayImgCaptureDiv = document.createElement( 'div' );
            displayImgCaptureDiv.id = 'awDisplayImageCapture';
            this.viewerImageCaptureContainer.appendChild( displayImgCaptureDiv );
            const imgViewer = imgViewerExport.newInstance( this.viewerImageCaptureContainer );
            this.viewerImageCaptureContainer.imgViewer = imgViewer;
            this.viewerCtxData.getViewerAtomicDataSubject().notify( this.viewerCtxData.IMAGE_CAPTURE_CONTAINER, this.viewerImageCaptureContainer );
            imgViewer.setImage( fileUrl );
        } else {
            logger.error( 'Failed to display image capture due to missing image url.' );
        }
    }

    /**
     * Deactivates the display if image capture in viewer upon deactivate image capture event.
     */
    deactivateImageCaptureDisplayInView() {
        this.viewerCtxData.getViewerAtomicDataSubject().notify( this.viewerCtxData.IMAGE_CAPTURE_CONTAINER, null );
        this.notifyDisplayImageCapture( false );
    }

    /**
     * Set property based coloring criteria for Viewer
     *
     * @param {Object} eventData Event data containing property matched values grouping proerty attribute
     */
    setPropertyBasedColoringCriteria( eventData ) {
        this.colorCriteria = eventData.propGroupingValues;
        this.colorGroupingProperty = eventData.internalPropertyNameToGroupOn;
        let colorPref = appCtxSvc.getCtx( 'preferences' ).AWC_ColorFiltering[ 0 ];
        if( colorPref === 'true' ) {
            this.viewerCtxData.getCriteriaColoringManager().enableCriteriaColoring( this.colorGroupingProperty, this.colorCriteria );
        }
    }

    /**
     * Change color criteria state
     *
     * @param {Object} eventData Event data containing coloring criteria state.
     */
    changeColoringCriteriaState( eventData ) {
        var colorCriteriaState = eventData.dataVal;
        if( colorCriteriaState === 'true' && this.colorCriteria !== null && this.colorGroupingProperty !== null ) {
            this.viewerCtxData.getCriteriaColoringManager().enableCriteriaColoring( this.colorGroupingProperty, this.colorCriteria );
        } else {
            this.viewerCtxData.getCriteriaColoringManager().disableCriteriaColoring();
        }
    }

    /**
     * Model view proxy
     *
     * @param {Object} eventData Event data for model view proxy
     */
    applyModelViewProxy( eventData ) {
        if( eventData && Array.isArray( eventData.selectedObjects ) && eventData.selectedObjects.length > 0 ) {
            this.viewerCtxData.getModelViewManager().invokeModelViewProxy( eventData.selectedObjects[ 0 ].props.fnd0DisclosedModelView.dbValues[ 0 ] );
        }
    }

    /**
     * Handle render source changed event
     * @param {Object} subPanelContext Sub panel context
     */
    handleRenderSourceChanged( subPanelContext, viewerAtomicData ) {
        this.reload3DViewer( subPanelContext, viewerAtomicData );
    }

    /**
     * Register for viewer resize events
     */
    registerForResizeEvents() {
        let self = this;
        // Handle Window resize event
        AwWindowService.instance.onresize = function() {
            eventBus.publish( 'viewer.setSize', {} );
        };
    }

    /**
     * Handle Product Context Changed Event
     * @param {Object} eventData event data
     */
    handleProductContextChangedEvent( eventData ) {
        if( this.viewerCtxData.isConnectionClosed() ) {
            return;
        }
        if( eventData.dataProviderActionType === 'activateWindow' || this.occmgmtContextNameKey !== eventData.updatedView ) {
            return;
        }
        let isReload3DView = false;
        let resetPerformedOnPCI = StructureViewerService.instance.checkIfResetWasPerformedOnPci( this.occmgmtContextNameKey );
        let aceContext = appCtxSvc.getCtx( eventData.updatedView );

        let newProductCtx = StructureViewerService.instance.getPCIModelObject( aceContext );
        if( !( !_.isUndefined( eventData.transientRequestPref ) && !_.isUndefined( eventData.transientRequestPref.reloadDependentTabs ) &&
                eventData.transientRequestPref.reloadDependentTabs === 'false' ) ) {
            if( newProductCtx && this.viewerContext.uid !== newProductCtx.uid && !resetPerformedOnPCI ) {
                isReload3DView = true;
            }
        }
        let isWorksetSelectionChanged = StructureViewerService.instance.isViewerOpenedForFnd0Workset( this.occmgmtContextNameKey ) && eventData.dataProviderActionType ===
            'productChangedOnSelectionChange' && !this.removeElementActionCalled;
        if( this.removeElementActionCalled ) {
            this.removeElementActionCalled = false;
        }
        let snapshotUid = null;
        if( newProductCtx && newProductCtx.props.awb0Snapshot && newProductCtx.props.awb0Snapshot.dbValues[ 0 ] !== '' && !isWorksetSelectionChanged ) {
            snapshotUid = newProductCtx.props.awb0Snapshot.dbValues[ 0 ];
            this._applyProductSnapshot( isReload3DView, snapshotUid, newProductCtx );
        } else {
            if( !resetPerformedOnPCI && eventData.transientRequestPref && eventData.transientRequestPref.recipeReset === 'true' ) {
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

            if( isWorksetSelectionChanged ) {
                isReload3DView = false;
                this.viewerContext = newProductCtx; //update cached PCI when selection change between subset and workset
            }
            if( this.shouldUpdateShowSuppressed() ) {
                // In the future, we want to notify3DViewerShowSuppressed, but due to
                // an issue with BOM that breaks reconfigure,
                // we will just ensured the viewer is reloaded when suppressed is toggled.
                isReload3DView = true;
            }
            this.setPartitionScheme( aceContext );
            if( isReload3DView || splitViewMode && resetPerformedOnPCI ) {
                this.notify3DViewerReloadForPCIChange();
            }
        }
    }

    /**
     * Register for ace related events
     * @param {Object} subPanelContext sub panel context
     */
    registerForOther3ViewerEvents( subPanelContext ) {
        if( this.awGroupObjCategoryChangeEventListener === null ) {
            this.awGroupObjCategoryChangeEventListener = eventBus.subscribe( 'ace.groupObjectCategoryChanged', function( eventData ) {
                let occmgmtActiveCtx = appCtxSvc.getCtx( 'aceActiveContext' );
                let occmgmtActiveCtxKey = occmgmtActiveCtx && occmgmtActiveCtx.key ? occmgmtActiveCtx.key : 'occmgmtContext';
                if( eventData && occmgmtActiveCtxKey === this.occmgmtContextNameKey ) {
                    this.setPropertyBasedColoringCriteria( eventData );
                }
            }.bind( this ), 'structureViewerData' );
        }

        if( this.colorTogglingEventListener === null ) {
            this.colorTogglingEventListener = eventBus.subscribe( 'aw.ColorFilteringToggleEvent', function( eventData ) {
                let occmgmtActiveCtx = appCtxSvc.getCtx( 'aceActiveContext' );
                let occmgmtActiveCtxKey = occmgmtActiveCtx && occmgmtActiveCtx.key ? occmgmtActiveCtx.key : 'occmgmtContext';
                if( eventData && occmgmtActiveCtxKey === this.occmgmtContextNameKey ) {
                    this.changeColoringCriteriaState( eventData );
                }
            }.bind( this ), 'structureViewerData' );
        }

        if( this.multiSelectIn3DListener === null ) {
            this.multiSelectIn3DListener = eventBus.subscribe( 'primaryWorkarea.multiSelectAction', function( eventData ) {
                if( eventData &&
                    eventData.scope &&
                    eventData.scope.commandContext &&
                    eventData.scope.commandContext.occContext &&
                    eventData.scope.commandContext.occContext.viewKey === this.occmgmtContextNameKey ) {
                    this.viewerCtxData.getSelectionManager().setMultiSelectModeInViewer( eventData.multiSelect );
                    this.viewerCtxData.setUseTransparency( false );
                }
            }.bind( this ), 'structureViewerData' );
        }

        if( this.mvProxySelectionChangedEventListener === null ) {
            this.mvProxySelectionChangedEventListener = eventBus.subscribe( 'mvProxyDataProvider.selectionChangeEvent', function( eventData ) {
                let occmgmtActiveCtx = appCtxSvc.getCtx( 'aceActiveContext' );
                let occmgmtActiveCtxKey = occmgmtActiveCtx && occmgmtActiveCtx.key ? occmgmtActiveCtx.key : 'occmgmtContext';
                if( eventData && occmgmtActiveCtxKey === this.occmgmtContextNameKey ) {
                    this.applyModelViewProxy( eventData );
                }
            }.bind( this ), 'structureViewerData' );
        }

        if( this.restoreActionListener === null ) {
            this.restoreActionListener = eventBus.subscribe( 'acePwa.reset', () => {
                if( this.viewerCtxData && !this.viewerCtxData.isConnectionClosed() ) {
                    let occmgmtContextFromViewerContext = StructureViewerService.instance.getOccmgmtContextFromViewerContext( this.viewerCtxData.getViewerCtxNamespace() );
                    if( occmgmtContextFromViewerContext && occmgmtContextFromViewerContext.restoreProduct ) {
                        this.viewerCtxData.getSessionMgr().applyAutoBookmark().then( () => {
                            viewerPreferenceService.loadViewerPreferencesFromVisSession( this.viewerCtxData );
                        } ).catch( () => {
                            logger.error( 'failed to apply bookmark' );
                        } );
                    }
                }
            }, 'structureViewerData' );
        }

        if( this.aceTreeGridSelectionEvent === null ) {
            this.aceTreeGridSelectionEvent = eventBus.subscribe( subPanelContext.gridId + '.gridSelection', () => {
                this.updateViewerAtomicData( 'aceTreeGridSelection', true );
            }, 'structureViewerData' );
        }
    }

    /**
     * Update view to display only search items to display
     */
    showOnlyInViewer( occContext ) {
        var showOnlyInViewer = occContext.searchCriteriaForViewer ? occContext.searchCriteriaForViewer.showOnlyInViewer : false;
        if( showOnlyInViewer && occContext.searchCriteriaForViewer.activeContext === this.occmgmtContextNameKey ) {
            var searchCriteria = occContext.searchCriteriaForViewer.searchCriteria;
            let searchCriteriaJSON = JSON.stringify( searchCriteria );
            if( searchCriteriaJSON !== undefined ) {
                this.viewerCtxData.getSearchMgr().performSearch( 'Awb0FullTextSearchProvider', searchCriteriaJSON, -1,
                    this.viewerCtxData.ViewerSearchActions.SET_VIEW_ONLY ).then( () => {
                    logger.debug( 'Structureviewer: Viewer Search operation completed' );
                } ).catch( ( error ) => {
                    logger.error( 'Structureviewer: Viewer Search operation failed:' + error );
                } );
            }
            occmgmtUtils.updateValueOnCtxOrState( 'searchCriteriaForViewer', { showOnlyInViewer: false }, occContext );
        }
    }

    /**
     * Registers Product Context launch api
     */
    registerAsViewerLaunchInfoProvider() {
        productLaunchInfoProviderService.setViewerContextData( this.viewerCtxData );
        visLaunchInfoProvider.registerProductContextToLaunchVis( productLaunchInfoProviderService.getProductToLaunchableOccMap );
    }

    /**
     * Set host element for CSR rendering of 3d Markups
     */
    setHostElement() {
        let self = this;
        if( viewerPreferenceService.getRenderSource( self.viewerCtxData )[ 0 ] === 'CSR' ) {
            self.viewerCtxData.getViewerView().viewMarkupMgr.setHostElement( self.viewerContainerElement );
        }
    }

    /**
     * Set partition scheme
     * @param {Object} occContext - occmgmt context
     */
    setPartitionScheme( occContext ) {
        const aceActiveContext = appCtxSvc.getCtx( 'aceActiveContext' );
        let showWorksetUnsupportedWarning = false;
        if( aceActiveContext && StructureViewerService.instance.isViewerOpenedForFnd0Workset( aceActiveContext.key ) && !viewerPreferenceService.getIsAllOn( this.viewerCtxData ) ) {
            showWorksetUnsupportedWarning = true;
        }
        let pciObj = StructureViewerService.instance.getViewerPCIToBeLoaded( occContext );
        let rootElement = occContext.rootElement ? occContext.rootElement : occContext.topElement;
        rootElement = rootElement ? rootElement : occContext.openedElement;
        let rootElementCsidChain = objectToCSIDGeneratorService.getCloneStableIdChain( rootElement );
        rootElementCsidChain = rootElementCsidChain === '/' ? '' : rootElementCsidChain;
        if( pciObj && pciObj.props && pciObj.props.fgf0PartitionScheme && Array.isArray( pciObj.props.fgf0PartitionScheme.dbValues ) && pciObj.props.fgf0PartitionScheme.dbValues.length > 0 ) {
            let activePartitionSchemeUid = pciObj.props.fgf0PartitionScheme.dbValues[ 0 ];
            if( !_.isNull( activePartitionSchemeUid ) && !_.isUndefined( activePartitionSchemeUid ) && !_.isEmpty( activePartitionSchemeUid ) ) {
                if( activePartitionSchemeUid !== this.activePartitionSchemeUid ) {
                    this.activePartitionSchemeUid = activePartitionSchemeUid;
                    if( showWorksetUnsupportedWarning ) {
                        msgSvc.showWarning( localeService.getLoadedText( 'StructureViewerMessages' ).WorksetPartitionAllOnUnsupportedWarning );
                    }
                    this.viewerCtxData.getPartitionMgr().setActivePartitionScheme( rootElementCsidChain, activePartitionSchemeUid );
                }
            } else {
                if( activePartitionSchemeUid !== this.activePartitionSchemeUid && this.activePartitionSchemeUid !== '' ) {
                    this.activePartitionSchemeUid = '';
                    this.viewerCtxData.getPartitionMgr().setActivePartitionScheme( rootElementCsidChain, '' );
                }
            }
        } else {
            if( pciObj && pciObj.props && pciObj.props.fgf0PartitionScheme && this.activePartitionSchemeUid !== '' ) {
                this.activePartitionSchemeUid = '';
                this.viewerCtxData.getPartitionMgr().setActivePartitionScheme( rootElementCsidChain, '' );
            }
        }
    }

    /**
     * Clean up the current
     * @param {Boolean} isReloadViewer - boolean indicating if viewer is reloading while clean up.
     */
    ctrlCleanup( isReloadViewer ) {
        VisOccmgmtCommunicationService.instance.unsubscribe( this );
        this.activePartitionSchemeUid = null;
        if( this.structureViewerSelectionHandler ) {
            this.structureViewerSelectionHandler.cleanUp();
            this.structureViewerSelectionHandler = null;
        }

        if( this.structureViewerVisibilityHandler ) {
            this.structureViewerVisibilityHandler.cleanUp( this.occmgmtContextNameKey );
            this.structureViewerVisibilityHandler = null;
        }

        if( this.viewerCtxData ) {
            this.viewerCtxData.removeViewerConnectionProblemListener( this.handle3DViewerConnectionProblem );
            if( isReloadViewer ) {
                let initialState = {
                    isViewerRevealed: false,
                    viewerViewMode: 'NOVIEWER',
                    loadingViewer: true,
                    subCommandToolbarState: {},
                    viewerMeasurement: {},
                    geoAnalysisVolumeSearch: {},
                    hasPMIData: false,
                    allowSectionCreation: false,
                    enableSectionCommandPanel: false,
                    showViewerEmmProgress: true,
                    showViewerProgress: false,
                    displayImageCapture: false,
                    activeCaptureGalleryTab: 'InputSnapshot',
                    onScreen3dMarkupContext: {
                        display3dMarkupToolbar: false
                    },
                    viewerLoadbarVisible: false,
                    viewerLoadbarPercentage: '0',
                    viewerLoadbarMessage: '',
                    viewerStopButtonVisible: false,
                    onScreen2dMarkupContext: {}
                };
                const atomicData = this.viewerCtxData.getViewerAtomicData();
                atomicData.update( initialState );
            }
            viewerCtxSvc.unregisterViewerContext( this.viewerCtxData );
        }

        if( this.awGroupObjCategoryChangeEventListener ) {
            eventBus.unsubscribe( this.awGroupObjCategoryChangeEventListener );
            this.awGroupObjCategoryChangeEventListener = null;
        }

        if( this.colorTogglingEventListener ) {
            eventBus.unsubscribe( this.colorTogglingEventListener );
            this.colorTogglingEventListener = null;
        }

        if( this.multiSelectIn3DListener ) {
            eventBus.unsubscribe( this.multiSelectIn3DListener );
            this.multiSelectIn3DListener = null;
        }

        if( this.mvProxySelectionChangedEventListener ) {
            eventBus.unsubscribe( this.mvProxySelectionChangedEventListener );
            this.mvProxySelectionChangedEventListener = null;
        }

        if( this.restoreActionListener ) {
            eventBus.unsubscribe( this.restoreActionListener );
            this.restoreActionListener = null;
        }

        if( this.aceTreeGridSelectionEvent ) {
            eventBus.unsubscribe( this.aceTreeGridSelectionEvent );
            this.aceTreeGridSelectionEvent = null;
        }

        visLaunchInfoProvider.resetProductContextInfo();
        productLaunchInfoProviderService.clearViewerCtxData();

        if( isReloadViewer ) {
            this.viewerContainerElement.innerHTML = '';
        }

        let sideNavConfig = appCtxSvc.getCtx( 'awSidenavConfig' );
        if( sideNavConfig && sideNavConfig.globalSidenavContext &&
            sideNavConfig.globalSidenavContext.globalNavigationSideNav &&
            sideNavConfig.globalSidenavContext.globalNavigationSideNav.open &&
            sideNavConfig.globalSidenavContext.globalNavigationSideNav.pinned ) {
            eventBus.publish( 'awsidenav.openClose', {
                id: 'globalNavigationSideNav'
            } );
        }

        //always close if any panel open during clean up
        var activeToolAndInfoCmd = appCtxSvc.getCtx( 'activeToolsAndInfoCommand' );
        if( activeToolAndInfoCmd && activeToolAndInfoCmd.commandId ) {
            if( this.viewerPanelsToClose.includes( activeToolAndInfoCmd.commandId ) ) {
                eventBus.publish( 'awsidenav.openClose', {
                    id: 'aw_toolsAndInfo',
                    commandId: activeToolAndInfoCmd.commandId
                } );
            }
        }
        if( this.divResizeobserver ) {
            this.divResizeobserver.disconnect();
        }
        this.unregisterAtomicDataTopics();
    }

    /**
     * Trigger dynamic update of viewer.
     * This will cause the viewer to re-query Tc for the current product
     * structure and then add and/or remove parts from the model as needed.
     * @param {Object} tempAppSessionResponse createOrUpdateSavedSession SOA response
     * @param {Object} subPanelContext subpanel context
     */
    reconfigureViewer( tempAppSessionResponse, subPanelContext ) {
        this.viewerContext = StructureViewerService.instance.getPCIModelObject( subPanelContext.occContext );
        let options = 0; // hint on how to handle orphan objects - 0 Keep, 1 Discard
        if( this.viewerCtxData ) {
            let dynamicUpdateMgr = this.viewerCtxData.getDynamicUpdateMgr();
            this.setup3DViewerSelectionHandler( subPanelContext.occContext.selectedModelObjects );
            if( tempAppSessionResponse ) {
                let tempAppSession = tempAppSessionResponse.sessionOutputs[ 0 ].sessionObject;
                if( tempAppSession ) {
                    if( !_.isUndefined( dynamicUpdateMgr ) ) {
                        dynamicUpdateMgr.reconfigure( tempAppSession.uid, options ).catch( () => {
                            // Reload viewer
                            this.notify3DViewerReloadForPCIChange();
                        } );
                    } else {
                        this.notify3DViewerReloadForPCIChange();
                    }
                }
            } else {
                dynamicUpdateMgr.reconfigure( this.viewerContext.uid, options ).catch( () => {
                    // Reload viewer
                    this.notify3DViewerReloadForPCIChange();
                } );
            }
        }
    }

    /**
     * Gets user configurations properties from the aceActiveContext related to the structure.
     * Currently only accounts for Show Suppressed, but can be easily modified to account for
     * Show Excluded by Variant and Show Excluded by Effectivity.
     *
     * @returns {Object} Returns structure configuration object if aceActiveCtx is available
     */
    getStructureConfiguration() {
        let aceActiveCtx = appCtxSvc.getCtx( this.occmgmtContextNameKey );
        if( aceActiveCtx ) {
            return { showSuppressedOcc: aceActiveCtx.showSuppressedOcc };
        }
        return null;
    }

    /**
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
     * Gets the current option in the ACE tree for showing suppressed occurrences,
     * then sends that value to the Vis viewer.
     */
    setShowSuppressed() {
        var visibilityMgr = this.viewerCtxData.getVisibilityManager();

        if( visibilityMgr ) {
            let showSuppressed = this.structureConfiguration.showSuppressedOcc;
            visibilityMgr.setShowSuppressed( showSuppressed );
        }
    }

    /**
     * Save the auto bookmark for product
     */
    saveVisAutoBookmark() {
        this.viewerCtxData.getSessionMgr().saveAutoBookmark();
    }

    /**
     * update viewer atomic data
     *
     * @param {Object} propertyPath path of property on atomic data value
     * @param {Object} propertyValue vlaue to be set on that path
     */
    updateViewerAtomicData( propertyPath, propertyValue ) {
        const newViewerAtomicData = { ...this.viewerAtomicData.getValue() };
        _.set( newViewerAtomicData, propertyPath, propertyValue );
        this.viewerAtomicData.update( newViewerAtomicData );
    }

    /*
     * Returns type of viewer
     */
    getViewerType() {
        return 'struct' + this.occmgmtContextNameKey;
    }

    /**
     * Returns visibility state
     * @returns {Object} Visibility data state
     */
    getVisibilityState() {
        return this.structureViewerVisibilityHandler.getVisibilityState();
    }
    /**
     * get viewer atomic data value
     *
     * @param {Object} propertyPath path of property on atomic data value
     * @returns {Object} value on requested property path
     */
    getValueOnViewerAtomicData( propertyPath ) {
        return _.get( this.viewerAtomicData.getValue(), propertyPath );
    }

    /**
     * Apply Product snapshot
     *
     * @param {Boolean} isReload3DView reload flag
     * @param {String} snapshotUid applied product snapshot uid
     * @param {Object} productContext updated product context
     *
     */
    _applyProductSnapshot( isReload3DView, snapshotUid, productContext ) {
        let applyFilterFlag = true;
        if( snapshotUid && productContext ) {
            let viewerFilterCount = this.viewerContext.props.awb0FilterCount.dbValues[ 0 ];
            let snapshotFilterCount = productContext.props.awb0FilterCount.dbValues[ 0 ];
            if( viewerFilterCount && snapshotFilterCount ) {
                // If either the current view or the applied snapshot have filters on
                // the product structure, need to reload
                if( viewerFilterCount === '0' && snapshotFilterCount === '0' ) {
                    applyFilterFlag = false;
                }
            } else {
                // If either of these are null, there are no filters
                applyFilterFlag = false;
            }
        }
        if( isReload3DView ) {
            let snapshotObj = cdm.getObject( snapshotUid );
            if( snapshotObj && isReload3DView ) {
                eventBus.publish( 'SnapshotGalley.showReloadInfo', {
                    snapshotName: snapshotObj.props.object_name.dbValues[ 0 ]
                } );
            }
            this.launchSnapshotGalleyPanel = true;
            this.notify3DViewerReloadForPCIChange();
        } else {
            if( viewerPerformanceService.isPerformanceMonitoringEnabled() ) {
                viewerPerformanceService.setViewerPerformanceMode( true );
                viewerPerformanceService.startViewerPerformanceDataCapture( viewerPerformanceService.viewerPerformanceParameters.ApplyProductSnapshot );
            }
            this.viewerCtxData.getDynamicUpdateMgr().applyTCSnapshot( snapshotUid, productContext.uid, applyFilterFlag ).then( () => {
                if( viewerPerformanceService.isPerformanceMonitoringEnabled() ) {
                    viewerPerformanceService.stopViewerPerformanceDataCapture( 'Snapshot applied : ' );
                    viewerPerformanceService.setViewerPerformanceMode( false );
                }
                StructureViewerService.instance.updateSectionCommandState( this.viewerCtxData );
            } );
        }
    }

    /**
     * clean up 3D viewer
     */
    cleanup3DViewer() {
        this.viewerCtxData.getViewerAtomicDataSubject().notify( this.viewerCtxData.CLEANUP_3D_VIEWER );
        this.ctrlCleanup( false );
    }
}
