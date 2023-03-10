// Copyright (c) 2022 Siemens
/* eslint-disable no-invalid-this */
/* eslint-disable class-methods-use-this */

/**
 * @module js/structureViewerService
 */
import appCtxService from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import viewerRenderService from 'js/viewerRender.service';
import viewerContextService from 'js/viewerContext.service';
import objectToCSIDGeneratorService from 'js/objectToCSIDGeneratorService';
import dataManagementService from 'soa/dataManagementService';
import cdm from 'soa/kernel/clientDataModel';
import viewerPreferenceService from 'js/viewerPreference.service';
import tcServerVersion from 'js/TcServerVersion';
import messagingService from 'js/messagingService';
import localeService from 'js/localeService';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import logger from 'js/logger';
import AwBaseService from 'js/awBaseService';
import soaSvc from 'soa/kernel/soaService';
import commandPanelService from 'js/commandPanel.service';
import disclosureService from 'js/disclosureService';
import dmSvc from 'soa/dataManagementService';
import createLaunchInfoRequest from 'js/createLaunchInfoRequest';
import viewerPerformanceService from 'js/viewerPerformance.service';
import occmgmtUtils from 'js/occmgmtUtils';

export default class StructureViewerService extends AwBaseService {
    constructor() {
        super();
        /**
         * Viewer div element
         */
        this._lastViewerDivElement = null;

        /**
         * Viewer view object
         */
        this._lastViewerCtxObj = null;

        /**
         * Viewer last product context info
         */
        this._lastProductContextInfoObj = null;

        /**
         * Viewer 2 div element
         */
        this._lastViewerDivElement2 = null;

        /**
         * Viewer 2 view object
         */
        this._lastViewerCtxObj2 = null;

        /**
         * Viewer 2 last product context info
         */
        this._lastProductContextInfoObj2 = null;

        /**
         * App Session creation started listener
         */
        this._appSessionCreateStaredListener = null;

        /**
         * App Session creation stopped listener
         */
        this._appSessionCreateStoppedListener = null;

        /**
         * App Session created listener
         */
        this._appSessionCreatedListener = null;

        /**
         * Retain 3D for App Session creation
         */
        this._retain3DforAppSessionCreation = false;

        /**
         * PCI changed listener
         */
        this._productContextInfoChangedEvent = null;

        /**
         * Filter state
         */
        this._isFilterApplied = true;

        /**
         * Reset state
         */
        this._aceResetState = [];

        /**
         * Listen to filter event to reload viewer
         */
        this._primaryWorkAreaContentReloadEvent = null;

        /**
         * Listen to save session event
         */
        this._aceSaveSessionSuccessEvent = null;

        /**
         * Event to reset filter
         */
        this._resetFilterEvent = null;

        /**
         * Event to reset filter
         */
        this._structureCompareSecondViewerNamespace = 'awStructureCompareViewer';

        /**
         * Session save as panel open subscription
         */
        this._appSessionSaveAsStaredListener = null;

        /**
         * Session save as subscription
         */
        this._appSessionSaveAsListener = null;

        /**
         * Session save as panel close subscription
         */
        this._appSessionSaveAsStoppedListener = null;

        /**
         * Ace reset structure started subscription
         */
        this._aceResetStructureStartedListener = null;

        /**
         * split view loaded unloaded event subscription
         */
        this._splitTreeLoadedUnloadedListner = null;

        /**
         * Listen to 3D Cleanup event
         */
        this._cleanup3DViewerViewerEvent = null;

        /**
         * List of events to subscribe to set force reload 3D Viewer when it is not active.
         */
        this.eventsToSubscribeForceReload = [
            'addElement.elementsAdded',
            'ace.elementsRemoved',
            'replaceElement.elementReplacedSuccessfully',
            'occurrenceUpdatedByEffectivityEvent',
            'cba.alignmentUpdated',
            'primaryWorkArea.contentsReloaded' // filter applied to BOM
        ];

        /**
         * Object to store viewer key and corresponding listener objects
         */
        this.viewerKeyToForceReloadListenersMap = {};

        if( tcServerVersion.majorVersion >= 13 ) {
            this.registerAceResetStructureEvent();
            this.registerSplitViewEvents();
        }
        if( tcServerVersion.majorVersion === 12 && tcServerVersion.minorVersion >= 4 ) {
            this._registerAppSessionCreationListener124();
            this._registerAppSessionSaveAsListener124();
        }
        this.registerAceResetStructureEvent();
        this.registerCleanup3DViewEventListener();
    }

    /**
     * Set OccmgmtContext key name on viewer context
     *
     * @param {String} viewerContextNamespace Viewer context namespace
     * @param {String} occmgmtContextNameKey OccmgmtContext key name
     */
    setOccmgmtContextNameKeyOnViewerContext( viewerContextNamespace, occmgmtContextNameKey ) {
        viewerContextService.updateViewerApplicationContext( viewerContextNamespace,
            viewerContextService.VIEWER_OCCMGMTCONTEXT_NAMESPACE_TOKEN, occmgmtContextNameKey );
    }

    /**
     * Get OccmgmtContext key name from viewer context
     *
     * @param {String} viewerContextNamespace Viewer context namespace
     * @return {String} OccmgmtContext key name
     */
    getOccmgmtContextNameKeyFromViewerContext( viewerContextNamespace ) {
        return viewerContextService.getViewerApplicationContext( viewerContextNamespace,
            viewerContextService.VIEWER_OCCMGMTCONTEXT_NAMESPACE_TOKEN );
    }

    /**
     * Get OccmgmtContext key name from viewer context
     *
     * @param {String} viewerContextNamespace Viewer context namespace
     * @return {Object} OccmgmtContext object
     */
    getOccmgmtContextFromViewerContext( viewerContextNamespace ) {
        let occmgmtContextKey = viewerContextService.getViewerApplicationContext( viewerContextNamespace,
            viewerContextService.VIEWER_OCCMGMTCONTEXT_NAMESPACE_TOKEN );
        return appCtxService.getCtx( occmgmtContextKey );
    }

    /**
     * Check if same product being opened as previous
     *
     * @param {Object} productCtxInfo product context info object
     * @param {Object} contextNameKey Occmgmt context name key
     *
     * @return {Boolean} True is same product is being opened
     */
    isSameProductOpenedAsPrevious( productCtxInfo, contextNameKey ) {
        let checkIfResetPerformed = this.checkIfResetWasPerformedOnPci( contextNameKey );
        if( appCtxService.getCtx( 'splitView.viewKeys' ) ) {
            let sourceContextKey = appCtxService.getCtx( 'splitView.viewKeys' )[ 0 ];
            let targetContextKey = appCtxService.getCtx( 'splitView.viewKeys' )[ 1 ];

            if( contextNameKey === sourceContextKey ) {
                // eslint-disable-next-line max-len
                return this._lastProductContextInfoObj && this._lastProductContextInfoObj.uid === productCtxInfo.uid && this._lastViewerCtxObj && !this._lastViewerCtxObj.isConnectionClosed() && this
                    ._isFilterApplied && !checkIfResetPerformed;
            } else if( contextNameKey === targetContextKey ) {
                // eslint-disable-next-line max-len
                return this._lastProductContextInfoObj2 && this._lastProductContextInfoObj2.uid === productCtxInfo.uid && this._lastViewerCtxObj2 && !this._lastViewerCtxObj2.isConnectionClosed() && this
                    ._isFilterApplied && !checkIfResetPerformed;
            }
        } else if( contextNameKey === 'occmgmtContext' ) {
            // eslint-disable-next-line max-len
            if( productCtxInfo.props.awb0Snapshot || this._lastProductContextInfoObj && this._lastProductContextInfoObj.props.awb0Snapshot ) {
                return this._lastProductContextInfoObj && this._lastProductContextInfoObj.uid === productCtxInfo.uid && this._lastViewerCtxObj && !this._lastViewerCtxObj.isConnectionClosed() && this
                    ._isFilterApplied && !checkIfResetPerformed && productCtxInfo.props.awb0Snapshot && this._lastProductContextInfoObj.props.awb0Snapshot && productCtxInfo.props.awb0Snapshot.dbValues[
                    0 ] === this._lastProductContextInfoObj.props.awb0Snapshot.dbValues[ 0 ];
            }
            return this._lastProductContextInfoObj && this._lastProductContextInfoObj.uid === productCtxInfo.uid && this._lastViewerCtxObj && !this._lastViewerCtxObj.isConnectionClosed() && this
                ._isFilterApplied && !checkIfResetPerformed;
        }
        return false;
    }

    /**
     * Update vis session
     *
     * @param {String} occmgmtCtxKey occmgmtcontext key
     */
    updateVisSession( occContext ) {
        if( _.isUndefined( occContext ) || _.isNull( occContext ) ) {
            return;
        }
        //The indexed PCI doesn't contain the Awb0StructureRecepie property and hence causes issues while session creation
        //Always pass the non-indexed PCI
        let productCtxInfo = occContext.productContextInfo;
        let self = this;
        if( self._lastViewerCtxObj && !self._lastViewerCtxObj.isConnectionClosed() && productCtxInfo.props.awb0ContextObject ) {
            if( Array.isArray( productCtxInfo.props.awb0ContextObject.dbValues ) &&
                !_.isUndefined( productCtxInfo.props.awb0ContextObject.dbValues[ 0 ] ) &&
                !_.isNull( productCtxInfo.props.awb0ContextObject.dbValues[ 0 ] ) ) {
                occmgmtUtils.updateValueOnCtxOrState( 'disableSaveSessionButtonForViewer', true, occContext );
                self._getLastModDate( occContext.viewKey ).then( ( LMD ) => {
                    self._lastViewerCtxObj.getSessionMgr().updateAppSession(
                        productCtxInfo.props.awb0ContextObject.dbValues[ 0 ], productCtxInfo.uid, LMD ).then( () => {
                        setTimeout( () => {
                            occmgmtUtils.updateValueOnCtxOrState( 'disableSaveSessionButtonForViewer', false, occContext );
                        }, 5000 );
                        let occmgmtActiveContext = appCtxService.getCtx( 'aceActiveContext' );
                        if( !occmgmtActiveContext.context.appSessionWorksetNode ) {
                            self._syncAppSessionLSDWithAutobookmark();
                        }
                    },
                    errorMsg => {
                        if( errorMsg.name === 'TcVisSessionUpdateError' ) {
                            if( errorMsg.message === 'Checkout' ) {
                                self._popupSaveAsDialog();
                            } else {
                                messagingService.showWarning( localeService.getLoadedText( 'StructureViewerMessages' ).InternalError );
                            }
                        }
                    } );
                } );
            }
        }
    }

    /**
     * Check if App Session is being opened
     *
     * @param {Object} productCtxInfo product context info object
     * @return {Boolean} True is same product is being opened
     */
    createVisSessionifAppSessionBeingOpened( productCtxInfo, last_mod_date ) {
        if( this._retain3DforAppSessionCreation ) {
            if( viewerPerformanceService.isPerformanceMonitoringEnabled() ) {
                viewerPerformanceService.setViewerPerformanceMode( true );
                viewerPerformanceService.startViewerPerformanceDataCapture( viewerPerformanceService.viewerPerformanceParameters.SessionSave );
            }
            this._retain3DforAppSessionCreation = false;
            let self = this;
            if( this._lastViewerCtxObj && !this._lastViewerCtxObj.isConnectionClosed() &&
                productCtxInfo.props.awb0ContextObject ) {
                if( Array.isArray( productCtxInfo.props.awb0ContextObject.dbValues ) &&
                    !_.isUndefined( productCtxInfo.props.awb0ContextObject.dbValues[ 0 ] ) &&
                    !_.isNull( productCtxInfo.props.awb0ContextObject.dbValues[ 0 ] ) ) {
                    this._lastViewerCtxObj.getSessionMgr().updateAppSession(
                        productCtxInfo.props.awb0ContextObject.dbValues[ 0 ], productCtxInfo.uid, last_mod_date ).then( () => {
                        if( viewerPerformanceService.isPerformanceMonitoringEnabled() ) {
                            viewerPerformanceService.stopViewerPerformanceDataCapture( 'Session created : ' );
                            viewerPerformanceService.setViewerPerformanceMode( false );
                        }
                        self._syncAppSessionLSDWithAutobookmark();
                        eventBus.publish( 'sv.reload3DViewer', { viewerContext: self._lastViewerCtxObj.getViewerCtxNamespace() } );
                    },
                    errorMsg => {
                        if( errorMsg.name === 'TcVisSessionUpdateError' ) {
                            if( errorMsg.message === 'Checkout' ) {
                                this._popupSaveAsDialog();
                            } else {
                                messagingService.showWarning( localeService.getLoadedText( 'StructureViewerMessages' ).InternalError );
                            }
                        }
                    } );
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Check if App Session is being opened
     *
     * @param {Object} productCtxInfo product context info object
     * @return {Boolean} True is same product is being opened
     */
    isAppSessionBeingOpened( productCtxInfo ) {
        if( this._retain3DforAppSessionCreation && this._lastViewerCtxObj && !this._lastViewerCtxObj.isConnectionClosed() &&
            productCtxInfo.props.awb0ContextObject && Array.isArray( productCtxInfo.props.awb0ContextObject.dbValues ) &&
            !_.isUndefined( productCtxInfo.props.awb0ContextObject.dbValues[ 0 ] ) &&
            !_.isNull( productCtxInfo.props.awb0ContextObject.dbValues[ 0 ] ) ) {
            return true;
        }
        return false;
    }

    /**
     * Check if same product being opened as previous
     * @param {Object} contextNameKey Occmgmt context name key
     * @param {Object} viewerAtomicData viewer atomic data
     * @return {Promise} A promise that return the viewer view and context object once resolved
     */
    restorePreviousView( contextNameKey, viewerAtomicData ) {
        let returnPromise = AwPromiseService.instance.defer();
        if( appCtxService.getCtx( 'splitView.viewKeys' ) ) {
            let targetContextKey = appCtxService.getCtx( 'splitView.viewKeys' )[ 1 ];
            if( contextNameKey === targetContextKey ) {
                this.updateViewerPreferences( this._lastViewerCtxObj2, viewerAtomicData );
                this._lastViewerCtxObj2.setViewerAtomicData( viewerAtomicData );
                returnPromise.resolve( [ this._lastViewerCtxObj2, this._lastViewerDivElement2 ] );
                this.updateStructureViewerContextWithVisibility( this._lastViewerCtxObj2, true );
            } else {
                this.updateViewerPreferences( this._lastViewerCtxObj, viewerAtomicData );
                this._lastViewerCtxObj.setViewerAtomicData( viewerAtomicData );
                returnPromise.resolve( [ this._lastViewerCtxObj, this._lastViewerDivElement ] );
                this.updateStructureViewerContextWithVisibility( this._lastViewerCtxObj, true );
            }
        } else {
            this.updateViewerPreferences( this._lastViewerCtxObj, viewerAtomicData );
            returnPromise.resolve( [ this._lastViewerCtxObj, this._lastViewerDivElement ] );
            this.updateStructureViewerContextWithVisibility( this._lastViewerCtxObj, true );
        }
        return returnPromise.promise;
    }

    /**
     * update viewer preference after restore
     * @param {Object} lastViewerCtxObj last viewer context data object
     * @param {Object} viewerAtomicData viewer atomic data
     *
     */
    updateViewerPreferences( lastViewerCtxObj, viewerAtomicData ) {
        let lastViewerPref = lastViewerCtxObj.getValueOnViewerAtomicData( 'viewerPreference' );
        lastViewerCtxObj.setViewerAtomicData( viewerAtomicData );
        lastViewerCtxObj.updateViewerAtomicData( 'viewerPreference', lastViewerPref );
    }

    /**
     * Get viewer load input parameters
     *
     * @param {Object} productCtxInfo product context info object
     * @param {Number} viewerWidth desired viewer width
     * @param {Number} viewerHeight desired viewer height
     * @param {Boolean} isShowAll Sets whether or not all geometry should be visible in the 3D scene.
     * @param {Function} securityMarkingHandlerFn explicit security marking handler.
     * @param {Object} occmgmtContext Occmgmt context
     * @param {Boolean} reloadSession boolean indicating reload session
     * @return {Promise} A promise that return the viewer view and context object once resolved
     */
    getViewerLoadInputParameter( productCtxInfo, viewerWidth, viewerHeight, isShowAll,
        securityMarkingHandlerFn, occmgmtContext, reloadSession, selectionLimit ) {
        var returnPromise = AwPromiseService.instance.defer();
        var viewerLoadInputParams = viewerRenderService.getViewerLoadInputParameters();
        viewerLoadInputParams.setTargetObject( productCtxInfo );
        viewerLoadInputParams.setProductUids( [ productCtxInfo.uid ] );
        viewerLoadInputParams.setViewerContainer( document.createElement( 'div' ) );
        viewerLoadInputParams.setHeight( parseInt( viewerHeight ) );
        viewerLoadInputParams.setWidth( parseInt( viewerWidth ) );
        viewerLoadInputParams.setShowAll( isShowAll );
        viewerLoadInputParams.setSecurityMarkingHandler( securityMarkingHandlerFn );
        viewerLoadInputParams.setViewerCtxNamespace( this.getViewerCtxNamespaceUsingOccmgmtKey( occmgmtContext.viewKey ) );
        viewerLoadInputParams.setApplyBookmarkApplicable( this._isApplyBookmarkApplicable() );
        viewerLoadInputParams.setDisableBookMarkApplicable( this._isDisableBookMarkApplicable() );
        viewerLoadInputParams.setShowSuppressed( this._isShowSuppressedApplicable( occmgmtContext ) );
        viewerLoadInputParams.setSelectionLimit( selectionLimit );
        this._getAdditionalInfo( occmgmtContext, reloadSession ).then( ( additionalInfo ) => {
            viewerLoadInputParams.setAdditionalInfo( additionalInfo );
            returnPromise.resolve( viewerLoadInputParams );
        }, ( errorMsg ) => {
            returnPromise.reject( errorMsg );
        } );

        return returnPromise.promise;
    }

    /**
     * Get viewer context namespace based on occmgmt key
     * @param {Object} contextNameKey Occmgmt context name key
     */
    getViewerCtxNamespaceUsingOccmgmtKey( contextNameKey ) {
        if( appCtxService.getCtx( 'splitView.viewKeys' ) ) {
            let targetContextKey = appCtxService.getCtx( 'splitView.viewKeys' )[ 1 ];
            if( targetContextKey && contextNameKey === targetContextKey ) {
                return this._structureCompareSecondViewerNamespace;
            }
        }
        return viewerRenderService.getDefaultViewerNamespace();
    }

    /**
     * Clean up previous view
     * @param {Object} contextNameKey Occmgmt context name key
     * @returns {Promise} A promise that is resolved after closing the view
     */
    cleanUpPreviousView( contextNameKey ) {
        let closeDeferred = AwPromiseService.instance.defer();
        if( appCtxService.getCtx( 'splitView.viewKeys' ) ) {
            let sourceContextKey = appCtxService.getCtx( 'splitView.viewKeys' )[ 0 ];
            let targetContextKey = appCtxService.getCtx( 'splitView.viewKeys' )[ 1 ];
            if( contextNameKey === sourceContextKey ) {
                if( this._lastViewerCtxObj ) {
                    //Reinitialize last product context info and viewer context object to null since viewer associated no longer exists.
                    this._lastViewerCtxObj.close().then( () => {
                        closeDeferred.resolve();
                    } ).catch( () => {
                        closeDeferred.resolve();
                    } );
                    this._lastViewerCtxObj = null;
                    this._lastProductContextInfoObj = null;
                    return closeDeferred.promise;
                }
            } else if( contextNameKey === targetContextKey ) {
                if( this._lastViewerCtxObj2 ) {
                    //Reinitialize last product context info and viewer context object to null since viewer associated no longer exists.
                    this._lastViewerCtxObj2.close().then( () => {
                        closeDeferred.resolve();
                    } ).catch( () => {
                        closeDeferred.resolve();
                    } );
                    this._lastViewerCtxObj2 = null;
                    this._lastProductContextInfoObj2 = null;
                    return closeDeferred.promise;
                }
            }
        } else if( contextNameKey === 'occmgmtContext' ) {
            if( this._lastViewerCtxObj ) {
                //Reinitialize last product context info and viewer context object to null since viewer associated no longer exists.
                this._lastViewerCtxObj.close().then( () => {
                    closeDeferred.resolve();
                } ).catch( () => {
                    closeDeferred.resolve();
                } );
                this._lastViewerCtxObj = null;
                this._lastProductContextInfoObj = null;
                return closeDeferred.promise;
            }
        }

        return AwPromiseService.instance.resolve();
    }

    /**
     * Get viewer view
     *
     * @param {Object} viewerLoadInputParams desired viewer height
     * @param {String} contextNameKey Occmgmt context name key
     * @return {Promise} A promise that return the viewer view and context object once resolved
     */
    getViewerView( viewerLoadInputParams, contextNameKey ) {
        var returnPromise = AwPromiseService.instance.defer();
        var productCtxInfo = viewerLoadInputParams.getTargetObject();
        if( viewerPerformanceService.isPerformanceMonitoringEnabled() ) {
            viewerPerformanceService.startViewerPerformanceDataCapture( viewerPerformanceService.viewerPerformanceParameters.InitialLoading );
        }
        var viewerloadPromise = viewerRenderService.loadByModelObjectInputParam( viewerLoadInputParams );
        viewerloadPromise.then( ( viewerData ) => {
            if( viewerPerformanceService.isPerformanceMonitoringEnabled() ) {
                viewerPerformanceService.stopViewerPerformanceDataCapture( 'First image loaded: ', 'IntermittentCapture' );
            }
            if( appCtxService.getCtx( 'splitView.viewKeys' ) ) {
                let sourceContextKey = appCtxService.getCtx( 'splitView.viewKeys' )[ 0 ];
                let targetContextKey = appCtxService.getCtx( 'splitView.viewKeys' )[ 1 ];
                if( contextNameKey === sourceContextKey ) {
                    this._lastProductContextInfoObj = _.cloneDeep( productCtxInfo );
                    this._lastViewerCtxObj = viewerData;
                    this._lastViewerDivElement = viewerLoadInputParams.getViewerContainer();
                } else if( contextNameKey === targetContextKey ) {
                    this._lastProductContextInfoObj2 = _.cloneDeep( productCtxInfo );
                    this._lastViewerCtxObj2 = viewerData;
                    this._lastViewerDivElement2 = viewerLoadInputParams.getViewerContainer();
                }
            } else if( contextNameKey === 'occmgmtContext' ) {
                this._lastProductContextInfoObj = _.cloneDeep( productCtxInfo );
                this._lastViewerCtxObj = viewerData;
                this._lastViewerDivElement = viewerLoadInputParams.getViewerContainer();
            }
            returnPromise.resolve( [ viewerData, viewerLoadInputParams.getViewerContainer() ] );
        }, ( errorMsg ) => {
            returnPromise.reject( errorMsg );
        } );
        return returnPromise.promise;
    }

    /**
     * Gets additional info for the product
     * @param {Object} occmgmtCtx Occmgmt context
     * @param {boolean} reloadSession reload session flag
     * @returns {Object} Object containing additional information to load viewer view correctly
     */
    _getAdditionalInfo( occmgmtCtx, reloadSession ) {
        var additionalInfo = {
            OVERRIDE_VisDoc_Type: 'PRODUCT',
            TransientDoc: 'True',
            splitMode: appCtxService.getCtx( 'splitView.mode' ),
            reloadSession: reloadSession
        };

        // Eventaully server will have to support MMV for all product types. So code for additional info below is short lived.
        var deferredAdditionalInfo = AwPromiseService.instance.defer();
        additionalInfo.isFilteredProduct = _.isEmpty( occmgmtCtx.recipe ) ? 'False' : 'True';
        if( occmgmtCtx.rootElement ) {
            additionalInfo.IGNOREKEY_TOPLINE_UID = occmgmtCtx.rootElement.uid;
        }
        if( !occmgmtCtx.openedElement.props.awb0UnderlyingObjectType ) {
            dataManagementService.getProperties( [ occmgmtCtx.openedElement.uid ], [ 'awb0UnderlyingObjectType' ] )
                .then( () => {
                    if( occmgmtCtx.openedElement.props.awb0UnderlyingObjectType ) {
                        additionalInfo.underlyingObjectType = occmgmtCtx.openedElement.props.awb0UnderlyingObjectType.dbValues[ 0 ];
                    } else {
                        additionalInfo.underlyingObjectType = undefined;
                    }
                    deferredAdditionalInfo.resolve( additionalInfo );
                }, () => {
                    additionalInfo.underlyingObjectType = undefined;
                    deferredAdditionalInfo.resolve( additionalInfo );
                } );
        } else {
            additionalInfo.underlyingObjectType = occmgmtCtx.openedElement.props.awb0UnderlyingObjectType.dbValues[ 0 ];
            deferredAdditionalInfo.resolve( additionalInfo );
        }

        return deferredAdditionalInfo.promise;
    }

    /**
     * Set viewer visibility in viewer application context
     *
     * @param {ViewerContextData} viewerCtxData viewer context data
     * @param {Boolean} isViewerVisible true if viewer is visible
     */
    updateStructureViewerContextWithVisibility( viewerCtxData, isViewerVisible ) {
        viewerRenderService.updateViewerContextWithVisibility( viewerCtxData, isViewerVisible );
    }

    /**
     * Set viewer visibility in viewer application context
     *
     * @param {String} viewerCtxNamespace viewer context name space
     * @param {Boolean} isViewerVisible true if viewer is visible
     */
    updateStructureViewerVisibility( viewerCtxNamespace, isViewerVisible ) {
        viewerRenderService.updateViewerVisibility( viewerCtxNamespace, isViewerVisible );
    }

    /**
     * Ensure pandatory properties for Csids are loaded
     *
     * @param {Array} modelObjects list of model objects
     * @returns {Promise} returns promise that is resolved after loading required properties
     */
    ensureMandatoryPropertiesForCsidLoaded( modelObjects ) {
        var uidsToLoad = [];
        if( modelObjects && modelObjects.length > 0 ) {
            for( var index = 0; index < modelObjects.length; index++ ) {
                var props = modelObjects[ index ].props;
                if( !props.awb0Parent || !props.awb0CopyStableId ) {
                    uidsToLoad.push( modelObjects[ index ].uid );
                }
            }
        }
        if( uidsToLoad.length > 0 ) {
            return dataManagementService.getProperties( uidsToLoad, [ 'awb0Parent', 'awb0CopyStableId', 'awb0CsidPath' ] );
        }
        return AwPromiseService.instance.resolve( modelObjects );
    }

    /**
     * Update the visibility of the selection commands menu in viewer
     *
     * @param {ViewerContextData} viewerCtxData viewer context data
     */

    updateViewerSelectionCommandsVisibility( viewerCtxData ) {
        var selectedCSIDsInViewer = viewerCtxData.getSelectionManager().getSelectedCsids();
        var invisibleCSIDsInViewer = viewerCtxData.getVisibilityManager().getInvisibleCsids();
        var invisibleExceptionCSIDsInViewer = viewerCtxData.getVisibilityManager().getInvisibleExceptionCsids();

        let invisiblePrtnCSIDsInViewer = viewerCtxData.getVisibilityManager().getInvisiblePartitionCsids();
        let selectedPrtnCSIDsInViewer = viewerCtxData.getSelectionManager().getSelectedPartitionCsids();

        var setSelectedOnVisible = false;
        var setSelectedOffVisible = false;
        var setContextOnVisible = false;

        if( _.isArray( selectedCSIDsInViewer ) && selectedCSIDsInViewer.length ) {
            if( _.isArray( invisibleCSIDsInViewer ) && invisibleCSIDsInViewer.length ) {
                if( !_.includes( invisibleCSIDsInViewer, '' ) ) {
                    for( var i = 0; i < selectedCSIDsInViewer.length; i++ ) {
                        if( _.includes( invisibleCSIDsInViewer, selectedCSIDsInViewer[ i ] ) ) {
                            setSelectedOnVisible = true;
                            break;
                        }
                    }
                    var selectedVisibleArray = _.difference( selectedCSIDsInViewer, invisibleCSIDsInViewer );

                    if( selectedVisibleArray && selectedVisibleArray.length !== 0 ) {
                        setSelectedOffVisible = true;
                    }
                } else {
                    setSelectedOnVisible = true;

                    if( _.isArray( invisibleExceptionCSIDsInViewer ) && invisibleExceptionCSIDsInViewer.length > 0 ) {
                        var selectedInVisibleArray = _.difference( selectedCSIDsInViewer,
                            invisibleExceptionCSIDsInViewer );

                        if( selectedInVisibleArray && selectedInVisibleArray.length === 0 ) {
                            setSelectedOnVisible = false;
                        }

                        for( var j = 0; j < selectedCSIDsInViewer.length; j++ ) {
                            if( _.includes( invisibleExceptionCSIDsInViewer, selectedCSIDsInViewer[ j ] ) ) {
                                setSelectedOffVisible = true;
                                break;
                            }
                        }
                    }
                }
                let currentProductContext = this.getCurrentProductContext( viewerCtxData );
                if( currentProductContext ) {
                    let currentProdCtxCsid = objectToCSIDGeneratorService.getCloneStableIdChain( currentProductContext );
                    if( _.isArray( selectedCSIDsInViewer ) && selectedCSIDsInViewer.length === 1 &&
                        selectedCSIDsInViewer[ 0 ] === currentProdCtxCsid ) {
                        for( var i = 0; i < invisibleCSIDsInViewer.length; i++ ) {
                            if( invisibleCSIDsInViewer[ i ].startsWith( currentProdCtxCsid ) ) {
                                setContextOnVisible = true;
                                break;
                            }
                        }
                    }
                }
            } else {
                setSelectedOffVisible = true;
            }
        }

        if( selectedPrtnCSIDsInViewer && Array.isArray( selectedPrtnCSIDsInViewer ) && selectedPrtnCSIDsInViewer.length > 0 ) {
            if( !setSelectedOnVisible ) {
                for( var i = 0; i < selectedPrtnCSIDsInViewer.length; i++ ) {
                    if( _.includes( invisiblePrtnCSIDsInViewer, selectedPrtnCSIDsInViewer[ i ] ) ) {
                        setSelectedOnVisible = true;
                        break;
                    }
                }
            }
            if( !setSelectedOffVisible ) {
                for( var i = 0; i < selectedPrtnCSIDsInViewer.length; i++ ) {
                    if( !_.includes( invisiblePrtnCSIDsInViewer, selectedPrtnCSIDsInViewer[ i ] ) ) {
                        setSelectedOffVisible = true;
                        break;
                    }
                }
            }
        }

        viewerCtxData.updateSelectedOnCommandVisibility( setSelectedOnVisible );
        viewerCtxData.updateSelectedOffCommandVisibility( setSelectedOffVisible );
        viewerCtxData.updateContextOnCommandVisibility( setContextOnVisible );
    }

    /**
     * Get current product context
     * @param {ViewerContextData} viewerCtxData viewer context data
     * @returns {Object} Current root object
     */
    getCurrentProductContext( viewerCtxData ) {
        var viewerCurrentProductContext = viewerCtxData.getCurrentViewerProductContext();
        if( viewerCurrentProductContext && viewerCurrentProductContext.modelType.typeHierarchyArray.indexOf( 'Awb0SavedBookmark' ) !== -1 ) {
            let occmgmtContextFromViewerContext = this.getOccmgmtContextFromViewerContext( viewerCtxData.getViewerCtxNamespace() );
            if( !occmgmtContextFromViewerContext ) {
                logger.error( 'Could not get occmgmtContext object for viewer context : ' +
                    viewerCtxData.getViewerCtxNamespace() + ' and occmgmtContext key : ' +
                    this.getOccmgmtContextNameKeyFromViewerContext( viewerCtxData.getViewerCtxNamespace() ) );
                return viewerCurrentProductContext;
            }
            var pciModelObj = occmgmtContextFromViewerContext.productContextInfo;
            var elementToPCIMap = occmgmtContextFromViewerContext.elementToPCIMap;
            if( elementToPCIMap && pciModelObj ) {
                for( var prop in elementToPCIMap ) {
                    if( elementToPCIMap.hasOwnProperty( prop ) && elementToPCIMap[ prop ] && elementToPCIMap[ prop ] === pciModelObj.uid ) {
                        return cdm.getObject( prop );
                    }
                }
            }
        }
        return viewerCurrentProductContext;
    }

    /**
     * This function will check whether the currently opened object is a Fnd0WorksetRevision or its subtype.
     *
     * @param {Object} occmgmtContextNameKey : Context Key name
     * @returns {boolean} True if the opened object is Fnd0WorksetRevision or a subtype, false otherwise.
     */
    isViewerOpenedForFnd0Workset( occmgmtContextNameKey ) {
        var isObjectBOMWorkset = false;
        let occmgmtContext = appCtxService.getCtx( occmgmtContextNameKey );
        var openedElement = occmgmtContext.openedElement;
        if( openedElement && openedElement.props && openedElement.props.awb0UnderlyingObject ) {
            var underlyingObjUid = openedElement.props.awb0UnderlyingObject.dbValues[ 0 ];
            var modelObjForUnderlyingObj = cdm.getObject( underlyingObjUid );
            if( modelObjForUnderlyingObj.modelType.typeHierarchyArray.indexOf( 'Fnd0WorksetRevision' ) > -1 ) {
                isObjectBOMWorkset = true;
            }
        }
        return isObjectBOMWorkset;
    }

    /**
     * Function returns alternate PCI object if available, otherwise returns main PCI object.
     * In 4G case, alternate PCI is set as workset PCI to avoid unnecessary refresh.
     *
     * @param {Object} occmgmtContext Occmgmt context
     * @returns {pciModelObj} .
     */
    getPCIModelObject( occmgmtContext ) {
        let pciModelObj = this.getViewerPCIToBeLoaded( occmgmtContext );
        if( pciModelObj && pciModelObj.props.awb0AlternateConfiguration ) {
            let alternatePCIUid = pciModelObj.props.awb0AlternateConfiguration.dbValues[ 0 ];
            var pref = viewerPreferenceService.getUseAlternatePCIPreference();
            if( ( !pref || pref === 'INDEXED' ) && this.hasAlternatePCI( pciModelObj ) ) {
                return cdm.getObject( alternatePCIUid );
            }
        }
        return pciModelObj;
    }

    /**
     * Function returns alternate PCI object if available, otherwise returns main PCI object.
     * In 4G case, alternate PCI is set as workset PCI to avoid unnecessary refresh.
     *
     * @param {Object} occmgmtContext Occmgmt context
     * @returns {pciModelObj} .
     */
    getViewerPCIToBeLoaded( occmgmtContext ) {
        if( occmgmtContext && occmgmtContext.elementToPCIMap && occmgmtContext.rootElement && occmgmtContext.elementToPCIMap[ occmgmtContext.rootElement.uid ] ) {
            return cdm.getObject( occmgmtContext.elementToPCIMap[ occmgmtContext.rootElement.uid ] );
        }
        if( occmgmtContext ) {
            return occmgmtContext.productContextInfo;
        }

        return null;
    }

    /**
     * Check product has Alternate PCI
     *
     * @param {Object} pciModelObj PCI model object
     *
     * @return {boolean} boolean result
     */
    hasAlternatePCI( pciModelObj ) {
        if( pciModelObj.props.awb0AlternateConfiguration ) {
            var alternatePCIUid = pciModelObj.props.awb0AlternateConfiguration.dbValues[ 0 ];
            return !_.isNull( alternatePCIUid ) && !_.isUndefined( alternatePCIUid ) && !_.isEmpty( alternatePCIUid );
        }
        return false;
    }

    /**
     * Register event for filter change and reset event
     */
    registerFilterReloadEvent() {
        if( !this._primaryWorkAreaContentReloadEvent ) {
            this._primaryWorkAreaContentReloadEvent = eventBus.subscribe( 'primaryWorkArea.contentsReloaded', () => {
                this._isFilterApplied = false;
            }, 'structureViewerService' );
        }
        if( !this._resetFilterEvent ) {
            this._resetFilterEvent = eventBus.subscribe( 'productContextChangedEvent', ( eventData ) => {
                var aceContext = appCtxService.getCtx( eventData.updatedView );
                if( aceContext && aceContext.requestPref && aceContext.requestPref.recipeReset === 'true' ) {
                    this.setIsFilterApplied( false );
                }
            }, 'structureViewerService' );
        }
    }

    /**
     * Register event for reset structure
     */
    registerAceResetStructureEvent() {
        let self = this;
        if( !this._aceResetStructureStartedListener ) {
            this._aceResetStructureStartedListener = eventBus.subscribe( 'ace.resetStructureStarted', ( eventData ) => {
                let occmgmtActiveCtxKey = eventData.scope.ctx.aceActiveContext && eventData.scope.ctx.aceActiveContext.key ?
                    eventData.scope.ctx.aceActiveContext.key : 'occmgmtContext';
                if( !_.includes( self._aceResetState, occmgmtActiveCtxKey ) ) {
                    self._aceResetState.push( occmgmtActiveCtxKey );
                }
                var activeToolAndInfoCmd = appCtxService.getCtx( 'activeToolsAndInfoCommand' );
                if( activeToolAndInfoCmd && activeToolAndInfoCmd.commandId ) {
                    eventBus.publish( 'awsidenav.openClose', {
                        id: 'aw_toolsAndInfo',
                        commandId: activeToolAndInfoCmd.commandId
                    } );
                }
                if( !appCtxService.getCtx( 'splitView.viewKeys' ) ) {
                    if( self._lastViewerCtxObj ) {
                        self._lastViewerCtxObj.getSessionMgr().disableBookmark( true ).then( () => {
                            self.cleanUpPreviousView( occmgmtActiveCtxKey );
                        } );
                    }
                }
            }, 'structureViewerService' );
        }
    }

    /**
     * register split view events
     */
    registerSplitViewEvents() {
        let self = this;
        if( !this._splitTreeLoadedUnloadedListner ) {
            this._splitTreeLoadedUnloadedListner = eventBus.subscribe( 'appCtx.register', ( eventData ) => {
                if( eventData.name === 'splitView' ) {
                    if( eventData.name === 'splitView' && appCtxService.getCtx( 'splitView.viewKeys' ) && self._lastViewerCtxObj && !self._lastViewerCtxObj.isConnectionClosed() ) {
                        self._lastViewerCtxObj.getSessionMgr().saveAutoBookmark();
                        self._lastProductContextInfoObj2 = null;
                    } else {
                        self._lastProductContextInfoObj = null;
                    }
                }
            } );
        }
    }

    /**
     * Check if reset was performed on currect pci
     * @param {String} occmgmtContextNameKey Occmgmt context name key
     * @returns {boolean} A boolean indicating if reset was performed
     */
    checkIfResetWasPerformedOnPci( occmgmtContextNameKey ) {
        if( occmgmtContextNameKey ) {
            return _.includes( this._aceResetState, occmgmtContextNameKey );
        }
        return false;
    }

    /**
     * Remove PCI from ACE reset state
     * @param {String} occmgmtContextNameKey Occmgmt context name key
     */
    removePciFromAceResetState( occmgmtContextNameKey ) {
        if( occmgmtContextNameKey ) {
            let index = this._aceResetState.indexOf( occmgmtContextNameKey );
            if( index > -1 ) {
                this._aceResetState.splice( index, 1 );
            }
        }
    }

    /**
     * Update isFilterApplied to false for filter reset to reload the viewer
     */
    setIsFilterApplied( isFilterApplied ) {
        this._isFilterApplied = isFilterApplied;
    }

    /**
     * Un-register event for filter chnage and reset event
     */
    deregisterFilterReloadEvent() {
        if( this._primaryWorkAreaContentReloadEvent ) {
            eventBus.unsubscribe( this._primaryWorkAreaContentReloadEvent );
        }
        if( this._resetFilterEvent ) {
            eventBus.unsubscribe( this._resetFilterEvent );
        }
        this._primaryWorkAreaContentReloadEvent = null;
        this._resetFilterEvent = null;
        this._isFilterApplied = true;
    }

    /**
     * Compute partition uid chain
     */
    computePartitionChain( partitionObj ) {
        let currModelObject = partitionObj;
        let uid_path = '';
        while( currModelObject ) {
            let props = currModelObject.props;
            if( props.awb0Parent && props.awb0UnderlyingObject ) {
                let ptnObj = cdm.getObject( props.awb0UnderlyingObject.dbValues[ 0 ] );
                uid_path = ptnObj.uid + '/' + uid_path;
                currModelObject = cdm.getObject( props.awb0Parent.dbValues[ 0 ] );
                if( !currModelObject || !_.includes( currModelObject.modelType.typeHierarchyArray, 'Fgf0PartitionElement' ) ) {
                    break;
                }
            } else {
                logger.error( 'partition uid chain Generation failed:  The mandatory property awb0Parent or awb0UnderlyingObject is missing.' );
                break;
            }
        }
        //Remove the leading and trailing /
        if( uid_path.length > 1 ) {
            uid_path = uid_path.slice( 0, uid_path.length - 1 );
        }
        return uid_path;
    }

    /**
     * Register App Session Save As listener 124
     */
    _registerAppSessionSaveAsListener124() {
        let self = this;
        if( self._appSessionSaveAsStaredListener === null ) {
            self._appSessionSaveAsStaredListener = eventBus.subscribe( 'Awb0SaveAsSession.contentLoaded', () => {
                if( self._lastViewerCtxObj && !self._lastViewerCtxObj.isConnectionClosed() ) {
                    self._lastViewerCtxObj.getSessionMgr().saveAutoBookmark();
                }
            }, 'structureViewerService' );
        }
    }

    /**
     * Register App Session creation listener 124
     */
    _registerAppSessionCreationListener124() {
        let self = this;
        if( self._appSessionCreateStaredListener === null ) {
            self._appSessionCreateStaredListener = eventBus.subscribe( 'Awb0CreateSession.contentLoaded', () => {
                if( self._lastViewerCtxObj && !self._lastViewerCtxObj.isConnectionClosed() ) {
                    self._lastViewerCtxObj.getSessionMgr().saveAutoBookmark();
                }
            }, 'structureViewerService' );
        }
    }

    /**
     * Starts Vis session saveAs process
     * @param {Object} occContext occurence management context
     */
    startVisSessionSaveAs( occContext ) {
        let self = this;
        //Call Save ABKM emm here. This will ensure that the current state of viewer is persisted in current session
        //visautobookmark data.
        if( this._lastViewerCtxObj && !this._lastViewerCtxObj.isConnectionClosed() ) {
            this._lastViewerCtxObj.getSessionMgr().saveAutoBookmark();
        }
        let currentPCI = this.getPCIModelObject( occContext );
        let is3DActiveForThisSession = this._lastProductContextInfoObj && currentPCI && this._lastProductContextInfoObj.uid === currentPCI.uid;
        if( is3DActiveForThisSession && this._appSessionSaveAsListener === null ) {
            this._appSessionSaveAsListener = eventBus.subscribe( 'cdm.created', ( eventData ) => {
                if( eventData && Array.isArray( eventData.createdObjects ) &&
                        eventData.createdObjects.length > 0 ) {
                    _.forEach( eventData.createdObjects, createdObject => {
                        if( createdObject.type === 'Fnd0AppSession' ) {
                            self._retain3DforAppSessionCreation = true;
                            self._registerProductContextInfoChangedListener();
                        }
                    } );
                }
                eventBus.unsubscribe( self._appSessionSaveAsListener );
                self._appSessionSaveAsListener = null;
            }, 'structureViewerService' );
        }
        return true;
    }

    /**
     * Starts Vis session save process
     * @param {Object} occContext occurence management context
     */
    startVisSessionCreation( occContext ) {
        let self = this;
        let currentPCI = this.getPCIModelObject( occContext );
        let is3DActiveForThisSession = this._lastProductContextInfoObj && currentPCI &&
                this._lastProductContextInfoObj.props.awb0Product.dbValues[ 0 ] === currentPCI.props.awb0Product.dbValues[ 0 ];
        if( this._lastViewerCtxObj && !this._lastViewerCtxObj.isConnectionClosed() ) {
            this._lastViewerCtxObj.getSessionMgr().saveAutoBookmark();
        }
        if( is3DActiveForThisSession && this._appSessionCreatedListener === null ) {
            this._appSessionCreatedListener = eventBus.subscribe( 'cdm.created', ( eventData ) => {
                if( eventData && Array.isArray( eventData.createdObjects ) &&
                        eventData.createdObjects.length > 0 &&
                        eventData.createdObjects[ 0 ].type === 'Fnd0AppSession' ) {
                    self._retain3DforAppSessionCreation = true;
                    self._registerProductContextInfoChangedListener();
                }
                eventBus.unsubscribe( self._appSessionCreatedListener );
                self._appSessionCreatedListener = null;
            }, 'structureViewerService' );
        }
        return true;
    }

    /**
     *  Unregister session creation and save as listeners
    */
    unregisterVisSessionListeners() {
        if( this._appSessionCreatedListener ) {
            eventBus.unsubscribe( this._appSessionCreatedListener );
            this._appSessionCreatedListener = null;
        }
        if( this._appSessionSaveAsListener ) {
            eventBus.unsubscribe( this._appSessionSaveAsListener );
            this._appSessionSaveAsListener = null;
        }
        return false;
    }

    /**
     * get last modified date
     */
    _getLastModDate( occmgmtContextKey ) {
        let _appSessionObj = appCtxService.getCtx( occmgmtContextKey ).topElement;
        let returnPromise = AwPromiseService.instance.defer();
        if( _appSessionObj && _appSessionObj.type === 'Fnd0AppSession' ) {
            soaSvc.post( 'Core-2007-01-DataManagement', 'refreshObjects', {
                objects: [ _appSessionObj ]
            } ).then( () => {
                dataManagementService.getPropertiesUnchecked( [ _appSessionObj ], [ 'last_mod_date' ] ).then( ( response ) => {
                    returnPromise.resolve( response.modelObjects[ _appSessionObj.uid ].props.last_mod_date.dbValues[ 0 ] );
                }, () => {
                    returnPromise.reject( 'Property is not loaded' );
                } );
            }, () => {
                returnPromise.reject( 'Could not refresh object' );
            } );
        } else {
            returnPromise.resolve( null );
        }
        return returnPromise.promise;
    }

    /**
     * Sync AppSession lsd with autobookmark
     */
    _syncAppSessionLSDWithAutobookmark() {
        let appSessionObj = null;
        let currentContext = appCtxService.getCtx( appCtxService.ctx.aceActiveContext.key );
        let appSessionObjUid = currentContext.workingContextObj.uid;
        if( !_.isNull( appSessionObjUid ) && !_.isUndefined( appSessionObjUid ) ) {
            appSessionObj = cdm.getObject( appSessionObjUid );
        }
        if( appSessionObj && appSessionObj.type === 'Fnd0AppSession' ) {
            var inputData = {
                input: [ {
                    productInfo: null,
                    workingContext: appSessionObj,
                    saveResult: true,
                    operation: 'SyncLSD'
                } ]
            };
            return soaSvc.post( 'Internal-ActiveWorkspaceBom-2020-05-OccurrenceManagement', 'updateWorkingContext', inputData );
        }
        return AwPromiseService.instance.resolve();
    }

    /**
     * Register product context info changed listener
     */
    _registerProductContextInfoChangedListener() {
        let self = this;
        if( self._productContextInfoChangedEvent === null ) {
            self._productContextInfoChangedEvent = eventBus.subscribe( 'productContextChangedEvent', () => {
                let occmgmtActiveContext = appCtxService.getCtx( 'aceActiveContext' );
                let occmgmtContextKey = occmgmtActiveContext && occmgmtActiveContext.key ? occmgmtActiveContext.key : 'occmgmtContext';
                //The indexed PCI doesn't contain the Awb0StructureRecepie property and hence causes issues while session creation
                //Always pass the non-indexed PCI
                var productCtxInfo = appCtxService.getCtx( occmgmtContextKey ).productContextInfo;
                self._getLastModDate( occmgmtContextKey ).then( ( LMD ) => {
                    if( self.createVisSessionifAppSessionBeingOpened( productCtxInfo, LMD ) ) {
                        //While setting the last PCI set it as per the "Use Indexed" preference so that 3D doesnn't reload.
                        self._lastProductContextInfoObj = self.getPCIModelObject( occmgmtActiveContext );
                    }
                } );
                eventBus.unsubscribe( self._productContextInfoChangedEvent );
                self._productContextInfoChangedEvent = null;
            }, 'structureViewerService' );
        }
    }

    /**
     * Register product launch listener
     */
    handleProductLaunchEvent( viewerCtxData, eventData ) {
        viewerCtxData.getSessionMgr().saveAutoBookmark().then( function() {
            dmSvc.createObjects( [ {
                data: {
                    boName: 'Fnd0TempAppSession'
                }
            } ] ).then( function( createObjectsResponse ) {
                let tempAppSession = createObjectsResponse.output[ 0 ].objects[ 0 ];
                let inputData = {
                    input: [ {
                        productInfo: eventData.productLaunchInfo.productContextInfo,
                        workingContext: tempAppSession,
                        saveResult: true,
                        operation: 'create'
                    } ]
                };

                soaSvc.post( 'Internal-ActiveWorkspaceBom-2020-05-OccurrenceManagement',
                    'updateWorkingContext', inputData ).then( function() {
                    let productCtxLaunchInfos = [];
                    productCtxLaunchInfos.push( {
                        productContextInfo: tempAppSession,
                        selections: eventData.productLaunchInfo.selections
                    } );
                    createLaunchInfoRequest.launchProduct( eventData.openInHost, eventData.isTohostInVis, productCtxLaunchInfos );
                } );
            } );
        } );
    }

    /**
     * Register listener for event 3D Cleanup event and register events to force reload viewer
     */
    registerCleanup3DViewEventListener() {
        let self = this;
        if( !self._cleanup3DViewerViewerEvent ) {
            self._cleanup3DViewerViewerEvent = eventBus.subscribe( 'sv.cleanup3DView', ( eventData ) => {
                self._registerForceReloadViewerEventListener( eventData.occmgmtContextKey );
            }, 'structureViewerService' );
        }
    }

    /**
     * Register event to mark viewer to force reload
     * @param {string} occmgmtContextKey - context key
     */
    _registerForceReloadViewerEventListener( occmgmtContextKey ) {
        let self = this;
        if( !self.viewerKeyToForceReloadListenersMap[ occmgmtContextKey ] ) {
            let listeners = [];
            _.forEach( self.eventsToSubscribeForceReload, event => {
                let _eventListener = eventBus.subscribe( event, ( eventData ) => {
                    let viewKeyListenerObj = self.viewerKeyToForceReloadListenersMap[ eventData.viewToReact ];
                    if( viewKeyListenerObj && viewKeyListenerObj.listeners && !viewKeyListenerObj.listeners.isEmpty ) {
                        viewKeyListenerObj.isForceReload = true;
                    }
                }, 'structureViewerService' );

                listeners.push( _eventListener );
            } );

            self.viewerKeyToForceReloadListenersMap[ occmgmtContextKey ] = { listeners: listeners };
        }
    }

    /**
     * De-Register event to clear force reload flag of viewer
     * @param {string} occmgmtContextKey - context key
     */
    _deRegisterForceReloadViewerEventListener( occmgmtContextKey ) {
        let viewKeyListenerObj = this.viewerKeyToForceReloadListenersMap[ occmgmtContextKey ];
        if( viewKeyListenerObj ) {
            if( viewKeyListenerObj.listeners ) {
                _.forEach( viewKeyListenerObj.listeners, listener => {
                    eventBus.unsubscribe( listener );
                } );
            }
            delete this.viewerKeyToForceReloadListenersMap[ occmgmtContextKey ];
        }
    }

    /**
     * Check if viewer needs to force reload or not
     *
     * @param {string} occmgmtContextKey - context key
     * @returns {boolean} true if viewer needs to force reload else return false.
     */
    isForceReloadViewer( occmgmtContextKey ) {
        let isForceReload = false;
        let viewKeyListenerObj = this.viewerKeyToForceReloadListenersMap[ occmgmtContextKey ];
        if( viewKeyListenerObj ) {
            isForceReload = Boolean( viewKeyListenerObj.isForceReload );
            this._deRegisterForceReloadViewerEventListener( occmgmtContextKey );
        }
        return isForceReload;
    }

    /**
     * pop up save as dialog
     */
    _popupSaveAsDialog() {
        //save as
        var buttons = [ {
            addClass: 'btn btn-notify',
            text: localeService.getLoadedText( 'StructureViewerMessages' ).Cancel,
            onClick: function( $noty ) {
                $noty.close();
            }
        }, {
            addClass: 'btn btn-notify',
            text: localeService.getLoadedText( 'StructureViewerMessages' ).Create,
            onClick: function( $noty ) {
                commandPanelService.activateCommandPanel( 'Awb0SaveAsSession', 'aw_toolsAndInfo' );
                $noty.close();
            }
        } ];
        messagingService.showWarning( localeService.getLoadedText( 'StructureViewerMessages' ).Checkout, buttons );
    }

    /**
     * Set if root node has disclosure data
     * @param {String} viewerContextNamespace Viewer context namespace
     * @param {String} rootElementId root element uid
     */
    setHasDisclosureData( viewerContextNamespace, rootElementId ) {
        disclosureService.hasDisclosedModelViewData( rootElementId ).then( ( hasData ) => {
            viewerContextService.updateViewerApplicationContext( viewerContextNamespace,
                viewerContextService.VIEWER_HAS_DISCLOSED_MV_DATA_TOKEN, hasData );
        } );
    }

    /**
     * Is apply bookmark is applicable for session/product
     */
    _isApplyBookmarkApplicable() {
        let occmgmtActiveContext = appCtxService.getCtx( 'aceActiveContext' );
        let applyBookmarkApplicable = true;
        if( occmgmtActiveContext && occmgmtActiveContext.context.isRestoreOptionApplicableForProduct ) {
            applyBookmarkApplicable = occmgmtActiveContext.context.isRestoreOptionApplicableForProduct !== true;
        }
        return applyBookmarkApplicable;
    }

    /**
     * Is Disable bookmark applicable while opening model
     * @returns {Boolean} is splitview mode
     */
    _isDisableBookMarkApplicable() {
        //disable bookmark for split view via openModelPreference
        return appCtxService.getCtx( 'splitView.mode' );
    }

    /**
     * Is "Show Suppressed" option toggled
     * @param  {Object} occmgmtContext occmgmt context
     * @returns {boolean} show suppressed value
     */
    _isShowSuppressedApplicable( occmgmtContext ) {
        if( occmgmtContext && occmgmtContext.displayToggleOptions && occmgmtContext.displayToggleOptions.PSEShowSuppressedOccsPref ) {
            return occmgmtContext.displayToggleOptions.PSEShowSuppressedOccsPref;
        }
        return false;
    }

    /**
     * Update section command state
     * @param {Object} viewerCtxData viewer context data
     */
    updateSectionCommandState( viewerCtxData ) {
        viewerCtxData.getSectionManager().updateSectionCommandState();
    }
}
